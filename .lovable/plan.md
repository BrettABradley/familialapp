

## Problem

The Members dialog only queries `circle_memberships`, which does not include the circle **owner**. The owner exists only in the `circles.owner_id` column. So when there's 1 owner and 0 other members, the count shows "1 of N" (because `getCircleMemberCount` adds +1 for the owner), but the dialog shows "No members yet."

## Fix in `src/pages/Circles.tsx`

### 1. Update `fetchMemberships` to include the owner

After fetching from `circle_memberships`, also fetch the owner's profile and prepend them to the list with a synthetic "owner" role entry. This ensures the owner always appears in the Members dialog.

```typescript
const fetchMemberships = async (circleId: string) => {
  const circle = circlesList.find(c => c.id === circleId);
  
  // Fetch regular members
  const { data } = await supabase
    .from("circle_memberships")
    .select(`*, profiles!circle_memberships_user_id_profiles_fkey(display_name, avatar_url)`)
    .eq("circle_id", circleId);

  const members = (data as unknown as CircleMembership[]) || [];

  // Add owner if not already in memberships
  if (circle && !members.find(m => m.user_id === circle.owner_id)) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", circle.owner_id)
      .maybeSingle();

    if (ownerProfile) {
      members.unshift({
        id: `owner-${circle.owner_id}`,
        circle_id: circleId,
        user_id: circle.owner_id,
        role: "owner",
        joined_at: circle.created_at,
        profiles: ownerProfile,
      } as unknown as CircleMembership);
    }
  }

  setMemberships(members);
};
```

### 2. Prevent removing/editing the owner row in the dialog

The owner entry will have `role: "owner"`, so the existing condition `member.user_id !== user?.id` already prevents self-actions for the owner viewing their own circle. The role dropdown and remove button won't show for the owner entry since `isOwner(selectedCircle)` only enables controls for non-self members.

### Files to modify
- `src/pages/Circles.tsx` — update `fetchMemberships` function

