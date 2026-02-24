

## Fix: Owner not showing as member after reclaiming circle

### Problem
When you put a circle on transfer block, it gets claimed by someone else, and then you claim it back — you become the owner but don't appear in the members list. This happens because the `claim_circle_ownership` function only ensures the old owner stays in `circle_memberships`, but never ensures the claimer (new owner) has a membership row.

### Root Cause
In the `claim_circle_ownership` database function, only the old owner is inserted into `circle_memberships` via `INSERT ... ON CONFLICT DO NOTHING`. The claimer's membership row may have been deleted when they left the circle during the transfer block period.

### Fix (1 database migration)

Update the `claim_circle_ownership` function to also insert the claimer into `circle_memberships` as an admin, using `ON CONFLICT DO NOTHING` to avoid duplicates if they're already present.

The key addition after the ownership transfer:

```sql
-- Ensure new owner is in circle_memberships
INSERT INTO circle_memberships (circle_id, user_id, role)
VALUES (_circle_id, auth.uid(), 'admin')
ON CONFLICT DO NOTHING;
```

This single change guarantees that regardless of whether the claimer left the circle previously, they will always have a membership row after claiming ownership.

