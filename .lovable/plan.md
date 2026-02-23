

# Fix: Stripe Purchases Not Reflecting in App

## Problem
When you purchase extra members or upgrade your plan, nothing changes in the app. The webhook endpoint has never received a single event (zero logs), meaning your Stripe Dashboard likely doesn't have the webhook URL registered, and the `STRIPE_WEBHOOK_SECRET` isn't configured.

## Solution
Instead of depending solely on the webhook (which requires manual Stripe Dashboard configuration), we'll create a **verify-checkout** edge function. After a successful Stripe checkout, the app will call this function with the checkout session ID. The function will look up the session in Stripe, determine what was purchased, and update the database directly.

The webhook will remain as a backup for reliability, but the primary flow will no longer depend on it.

## How It Works

```text
User completes Stripe Checkout
        |
        v
Redirected to /circles?checkout=success&session_id=cs_xxx
        |
        v
App calls verify-checkout edge function with session_id
        |
        v
Edge function retrieves session from Stripe API
        |
        v
Determines purchase type (subscription upgrade or extra members)
        |
        v
Updates user_plans or circles.extra_members in database
        |
        v
Returns result to app, which refreshes data
```

## Changes

### 1. New Edge Function: `verify-checkout`
**File:** `supabase/functions/verify-checkout/index.ts`

- Accepts a `sessionId` parameter from the authenticated user
- Retrieves the checkout session from Stripe
- Verifies the `user_id` in metadata matches the caller
- For subscriptions: determines product (Family/Extended), upserts `user_plans` with correct plan, max_circles, max_members_per_circle
- For one-time payments (extra members): reads `circle_id` from metadata, increments `circles.extra_members` by 7
- Uses the service role key to write to the database (since users can't write to `user_plans`)
- Returns the updated plan info so the frontend can display it immediately

### 2. Update `create-checkout` Edge Function
**File:** `supabase/functions/create-checkout/index.ts`

- Add `session.id` to the success URL as a query parameter: `success_url: ${origin}/circles?checkout=success&session_id={CHECKOUT_SESSION_ID}`
- Stripe automatically replaces `{CHECKOUT_SESSION_ID}` with the real session ID

### 3. Update Circles Page
**File:** `src/pages/Circles.tsx`

- On checkout success, read `session_id` from URL params
- Call `supabase.functions.invoke("verify-checkout", { body: { sessionId } })`
- On success, refresh circles and member info data
- Show appropriate toast message based on what was purchased
- Remove the arbitrary 2-second delay (no longer needed since we're verifying directly)

### 4. Update `supabase/config.toml`
- Add `verify_jwt = false` entry for the new `verify-checkout` function

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/verify-checkout/index.ts` | New edge function that verifies Stripe checkout and updates database |
| `supabase/functions/create-checkout/index.ts` | Append `session_id={CHECKOUT_SESSION_ID}` to success URL |
| `src/pages/Circles.tsx` | Call verify-checkout on return, remove 2s delay |
| `supabase/config.toml` | Add verify-checkout function config |

The webhook remains in place as a safety net -- if someone configures it in Stripe Dashboard later, it will still work. But the app no longer depends on it for the primary flow.
