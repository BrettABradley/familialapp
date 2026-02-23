

# Downgrade/Cancel Flow + FAQ Update

## Overview
Add the ability for logged-in users to downgrade or cancel their subscription from the pricing page, with changes taking effect at the end of the current billing period (not immediately). Also update the FAQ to reflect this policy.

## 1. Update FAQ Text

In `src/components/landing/FAQ.tsx`, change the "Can I upgrade or downgrade my plan?" answer to:

> "Yes! You can upgrade at any time and changes take effect immediately. If you downgrade or cancel, you'll keep full access to your current plan until the end of your billing period. After that, your plan will automatically adjust."

## 2. Create `customer-portal` Edge Function

Create `supabase/functions/customer-portal/index.ts` -- a new backend function that creates a Stripe Customer Portal session. This lets users manage (cancel/downgrade) their subscription through Stripe's hosted portal, which natively supports "cancel at end of period" behavior.

- Authenticates the user via their auth token
- Looks up the Stripe customer by email
- Creates a billing portal session with a return URL back to the pricing page
- Returns the portal URL

## 3. Create `cancel-subscription` Edge Function

Create `supabase/functions/cancel-subscription/index.ts` -- a targeted function for canceling/downgrading directly without the full portal UI:

- Authenticates the user
- Finds their active Stripe subscription
- Sets `cancel_at_period_end = true` on the subscription (keeps access until period ends)
- Updates `user_plans` table to record that cancellation is pending (new column)
- Returns confirmation with the period end date

## 4. Database Migration

Add a `cancel_at_period_end` boolean column (default `false`) and a `current_period_end` timestamp column to the `user_plans` table. These track pending cancellations so the UI can show the appropriate state.

```text
ALTER TABLE user_plans
  ADD COLUMN cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN current_period_end timestamptz;
```

## 5. Update Stripe Webhook

In `supabase/functions/stripe-webhook/index.ts`, add handlers for:

- **`customer.subscription.updated`**: When Stripe confirms a subscription is set to cancel at period end, update `user_plans.cancel_at_period_end` accordingly. Also handle actual plan changes (e.g., Extended to Family).
- **`customer.subscription.deleted`**: When the subscription actually expires, downgrade the user to Free (plan='free', max_circles=1, max_members_per_circle=8) and reset the cancellation flags.

## 6. Update Pricing Page Buttons

In `src/components/landing/Pricing.tsx`, update the button logic for logged-in users:

```text
For each tier card, when the user is logged in:

- Current plan               --> "Current Tier" (disabled, as today)
- Current plan (canceling)   --> "Canceling [date]" (disabled, shows end date)
- Higher tier                --> "Buy Now" / "Upgrade" (as today)  
- Lower tier (or Free)       --> "Downgrade" or "Cancel Membership"
```

The "Downgrade" / "Cancel Membership" button triggers a confirmation dialog explaining that access continues until the end of the billing period, then calls the `cancel-subscription` function.

For the Free tier specifically when a user is on a paid plan, the button reads "Cancel Membership." For a lower paid tier (e.g., user is on Extended, looking at Family), it reads "Downgrade."

## 7. Add Confirmation Dialog

Add an `AlertDialog` confirmation before processing a downgrade/cancel:

- Title: "Cancel your subscription?" or "Downgrade to [Plan]?"
- Body: "You'll keep access to your current plan until [date]. After that, your plan will switch to [target plan]."
- Actions: "Keep Current Plan" / "Confirm"

## Technical Flow

```text
User clicks "Downgrade" or "Cancel"
       |
       v
Confirmation dialog appears
       |
       v
Calls cancel-subscription edge function
       |
       v
Edge function sets cancel_at_period_end=true on Stripe subscription
       |
       v
Updates user_plans with cancel_at_period_end=true, current_period_end
       |
       v
UI updates to show "Canceling on [date]"
       |
       v
At period end, Stripe fires customer.subscription.deleted webhook
       |
       v
Webhook downgrades user_plans to free tier
```

## Files to Create
- `supabase/functions/cancel-subscription/index.ts`
- `supabase/functions/customer-portal/index.ts`

## Files to Modify
- `src/components/landing/FAQ.tsx` (update answer text)
- `src/components/landing/Pricing.tsx` (downgrade/cancel buttons + confirmation dialog + fetch cancel state)
- `supabase/functions/stripe-webhook/index.ts` (handle subscription.updated and subscription.deleted events)

## Database Changes
- Add `cancel_at_period_end` and `current_period_end` columns to `user_plans`

