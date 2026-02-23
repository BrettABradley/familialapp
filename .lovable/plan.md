

# Fix Stripe Product Description and Add "Current Tier" Logic

## Problem 1: Stripe Product Description Mismatch
The Stripe product "Family Plan" (`prod_U1PvvkbplSC8Pm`) currently says:
> "Family plan - up to 20 members per circle, **3 circles**"

But the correct description per the pricing page is **2 circles**. Unfortunately, there is no automated tool to update Stripe product descriptions -- you will need to manually update this in your Stripe dashboard. The product URL is accessible from your Stripe account under Products > Family Plan. Change the description to:
> "Family plan - up to 20 members per circle, 2 circles"

## Problem 2: Prevent Duplicate Purchases (Show "Current Tier")

### Changes to `src/components/landing/Pricing.tsx`:

1. **Fetch the user's current plan** from the `user_plans` table when logged in using a `useEffect` + query
2. **Replace the "Buy Now" button** with a disabled "Current Tier" button when the user's plan matches the tier
3. **Also disable "Get Started Free"** if the user is already on the free plan (logged in)
4. **Fix duplicate features** in all three tier lists (each has a duplicated last entry)

### How it works:
- When logged in, query `user_plans` for the current user's `plan` field (values: `free`, `family`, `extended`)
- For each pricing card, compare `tier.plan` against the user's current plan
- If they match: show a disabled button with text "Current Tier" (no arrow icon, no click handler)
- If they don't match: show the normal "Buy Now" / "Get Started Free" button as before

### UI behavior:
- **Not logged in**: All buttons work normally (redirect to `/auth?plan=...`)
- **Logged in, Free tier**: Free card shows "Current Tier" (disabled), Family and Extended show "Buy Now"
- **Logged in, Family tier**: Family card shows "Current Tier" (disabled), others show their normal CTAs
- **Logged in, Extended tier**: Extended card shows "Current Tier" (disabled), others show their normal CTAs

### Manual step required:
Update the Family Plan product description in Stripe from "3 circles" to "2 circles".

