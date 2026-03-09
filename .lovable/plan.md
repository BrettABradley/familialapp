

## Plan: Fix member count bug + enforce plan tier on transfer block claim

### Problem 1: Double-counted owner
`getCircleMemberCount` in `src/lib/circleLimits.ts` adds `+1` to the `circle_memberships` count to account for the owner. But `claim_circle_ownership` inserts the owner into `circle_memberships`, so after any claim the owner is counted twice.

### Problem 2: Free/lower tier can claim circles with more members than their plan allows
The `claim_circle_ownership` DB function only checks circle count limit, not whether the claimer's `max_members_per_circle` can accommodate the circle's current members.

---

### Changes

#### 1. Database migration: update `claim_circle_ownership` function
- After the existing circle-count check, add a new check:
  - Count current members in `circle_memberships` for this circle
  - Get claimer's `max_members_per_circle` from `user_plans` (default 8) + circle's `extra_members`
  - If current member count exceeds the claimer's allowed limit, raise `PLAN_TOO_LOW` exception

#### 2. Fix `src/lib/circleLimits.ts` — `getCircleMemberCount`
- Check if the circle owner already exists in `circle_memberships`
- Only add `+1` if the owner is NOT in the memberships table

#### 3. Update `src/components/circles/TransferBlockBanner.tsx`
- Handle `PLAN_TOO_LOW` error same as `CIRCLE_LIMIT_REACHED` — show the `UpgradePlanDialog`
- Update the upgrade dialog message to indicate the claimer needs a higher tier to support the circle's member count

### Files to modify
- `src/lib/circleLimits.ts`
- `src/components/circles/TransferBlockBanner.tsx`
- Database migration (update `claim_circle_ownership` function)

