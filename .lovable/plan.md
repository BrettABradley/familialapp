

## Plan: Show Circle Capacity in Transfer Ownership Dialogs

### Overview
When transferring ownership, each member in the list will show how many circle slots they have remaining on their current plan. This helps you pick someone who can take over without needing to upgrade.

### What You'll See
Each member row in both Transfer Ownership dialogs will display a small label like:
- "Free plan -- 0 of 1 circles available" (in red/warning, indicating they'd need to upgrade)
- "Family plan -- 1 of 3 circles available" (in green, good to go)
- "No plan info" as a fallback

### Technical Details

**File: `src/pages/Circles.tsx`**

1. **Fetch member plan data** -- When the transfer dialog opens, query `user_plans` and count owned circles for each member (excluding the current user). Store this in a state map keyed by `user_id`.

2. **Display in both dialogs** (Transfer Ownership + Transfer & Leave) -- Below each member's role, add a line showing:
   - Their plan name (capitalized)
   - Circles owned vs max allowed (e.g., "2 of 3 circles used")
   - Color-coded: green/muted if they have slots available, amber/red if they're at capacity

3. **Logic for "available" calculation:**
   ```
   owned_count = COUNT of circles WHERE owner_id = member.user_id
   max_circles = user_plans.max_circles (default 1)
   available = max_circles - owned_count
   ```
   If `available <= 0`, show a warning indicator. The transfer still works (the DB function doesn't block it), but the UI makes it clear the recipient may need to upgrade.

**Data fetching approach:**
- After `fetchMemberships` completes, run a parallel query for each member's `user_id`:
  - Fetch their `user_plans` row (plan name, max_circles)
  - Count their owned circles
- Store results in a `memberPlans` state: `Record<string, { plan: string; owned: number; max: number }>`

**No database changes needed** -- the existing `user_plans` SELECT policy already allows circle members to view circle owner plans, and the `circles` table is queryable for counting.

