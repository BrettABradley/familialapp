

# Send Receipt Emails for All Past Purchases

## Overview
Create a one-time edge function that fetches all completed payments from Stripe and sends receipt emails retroactively using the same branded template already in place.

## Approach
A new edge function `send-past-receipts` will:
1. Query Stripe for all past completed checkout sessions
2. For each session, determine the purchased item (subscription or extra members) from the line items
3. Send the same branded receipt email via Resend to the customer's email
4. Log results and skip any sessions without a valid email or recognizable price ID

This function will be invoked manually (once) to backfill receipts for all historical purchases.

## Changes

### 1. New file: `supabase/functions/send-past-receipts/index.ts`
- Authenticates the caller (must be logged in -- acts as a safety gate)
- Uses Stripe API to list all checkout sessions with `status: "complete"` and `payment_status: "paid"`
- Paginates through all results using Stripe's `auto_paging` or manual `starting_after` cursor
- For each session:
  - Retrieves line items to get the price ID
  - Maps price ID to item description and amount (same mapping as verify-checkout/stripe-webhook)
  - Gets the customer email from `session.customer_email` or `session.customer_details.email`
  - Sends the receipt email using the same HTML template and subject format (`Your Familial Receipt - [date]`)
  - Uses the session's `created` timestamp for the date (not today's date) so receipts reflect the actual purchase date
- Returns a summary: total sessions found, emails sent, skipped (no email or unknown price)

### 2. Update `supabase/config.toml`
- Add `[functions.send-past-receipts]` with `verify_jwt = false`

## Technical Details

**Date handling**: Unlike the real-time receipts which use `new Date()`, this function will use the Stripe session's `created` timestamp to format the date, so each receipt shows the actual purchase date.

**Rate limiting**: Resend allows up to 100 emails/second on most plans. A small delay (100ms) between sends will be added to avoid hitting limits.

**Idempotency**: If run multiple times, customers may receive duplicate receipts. A log of processed session IDs will be returned so you can verify before re-running.

**Files created/modified**:
| File | Change |
|------|--------|
| `supabase/functions/send-past-receipts/index.ts` | New one-time edge function to backfill receipts |
| `supabase/config.toml` | Add function config entry |

No new secrets needed -- uses existing `STRIPE_SECRET_KEY` and `RESEND_API_KEY`.

