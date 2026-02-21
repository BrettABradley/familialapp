

# Fix Invite Spam: Filter Already-Joined + Prevent Duplicates

## Problem
- autumnfhopkins@gmail.com has 12 pending invites across 2 circles she's **already a member of**
- The system allows sending unlimited duplicate invites to the same email for the same circle
- The UI deduplicates visually but stale invites pile up in the database

## Solution (3 layers of protection)

### 1. Frontend: Filter out invites for circles the user already belongs to
In `PendingInvites.tsx`, after fetching invites, also fetch the user's current circle memberships and owned circles. Exclude any invite where the user is already a member or owner. This provides an immediate fix.

### 2. Database: Clean up existing stale invites
Run a migration that marks all pending invites as "accepted" where the user is already a member of that circle. This clears the 12+ stale invites for autumnfhopkins and any similar cases for other users.

### 3. Database: Prevent duplicate pending invites at insert time
Add a validation trigger on `circle_invites` that checks before inserting:
- If the invited email already belongs to a member of that circle, reject the invite
- If there's already a pending (non-expired) invite for the same email + circle combo, reject the invite

This prevents the spam at the source.

---

## Technical Details

### PendingInvites.tsx changes
After fetching invites, also query the user's circle memberships and owned circles, then filter:
```text
// Fetch user's circles
const memberCircleIds = [...memberships, ...ownedCircles].map(c => c.id or c.circle_id)

// Filter out invites for circles user already belongs to
const valid = invites.filter(inv => !memberCircleIds.includes(inv.circle_id))
```

### Database Migration

**Step 1 -- Clean up stale data:**
```text
UPDATE circle_invites ci
SET status = 'accepted'
WHERE ci.status = 'pending'
AND EXISTS (
  SELECT 1 FROM auth.users au
  JOIN circle_memberships cm ON cm.user_id = au.id
  WHERE au.email = ci.email AND cm.circle_id = ci.circle_id
);
```

**Step 2 -- Prevent future duplicates via trigger:**
```text
CREATE FUNCTION validate_circle_invite() RETURNS trigger ...
  -- Reject if email user is already a member
  -- Reject if there's already a pending non-expired invite for same email+circle
```

**Step 3 -- Also prevent duplicate invites at the send-invite level:**
Add the same check in the edge function `send-circle-invite` if it exists, or in the frontend invite form.
