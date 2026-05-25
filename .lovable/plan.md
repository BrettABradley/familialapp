## Problem

On iOS, tapping **Cancel Membership** (or **Downgrade**) on the Upgrade/Pricing page calls the `cancel-subscription` edge function, which tries to find a Stripe customer. Apple-purchased users have no Stripe customer, so the function returns `"No Stripe customer found for this user"` — surfaced in the UI as an edge function error.

Confirmed in edge logs for `support@familialmedia.com` (their `user_plans.source = "apple"`), and confirmed in code: `src/components/landing/Pricing.tsx` has no iOS / Apple guard around the cancel/downgrade flow. (The Settings → `SubscriptionCard.tsx` already handles this correctly by hiding those buttons and showing "Manage in App Store" for Apple users.)

Per Apple App Store guideline 3.1.1, in-app cancellation of an IAP subscription must hand off to Apple's subscription management page — apps can't cancel a StoreKit subscription server-side.

## Fix

Update `src/components/landing/Pricing.tsx` so that, for iOS native users (or any user whose `user_plans.source = "apple"`):

1. Load `source` alongside the rest of `user_plans` in the existing fetch.
2. In `getButtonForTier`, when the target tier is lower than the current plan and the user is on Apple:
   - Replace the **Cancel Membership** / **Downgrade** buttons with a single **Manage in App Store** button that calls `openAppleSubscriptionManagement()` from `@/lib/iapPurchase`.
   - Show a short helper line: "Your subscription is managed by Apple."
3. Guard `handleCancelConfirm` and the upgrade-preview path so they early-return for Apple users (defense in depth — the buttons won't trigger them, but if any other path does, it shouldn't hit Stripe).
4. Leave Stripe (web) users completely unchanged.

No backend / edge function changes. No DB changes. No changes to `SubscriptionCard.tsx` (already correct).

## Files touched

- `src/components/landing/Pricing.tsx` — add `source` to the user_plans select, add `isApple` derived flag, swap button rendering and guard the cancel/downgrade handlers.

## QA

- iOS native (Apple-sourced plan): lower-tier rows show "Manage in App Store" and open Apple's subscription settings; no edge function calls.
- Web Stripe user: behavior unchanged — Cancel Membership and Downgrade still work.
- Free user / not logged in: behavior unchanged.
