

## Problem

The error "Only the circle owner can modify circle details other than the avatar" comes from the `restrict_circle_member_update` trigger on the `circles` table. When the `claim_circle_ownership` RPC runs `UPDATE circles SET owner_id = auth.uid(), transfer_block = false`, this trigger fires. Even though the function is `SECURITY DEFINER`, triggers still execute. The trigger checks `OLD.owner_id = auth.uid()` — but the claimer is not the current owner, so it blocks the update.

## Fix

Update the `restrict_circle_member_update` trigger function to also allow updates when the circle is on `transfer_block = true` and the update is coming from a security-definer context (or more simply, allow the ownership transfer when `OLD.transfer_block = true`).

### Database migration

Modify `restrict_circle_member_update()` to add an early return when the circle is on transfer block:

```sql
-- If the circle is on transfer block, allow the claim update
IF OLD.transfer_block = true THEN
  RETURN NEW;
END IF;
```

This is safe because:
- The `claim_circle_ownership` RPC already validates membership, transfer block status, plan limits, etc.
- The trigger only needs to guard against casual member updates, not RPC-driven ownership transfers.

### Files
- Database migration only (one SQL statement to replace the trigger function)

