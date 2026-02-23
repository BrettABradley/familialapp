

# Member Counter + Upgrade Requests for Circles

## What You'll See

1. **Member counter on each circle card** -- e.g. "3/8 members" (Free), "5/20 members" (Family), "12/35 members" (Extended) -- with color indicators when nearing capacity
2. **"Request Upgrade" button** for non-owner members when a circle is near-full or full, allowing them to send a request to the circle owner
3. **Owner receives upgrade requests** as a notification in the bell icon, with a message like: `"Jane requested you upgrade the Smith Family circle (3/8 members)"`

## How It Works

- The member counter pulls from `circle_memberships` count + `user_plans` for the owner's limit
- Any circle member (not just the owner) can tap "Request Upgrade" which creates a notification for the circle owner
- The owner sees the request in their notification bell and can act on it (open the upgrade dialog from the Circles page)
- Only the **owner** sees the "Upgrade" button directly; non-owners see "Request Upgrade" instead

## Technical Details

### 1. `src/pages/Circles.tsx` -- Add member counter and upgrade request

- Add a `useEffect` that fetches member count and plan limit for each circle (using existing `getCircleMemberCount` and `getCircleMemberLimit` from `src/lib/circleLimits.ts`)
- Store in state: `Record<string, { count: number; limit: number; plan: string }>`
- Render a badge on each circle card showing `count/limit members`
  - Green/default when under 80%
  - Amber when at 80%+
  - Red when full
- For **owners**: show an "Upgrade" button that opens the existing `UpgradePlanDialog`
- For **non-owners**: show a "Request Upgrade" button that inserts a notification to the circle owner

### 2. Upgrade request notification (no schema changes needed)

When a non-owner clicks "Request Upgrade":
- Insert into the existing `notifications` table:
  - `user_id`: the circle owner's ID
  - `type`: `"upgrade_request"`
  - `title`: `"Upgrade Request"`
  - `message`: `"[requester name] is requesting you upgrade [circle name] (X/Y members)"`
  - `related_circle_id`: the circle ID
  - `link`: `/circles` (so the owner can navigate to manage their circles)
- Show a toast confirming the request was sent
- Add a simple rate limit check (client-side) to prevent spamming -- check if an upgrade_request notification already exists from this user for this circle in the last 24 hours before inserting

### 3. No database migrations needed

The existing `notifications` table already supports all required fields (`user_id`, `type`, `title`, `message`, `related_circle_id`, `link`), and the RLS policy allows any authenticated user to insert notifications.

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Circles.tsx` | Add member counter display, "Upgrade" button for owners, "Request Upgrade" button for non-owners with notification insertion |

