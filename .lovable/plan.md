

# Fix Upgrade Flows and Add Extra Members Purchasing

## Problems Identified

1. **Dashboard upgrade error** — The Pricing component's "Upgrade" button for existing paid users calls `preview-upgrade` edge function, which fails with "Edge Function returned a non-2xx status code." This is likely because the user is on Family plan trying to upgrade to Extended, and the Stripe API call is failing (possibly due to API version or invoice preview params).

2. **Mobile app upgrade redirects to homepage** — Links like `/#pricing` and `navigate("/#pricing")` redirect to `/circles` on native platforms (Capacitor) because the Index page immediately redirects native users away. The `UpgradePlanDialog` uses `window.open(data.url, "_blank")` for checkout which may not work on mobile/Capacitor.

3. **No "Upgrade" button on Circles page** — Only a small arrow icon next to member count for circle owners; no prominent upgrade button.

4. **No upgrade button on ProfileView page** — Missing entirely.

5. **Extra members pack not accessible from Members dialog** — Currently only available through the UpgradePlanDialog, not directly when viewing members.

6. **Anyone in circle should be able to buy extra members** — Currently only shown to owners.

## Plan

### 1. Fix the `preview-upgrade` edge function error

Check and fix the `preview-upgrade` function. The `stripe.invoices.createPreview` API may require different params for the Stripe API version `2025-08-27.basil`. Update the function to use the correct Stripe API for previewing prorated upgrades. Also add better error handling.

Similarly verify `upgrade-subscription` function works correctly.

### 2. Create an in-app Upgrade page at `/upgrade`

Instead of relying on `/#pricing` (which doesn't work on mobile), create a dedicated `/upgrade` route that renders the Pricing component's plan selection logic in an authenticated context. This works on both web and mobile.

- Extract the pricing/plan selection UI into a reusable component or create a new `Upgrade` page
- Replace all `navigate("/#pricing")` and `href="/#pricing"` links with `navigate("/upgrade")`
- On the landing page, keep the existing Pricing section as-is

### 3. Add "Upgrade" button on Circles page

Next to the "Create Circle" button, add an "Upgrade" button that navigates to `/upgrade`. Show it when the user is on free or family plan.

### 4. Add "Upgrade Membership" button on ProfileView page

For own profile, add a button (similar to Settings button) that navigates to `/upgrade`.

### 5. Fix SubscriptionCard upgrade navigation

Change `navigate("/#pricing")` to `navigate("/upgrade")` in `SubscriptionCard.tsx`.

### 6. Add "Add Members" option in Members dialog

In the Members dialog on the Circles page, add an "Add 7 Extra Members — $5" button at the bottom. This should be available to **any circle member**, not just the owner. When clicked, it triggers the `create-checkout` edge function with the extra members price ID and the circle ID, opening Stripe checkout.

### 7. Fix mobile checkout flow

Replace `window.open(data.url, "_blank")` with `window.location.href = data.url` for Capacitor/mobile to ensure checkout actually opens in the same window rather than trying to open a new tab (which fails on mobile apps).

## Files to Create/Modify

- **New**: `src/pages/Upgrade.tsx` — Dedicated upgrade page using Pricing logic
- **Modify**: `src/App.tsx` — Add `/upgrade` route
- **Modify**: `src/pages/Circles.tsx` — Add Upgrade button next to Create Circle; add "Add Members" button in Members dialog
- **Modify**: `src/pages/ProfileView.tsx` — Add Upgrade button for own profile
- **Modify**: `src/components/settings/SubscriptionCard.tsx` — Fix navigation to `/upgrade`
- **Modify**: `src/components/circles/UpgradePlanDialog.tsx` — Fix mobile checkout (use `window.location.href` on Capacitor)
- **Modify**: `supabase/functions/preview-upgrade/index.ts` — Fix Stripe API call if needed
- **Modify**: `src/components/circles/ReadOnlyBanner.tsx` — Fix upgrade link

