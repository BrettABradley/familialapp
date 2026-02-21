

# Join by Code + Navigation Reorder

## Overview
Two changes: (1) Add a "Join by Code" feature so users can enter a circle's invite code to join without needing an email invite, and (2) reorder the navigation to match the requested layout and remove the Family Tree page.

---

## 1. Join by Code

### Database Migration
- Add a new RLS INSERT policy on `circle_memberships` allowing a user to join if they provide a valid invite code. Since the invite code check happens in the frontend (we look up the circle by code first), the existing unique constraint prevents duplicates.
- No new tables needed -- the `invite_code` column on `circles` already exists.

### Frontend (Circles.tsx)
- Add a "Join by Code" section/dialog alongside "Create Circle"
- Simple input field for the 8-character code + "Join" button
- Flow: query `circles` table by `invite_code`, then insert into `circle_memberships` with role `member`, then refetch circles
- Show appropriate error/success toasts

### RLS Consideration
- The user needs to SELECT from `circles` by invite code to find the circle ID. Add a SELECT policy: "Users can look up circles by invite code" that allows authenticated users to select a circle row where the invite_code matches (this is safe since it only exposes the circle name/id, not sensitive data).
- Add an INSERT policy on `circle_memberships`: "Users can join via invite code" allowing self-insert when the circle has a matching invite code.

---

## 2. Navigation Reorder + Remove Family Tree

### New nav order (desktop header + mobile)
1. Circles
2. Feed (currently "Home" on mobile)
3. Fridge
4. Events
5. Albums
6. Messages
7. Profile

### Files to update
- **CircleHeader.tsx**: Reorder `navItems` array, remove TreeDeciduous import and the Family Tree entry
- **MobileNavigation.tsx**: Update `navItems` and `moreItems` arrays to match the new order, remove Family Tree
- **App.tsx**: Remove the `/family-tree` route and FamilyTree import

---

## Technical Details

### Database Migration SQL
```text
-- Allow authenticated users to look up a circle by invite code
CREATE POLICY "Users can look up circles by invite code"
  ON public.circles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to self-join a circle (for join-by-code flow)
CREATE POLICY "Users can join via invite code"
  ON public.circle_memberships FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = circle_memberships.circle_id
    )
  );
```

Note: The existing "Users can join via invite" policy only covers email-based invites. This new policy covers code-based joins. We keep both.

### Circles.tsx Changes
- Add a "Join with Code" dialog with an Input for the code
- `handleJoinByCode`: query circles by invite_code, insert membership, refetch, show toast
- Place a "Join with Code" button next to "Create Circle" in the header area

### Navigation Arrays (CircleHeader.tsx)
```text
const navItems = [
  { to: "/circles", icon: Users, label: "Circles" },
  { to: "/feed", icon: Home, label: "Feed" },
  { to: "/fridge", icon: Pin, label: "Fridge" },
  { to: "/events", icon: Calendar, label: "Events" },
  { to: "/albums", icon: Image, label: "Albums" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/profile", icon: User, label: "Profile" },
];
```

### MobileNavigation.tsx
Primary tabs: Circles, Feed, Fridge, Events, More
More menu: Albums, Messages, Profile

