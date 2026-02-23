

# Complete Circle Rescue Flow + Read-Only Overflow UI

## Overview

Several pieces are already built (SubscriptionCard, cancel/downgrade edge functions, CircleRescueDialog, webhook handlers). This plan addresses the remaining gaps: read-only UI enforcement for overflow circles, rescue checkout handling in the webhook, and end-to-end testing readiness.

---

## 1. Add User Plan Data to CircleContext

Modify `src/contexts/CircleContext.tsx` to fetch and expose the current user's plan data (`plan`, `max_circles`, `cancel_at_period_end`, `current_period_end`) alongside existing circle/profile data. Add a helper function `isCircleReadOnly(circleId)` that returns `true` if the user owns more circles than `max_circles` and the given circle falls outside the allowed set (oldest N circles are active, newer ones are overflow).

This gives all downstream components access to read-only status without redundant queries.

## 2. Read-Only Banner Component

Create `src/components/circles/ReadOnlyBanner.tsx` -- a simple alert banner displayed at the top of circle-scoped pages (Feed, Events, Albums, Fridge, Messages) when the selected circle is read-only:

- Amber/warning styling using the existing `Alert` component
- Message: "This circle is read-only. The owner needs to upgrade, transfer ownership, or delete this circle to restore full access."
- If the current user IS the owner, show an "Upgrade" link to `/#pricing`

## 3. Enforce Read-Only in UI Components

Conditionally disable write actions when the selected circle is read-only:

- **Feed page** (`src/pages/Feed.tsx`): Hide or disable `CreatePostForm` when circle is read-only
- **Events page** (`src/pages/Events.tsx`): Disable "Create Event" button
- **Albums page** (`src/pages/Albums.tsx`): Disable "Create Album" and upload buttons
- **Fridge page** (`src/pages/Fridge.tsx`): Disable pin creation
- **Messages page** (`src/pages/Messages.tsx`): Disable sending in group chats for that circle
- **Circles page** (`src/pages/Circles.tsx`): Disable "Invite Member" for read-only circles

Each page will import `useCircleContext` and check `isCircleReadOnly(selectedCircle)`, then render the `ReadOnlyBanner` and disable the relevant controls.

## 4. Handle Rescue Checkout in Webhook

Update `supabase/functions/stripe-webhook/index.ts` in the `checkout.session.completed` handler to check if the checkout metadata contains a `rescue_circle_id`. If present:

1. Transfer circle ownership to the new subscriber using the existing `transfer_circle_ownership` database function (called via `supabase.rpc`)
2. Mark the corresponding `circle_rescue_offers` row as `claimed` with `claimed_by` set to the new owner
3. Send a notification to the original owner confirming the transfer

This ensures that when a member completes a rescue checkout, ownership transfers automatically without relying on the client-side claim (which currently happens before redirect and could fail).

## 5. Update CircleRescueDialog Checkout Metadata

Modify `src/components/circles/CircleRescueDialog.tsx` to pass `rescue_circle_id` (in addition to the existing `circleId`) in the checkout body so the webhook can identify rescue transactions. Also remove the premature client-side `claimed` update -- let the webhook handle it after payment confirmation.

## 6. Update create-checkout to Pass Rescue Metadata

Modify `supabase/functions/create-checkout/index.ts` to read `rescue_circle_id` from the request body and include it in the Stripe session metadata so the webhook can access it.

---

## Files to Create

- `src/components/circles/ReadOnlyBanner.tsx`

## Files to Modify

- `src/contexts/CircleContext.tsx` -- add plan data and `isCircleReadOnly` helper
- `src/pages/Feed.tsx` -- show banner, disable post creation when read-only
- `src/pages/Events.tsx` -- disable event creation when read-only
- `src/pages/Albums.tsx` -- disable album creation when read-only
- `src/pages/Fridge.tsx` -- disable pin creation when read-only
- `src/pages/Circles.tsx` -- disable invite when read-only
- `src/components/circles/CircleRescueDialog.tsx` -- pass rescue metadata, remove premature claim
- `supabase/functions/create-checkout/index.ts` -- forward `rescue_circle_id` in metadata
- `supabase/functions/stripe-webhook/index.ts` -- handle rescue ownership transfer on checkout completion

## No Database Changes Required

All needed tables and columns already exist.

