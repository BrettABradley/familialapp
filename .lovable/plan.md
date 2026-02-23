

# Fix: Circle Member Count Shows 2 Instead of 1

## The Bug
When you create a new circle, it shows "2 members" even though only you (the owner) are in the circle.

## Root Cause
When a circle is created, the owner is added to the `circle_memberships` table as an "admin" (line 223 in Circles.tsx). However, the `getCircleMemberCount` function in `circleLimits.ts` counts all entries in `circle_memberships` AND then adds +1 "for the owner" -- effectively double-counting the owner.

## The Fix
Remove the `+1` from `getCircleMemberCount` in `src/lib/circleLimits.ts`, since the owner is already tracked in the `circle_memberships` table.

### File Changed

| File | Change |
|------|--------|
| `src/lib/circleLimits.ts` | Change `return (count ?? 0) + 1` to `return count ?? 0` on line 8 |

This is a one-line fix.
