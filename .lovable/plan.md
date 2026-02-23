

# Receipt Emails for All Purchases

## Overview
Add branded receipt emails sent via Resend from `support@support.familialmedia.com` after every successful purchase. Emails include the purchase date in the subject line and a warm thank-you message.

## Changes

### 1. `supabase/functions/verify-checkout/index.ts`
After successfully updating the database (plan upgrade or extra members), send a receipt email:

- **From**: `Familial <support@support.familialmedia.com>`
- **To**: The authenticated user's email (`user.email`)
- **Subject**: `Your Familial Receipt - Feb 23, 2026` (formatted date of purchase)
- **Body** (branded HTML email):
  - Receipt header with Familial branding
  - Item purchased (mapped from price ID):
    - Family Plan (Monthly) -- $7.00
    - Extended Plan (Monthly) -- $15.00
    - Extra Member Pack (+7 members) -- $5.00
  - Date of purchase
  - Thank-you message: "Thank you so much for your business. We hope our products bring you closer to your family and close friends."
  - Non-refundable policy reminder
  - Support contact footer
- Email sending is best-effort (logged but does not block the purchase response)

### 2. `supabase/functions/stripe-webhook/index.ts`
Same receipt email logic added after processing `checkout.session.completed` events:

- Uses `session.customer_email` or `session.customer_details?.email` for the recipient
- Same subject format with date, same HTML template, same thank-you message
- Acts as a backup in case the user doesn't return to the app after checkout

### Technical Details

**Price-to-description mapping** (shared in both files):
```text
price_1T3N5bCiWDzualH5Cf7G7VsM  ->  "Family Plan (Monthly)"       / $7.00
price_1T3N5nCiWDzualH5SBHxbHqo  ->  "Extended Plan (Monthly)"     / $15.00
price_1T3N5zCiWDzualH52rsDSBlu  ->  "Extra Member Pack (+7 members)" / $5.00
```

**Subject line format**: `Your Familial Receipt - Mon DD, YYYY`

**Files modified**:
| File | Change |
|------|--------|
| `supabase/functions/verify-checkout/index.ts` | Add receipt email after successful purchase processing |
| `supabase/functions/stripe-webhook/index.ts` | Add receipt email after `checkout.session.completed` |

No new secrets needed -- `RESEND_API_KEY` is already configured and used by other edge functions.

