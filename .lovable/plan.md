

# Fix: Restore "Join by Invite Code" functionality

## Problem
The previous security migration dropped the "Users can join via invite code" INSERT policy on `circle_memberships` but didn't replace it with a secure alternative. Now users get an RLS violation when trying to join a circle with an invite code.

## Solution
Create a `SECURITY DEFINER` RPC function `join_circle_by_invite_code` that:
1. Validates the invite code matches a real circle
2. Checks the user isn't already a member/owner
3. Inserts the membership row (bypassing RLS safely since validation is done server-side)

Then update `Circles.tsx` to call this RPC instead of doing a direct `.insert()` on `circle_memberships`.

## Changes

### 1. Database migration
- Create `join_circle_by_invite_code(_invite_code text)` as a `SECURITY DEFINER` function that:
  - Looks up the circle by invite code
  - Verifies the caller isn't already a member or owner
  - Inserts into `circle_memberships` and returns the circle id and name
  - Raises exceptions for invalid code, already a member, or member limit (leveraging the existing `enforce_circle_member_limit` trigger)

### 2. Update `src/pages/Circles.tsx`
- Replace the direct `supabase.from("circle_memberships").insert(...)` call with `supabase.rpc("join_circle_by_invite_code", { _invite_code: joinCode.trim() })`
- Simplify the flow since the RPC handles validation internally

