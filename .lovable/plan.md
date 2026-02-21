
# Fix Circles White Screen + Add Pending Invites Badge

## Problem Analysis

The white screen on the Circles page is caused by the `PendingInvites` component crashing. Here's why:

1. When fetching pending invites, the query joins with the `circles` table: `circles(id, name, description)`
2. The `circles` table has an RLS policy that only allows users to view circles they **belong to**
3. An invited user **is not yet a member** of the circle, so the `circles` join returns `null`
4. The component then tries to access `invite.circles.name`, which throws a TypeError on a null object, crashing the page

## Solution

### 1. Fix the crash in PendingInvites (null-safe rendering)
- Add null checks for `invite.circles` so the component doesn't crash
- Filter out invites where the circle data couldn't be loaded

### 2. Update RLS on `circles` table
- Add a SELECT policy allowing users to view circles they have a **pending invite** for
- This lets the join query work properly so invited users can see the circle name

### 3. Add invite count badge to Circles page
- Show a badge with the count of pending invites next to the "Pending Invitations" section header
- Make the PendingInvites section always visible (even when loading) with a count indicator

---

## Technical Details

### Database Migration -- New RLS policy on `circles`

Add a new SELECT policy:
```text
CREATE POLICY "Invited users can view circle info"
  ON public.circles FOR SELECT
  USING (
    id IN (
      SELECT ci.circle_id FROM public.circle_invites ci
      WHERE ci.email = (auth.jwt() ->> 'email')
        AND ci.status = 'pending'
        AND ci.expires_at > now()
    )
  );
```

### PendingInvites.tsx changes
- Add null-safety: filter out invites where `circles` is null (defensive)
- Expose the invite count so the parent can show a badge
- Accept an `onCountChange` callback prop to communicate the count upward

### Circles.tsx changes
- Track pending invite count in state
- Show a Badge next to the section header with the count (e.g., "Pending Invitations (3)")
- Import the Badge component from the UI library
