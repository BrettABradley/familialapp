

# Fix Deployment + Polish Subscription Management

## Issue Found

The `cancel-subscription` and `customer-portal` edge functions are **missing from `supabase/config.toml`**. Without entries there, these functions won't deploy and any calls from the SubscriptionCard ("Cancel Membership", "Manage Billing") will fail with a 404/500 error.

Additionally, the `send-past-receipts` function is also missing from config.toml.

## Fix

### 1. Update `supabase/config.toml`

Add the missing function entries:

```
[functions.cancel-subscription]
verify_jwt = false

[functions.customer-portal]
verify_jwt = false

[functions.send-past-receipts]
verify_jwt = false
```

This is the only code change needed. Everything else (SubscriptionCard UI, CircleRescueDialog, ReadOnlyBanner, webhook handlers, downgrade-subscription function) is already properly wired up and ready to test once the functions are deployed.

## What's Already Working (No Changes Needed)

- **SubscriptionCard** in Settings page: Shows plan badge, billing period, cancel/downgrade buttons, affected circles dialog
- **cancel-subscription function**: Sets `cancel_at_period_end` on Stripe, updates `user_plans`
- **customer-portal function**: Creates Stripe billing portal session, returns to `/settings`
- **downgrade-subscription function**: Switches Extended to Family price on Stripe
- **CircleRescueDialog**: Shows rescue offer to members, triggers checkout with `rescue_circle_id`
- **create-checkout**: Forwards `rescue_circle_id` in Stripe metadata
- **stripe-webhook**: Handles rescue ownership transfer on checkout, expires offers on subscription deletion
- **ReadOnlyBanner**: Displays on Feed, Events, Albums, Fridge for overflow circles
- **CircleContext.isCircleReadOnly()**: Determines overflow based on owned circle count vs plan limit

## Files to Modify

- `supabase/config.toml` -- add 3 missing function entries

