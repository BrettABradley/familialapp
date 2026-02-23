

# Subscription Management in Settings + Downgrade Offboarding + Circle Rescue Flow

## Overview

Add a "Subscription" card to the Settings page, support Extended-to-Family downgrades, handle circle overflow with a "soft lock" policy, and introduce a **Circle Rescue** flow where other circle members can opt in to take over payment for a circle the owner is about to lose due to downgrading.

---

## 1. Settings Page -- New "Subscription" Card

Add a second card below the profile card in `src/pages/Settings.tsx`:

- **Current plan name** with a colored badge (Free / Family / Extended)
- **Billing period end date** (if on a paid plan)
- **Cancellation status** ("Canceling on [date]" if pending)
- **Action buttons**:
  - "Manage Billing" -- opens Stripe Customer Portal (invoices, payment method)
  - "Downgrade to Family" (if on Extended)
  - "Cancel Membership" (to Free)
- Plan data fetched from `user_plans` table

## 2. Customer Portal Return URL

Update `supabase/functions/customer-portal/index.ts` to return users to `/settings` instead of `/#pricing`.

## 3. Extended-to-Family Downgrade

Create `supabase/functions/downgrade-subscription/index.ts`:

- Authenticates the user
- Finds their active Stripe subscription
- Updates the subscription price from Extended to Family using `stripe.subscriptions.update()` with `proration_behavior: 'none'` so the price change applies at the next billing cycle
- Sets `pending_plan = 'family'` in `user_plans` so the UI can show "Switching to Family on [date]"
- The webhook's existing `customer.subscription.updated` handler already processes actual plan changes

### Database Change

Add a `pending_plan` column (text, nullable, default null) to `user_plans`.

## 4. Circle Offboarding -- Soft Lock Policy

When a downgrade takes effect and the user owns more circles than their new plan allows:

- **No automatic deletion** -- family data is never destroyed
- **Read-only overflow**: excess circles (determined by creation date, oldest kept active) become locked:
  - Members can still **view** all content
  - **Cannot** create new posts, events, albums, or invite members
  - A banner appears: "This circle is read-only. The owner needs to upgrade, transfer ownership, or delete this circle."
- The user must **transfer ownership**, **delete**, or **upgrade** to restore full access

Frontend enforcement: compare `circles` owned count against `user_plans.max_circles`. Circles beyond the limit get a read-only UI treatment.

## 5. Circle Rescue Flow (New Concept)

When a user begins the downgrade/cancel process and has circles that would become read-only, other members of those circles can **opt in to pick up the payment** and take over ownership.

### How It Works

**Step 1 -- Downgrade Confirmation with Circle Impact**

When the user confirms a downgrade/cancel, the confirmation dialog lists the specific circles that will be affected:

> "You own 3 circles. The Free plan allows 1. These circles will become read-only:
> - **Smith Family Reunion** (12 members)
> - **Book Club** (5 members)
>
> Members of these circles will be notified and given the option to take over ownership and billing."

**Step 2 -- Circle Rescue Notifications**

After the user confirms the downgrade, a notification is sent to all members of the affected circles:

> "[Owner Name] is downgrading their plan. **[Circle Name]** will become read-only on [date] unless someone takes over. Tap here to keep it active."

This uses the existing `notifications` table with a new type: `circle_rescue`.

**Step 3 -- Rescue Page / Dialog**

When a member taps the notification, they see a dialog explaining:

- The circle will become read-only on [date]
- They can take over ownership by subscribing to a plan that supports this circle
- What "taking over" means: they become the circle owner and start a subscription

**Step 4 -- Rescue Checkout**

If the member agrees, the flow:
1. Calls `create-checkout` with the required plan (Family or Extended) and the circle ID in metadata
2. Upon successful payment (handled by webhook), the system:
   - Transfers circle ownership to the rescuer (using existing `transfer_circle_ownership` function)
   - The original owner's circle count decreases, potentially resolving their overflow

**Step 5 -- Rescue Deadline**

The rescue window lasts until the original owner's billing period ends (`current_period_end`). If no one rescues the circle by then, it enters read-only mode as described in the soft lock policy.

### Database Changes for Circle Rescue

New table: `circle_rescue_offers`

```text
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
circle_id       uuid NOT NULL (references circles.id)
current_owner   uuid NOT NULL (user who is downgrading)
deadline        timestamptz NOT NULL (matches current_period_end)
status          text NOT NULL DEFAULT 'open' (open / claimed / expired)
claimed_by      uuid (the member who took over, nullable)
created_at      timestamptz DEFAULT now()
```

RLS policies:
- SELECT: circle members can view rescue offers for their circles
- UPDATE: authenticated users can claim (set claimed_by, status='claimed') if they are a member of the circle

### Notification Content

Type: `circle_rescue`
Title: "Circle needs a new owner"
Message: "[Owner] is downgrading. [Circle Name] will become read-only on [date] unless someone takes over."
Link: `/circles?rescue=[circle_id]`

## 6. Downgrade Confirmation Dialog Updates

Update the confirmation dialog in Pricing.tsx and Settings.tsx to:

1. Fetch the user's owned circles and compare count vs target plan limit
2. If overflow exists, list the affected circles by name with member counts
3. Explain that members will be notified and can opt to take over
4. On confirm: create `circle_rescue_offers` for each affected circle, send notifications to members, then proceed with the cancellation

## 7. Update Stripe Webhook

In the `customer.subscription.deleted` handler, after downgrading to free:
- Mark any open `circle_rescue_offers` for that user as `expired` if unclaimed
- The soft lock kicks in naturally via frontend enforcement

---

## Technical Flow

```text
User clicks "Cancel" or "Downgrade"
       |
       v
Confirmation dialog shows affected circles
       |
       v
User confirms
       |
       v
Creates circle_rescue_offers for overflow circles
Sends notifications to all members of affected circles
Calls cancel-subscription (or downgrade-subscription)
       |
       v
Rescue window is open (until billing period ends)
       |
       v
Member taps notification --> sees rescue dialog
       |
       v
Member clicks "Take Over" --> Stripe checkout
       |
       v
On successful payment:
  - transfer_circle_ownership() to rescuer
  - Mark rescue offer as "claimed"
  - Original owner's circle count drops
       |
       v
If no one rescues by deadline:
  - Subscription expires (webhook fires)
  - circle_rescue_offers marked "expired"
  - Overflow circles enter read-only mode
```

---

## Files to Create

- `supabase/functions/downgrade-subscription/index.ts` -- handles Extended-to-Family plan change
- A new component `src/components/circles/CircleRescueDialog.tsx` -- shown when a member taps a rescue notification

## Files to Modify

- `src/pages/Settings.tsx` -- add Subscription management card
- `src/components/landing/Pricing.tsx` -- update cancel dialog to show affected circles and trigger rescue flow
- `supabase/functions/customer-portal/index.ts` -- change return URL to `/settings`
- `supabase/functions/stripe-webhook/index.ts` -- on subscription.deleted, expire unclaimed rescue offers; on checkout.session.completed, handle rescue claim (transfer ownership)
- `src/pages/Circles.tsx` -- handle `?rescue=` query param to open rescue dialog

## Database Changes

1. Add `pending_plan` column to `user_plans` (text, nullable, default null)
2. Create `circle_rescue_offers` table with RLS policies
