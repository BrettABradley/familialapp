

# Enforce Member Limits with Upgrade Flow and Extra-Seat Purchases

## Overview
When a circle reaches its member limit, block new invites/joins and prompt the user to either upgrade their plan or (if already on Extended) purchase extra member slots. Any circle member can trigger the upgrade -- not just the admin.

## What Needs to Happen

### 1. Enable Stripe Integration
Stripe is not yet connected. We need to enable it first to handle:
- Plan upgrades (Free to Family at $7/mo, Free/Family to Extended at $15/mo)
- Extra member packs for Extended users ($5 per 7 extra members)

### 2. Database Changes

**Add `extra_members` column to `user_plans`:**
Tracks how many extra member slots the circle owner has purchased.

```text
ALTER TABLE public.user_plans
  ADD COLUMN extra_members integer NOT NULL DEFAULT 0;
```

**Create a helper function `get_circle_member_limit()`:**
Returns the effective member limit for a circle based on the owner's plan:
`max_members_per_circle + extra_members`

### 3. Enforcement Points

**A. Invite flow (`handleInviteMember` in Circles.tsx):**
Before creating an invite, count current members + pending invites for that circle. If at or over the limit, show an upgrade dialog instead.

**B. Join-by-code flow (`handleJoinByCode` in Circles.tsx):**
Same check -- if the circle is full, show a message that the circle has reached its limit.

**C. Accept-invite flow (`handleAccept` in PendingInvites.tsx):**
Check member count before joining. If full, show message.

**D. Database trigger (defense in depth):**
Add a `BEFORE INSERT` trigger on `circle_memberships` that rejects if the circle is at capacity.

### 4. Upgrade/Purchase UI

**New component: `UpgradePlanDialog`**
- Shown when a member limit is hit
- Displays current plan and options:
  - If on Free: upgrade to Family ($7/mo) or Extended ($15/mo)
  - If on Family: upgrade to Extended ($15/mo)
  - If on Extended: purchase extra member pack ($5 for 7 members)
- Any circle member can see and use this dialog
- Stripe Checkout handles the payment

### 5. Stripe Products and Edge Functions

**Products to create in Stripe:**
- Family Plan: $7/month subscription
- Extended Plan: $15/month subscription
- Extra Members Pack: $5 one-time payment (adds 7 members)

**Edge function: `create-checkout`**
Handles creating Stripe Checkout sessions for upgrades and extra member purchases.

**Edge function: `stripe-webhook`**
Handles Stripe webhook events to:
- Update `user_plans.plan` and `max_members_per_circle` on subscription start
- Increment `user_plans.extra_members` by 7 on successful extra-member payment

### 6. Flow Diagram

```text
User clicks "Invite" or "Join"
       |
   Check member count vs limit
       |
  Under limit? --> Proceed normally
       |
  At limit? --> Show UpgradePlanDialog
       |
  User picks upgrade option
       |
  Stripe Checkout --> Payment
       |
  Webhook updates user_plans
       |
  User retries invite/join --> Success
```

## Technical Details

### Member count check (reusable function)
```text
async function getCircleMemberCount(circleId: string): Promise<number> {
  // Count owner (1) + memberships
  const { count } = await supabase
    .from("circle_memberships")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId);
  return (count ?? 0) + 1; // +1 for owner
}

async function getCircleMemberLimit(circleOwnerId: string): Promise<number> {
  const { data } = await supabase
    .from("user_plans")
    .select("max_members_per_circle, extra_members")
    .eq("user_id", circleOwnerId)
    .maybeSingle();
  return (data?.max_members_per_circle ?? 8) + (data?.extra_members ?? 0);
}
```

### Database trigger on circle_memberships
```text
CREATE FUNCTION enforce_circle_member_limit() RETURNS trigger ...
  -- Get circle owner
  -- Get their plan limits (max_members_per_circle + extra_members)
  -- Count current members + 1 (owner)
  -- If count >= limit, RAISE EXCEPTION
```

### UpgradePlanDialog component
- Props: `circleId`, `circleOwnerId`, `currentCount`, `limit`, `isOpen`, `onClose`
- Fetches the circle owner's current plan
- Shows upgrade options based on plan tier
- Calls `create-checkout` edge function to start Stripe flow
- Any authenticated circle member can trigger this

### Pricing update
Add a note to the Extended tier on the Pricing page:
"Need more? Add 7 members for $5"

## Prerequisites
- Stripe must be enabled and connected before implementation can proceed
- The Stripe secret key will be needed for the edge functions

## Implementation Order
1. Enable Stripe integration
2. Database migration (add `extra_members` column + enforcement trigger)
3. Create Stripe products/prices
4. Build `create-checkout` and `stripe-webhook` edge functions
5. Build `UpgradePlanDialog` component
6. Add member-limit checks to invite, join, and accept flows
7. Update Pricing.tsx with extra-member add-on note
