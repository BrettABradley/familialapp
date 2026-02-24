

# Fix: Family Plan Purchase Not Granting Access

## What happened

The user `friendsandbrett@gmail.com` has an active Stripe subscription on the Family plan (confirmed in Stripe), but their database record still shows `plan: free` with 1 circle and 8 members. The `verify-checkout` function has zero logs, meaning it was never called.

## Root cause

There is a critical gap in the checkout return flow:

1. User signs in at `/auth?plan=family`, which triggers Stripe checkout
2. User completes payment on Stripe
3. Stripe redirects back to `/circles?checkout=success&session_id=...`
4. **Problem**: The `AppLayout` component checks authentication first. If the user's session expired during checkout (common with external redirects), they get redirected to `/auth` -- and the `session_id` query parameter is lost forever
5. The `verify-checkout` function in `Circles.tsx` never runs because the user never reaches that page with the query params intact
6. No webhook is configured either (no `STRIPE_WEBHOOK_SECRET` exists), so there is no backup path

This means any user whose session expires during checkout will pay but never receive their plan upgrade.

## Fix (3 parts)

### Part 1: Immediate data fix
Run a database update to set `friendsandbrett@gmail.com` (user_id `59b40736-dbc2-48aa-9c78-4e4b7bfc78cd`) to the Family plan with correct limits. This grants them immediate access.

### Part 2: Persist checkout session_id across auth redirects
When the user lands on `/circles?checkout=success&session_id=...` but gets redirected to `/auth` due to an expired session, the session_id is lost. Fix this by:

- **In `AppLayout.tsx`**: Before redirecting to `/auth`, check if the current URL has checkout params. If so, save the full return URL (including query params) to `localStorage`
- **In `Auth.tsx`**: After successful login, check `localStorage` for a saved return URL and redirect there instead of the default `/circles`
- This ensures the `verify-checkout` flow in `Circles.tsx` always executes after payment

### Part 3: Add a login-time subscription sync as a safety net
Create a lightweight mechanism so that every time a user logs in, their Stripe subscription status is checked against their database plan. This catches any missed verifications.

- **New edge function `check-subscription`**: Takes the authenticated user's email, looks up their Stripe customer and active subscriptions, and updates `user_plans` if the database is out of sync with Stripe
- **In `CircleContext.tsx`**: Call `check-subscription` once when the user loads (after auth), ensuring plans are always current regardless of whether `verify-checkout` ran

## Technical details

### Database migration
```sql
UPDATE user_plans
SET plan = 'family', max_circles = 2, max_members_per_circle = 20, updated_at = now()
WHERE user_id = '59b40736-dbc2-48aa-9c78-4e4b7bfc78cd';
```

### File: `src/components/layout/AppLayout.tsx`
- In the `useEffect` that redirects to `/auth`, save `window.location.pathname + window.location.search` to `localStorage` key `postAuthRedirect` before navigating

### File: `src/pages/Auth.tsx`
- After successful login (when `user` becomes truthy), check `localStorage` for `postAuthRedirect`. If found, navigate there and clear it. Otherwise use the existing default redirect logic

### New file: `supabase/functions/check-subscription/index.ts`
- Authenticate the caller
- Look up Stripe customer by email
- Check active subscriptions
- Compare against `user_plans` row
- If Stripe shows a higher plan than the database, update the database
- Return the current plan status

### File: `src/contexts/CircleContext.tsx`
- After fetching user plan, invoke `check-subscription` in the background
- If the returned plan differs, refetch the user plan data

