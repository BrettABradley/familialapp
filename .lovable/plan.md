

## Plan: Upgrade Preview, Receipt Emails, and Downgrade Verification

### Problem
Currently, clicking "Upgrade" on the pricing page immediately charges the user behind the scenes via the `upgrade-subscription` edge function with no preview or confirmation. Users need to:
1. See exactly what they'll be charged before paying
2. Receive a receipt email for upgrade purchases
3. Have the downgrade flow properly preserve their current plan perks until the billing period ends

### Changes

---

### 1. New Edge Function: `preview-upgrade`
Creates a preview invoice via Stripe's `stripe.invoices.createPreview()` to calculate the exact prorated charge amount before any payment happens.

- Takes `priceId` as input
- Finds the user's active subscription
- Returns: prorated amount due now, new monthly price, current period end date, and plan name

---

### 2. Update `upgrade-subscription` to Send Receipt Email
After a successful subscription update, the function will send a branded receipt email via Resend (same format as existing receipts in the webhook). The email will:
- Show the prorated amount charged (not the full plan price)
- Thank the user for upgrading
- Include the new plan name and effective date

To get the actual charge amount, the function will retrieve the latest invoice after the upgrade (Stripe creates one automatically with `always_invoice` proration).

---

### 3. Frontend Confirmation Flow (Pricing.tsx)
Instead of immediately calling `upgrade-subscription`, the "Upgrade" button will:
1. Call `preview-upgrade` to get the prorated charge amount
2. Show a confirmation dialog explaining:
   - "You'll be charged **$X.XX** now for the remainder of your billing period"
   - "Starting [next billing date], you'll be charged **$15/month**"
3. User clicks "Confirm & Pay" to proceed with the actual upgrade
4. Or "Cancel" to back out

---

### 4. Frontend Confirmation Flow (UpgradePlanDialog.tsx)
Same flow for the upgrade dialog used within circle settings:
- When upgrading from Family to Extended, show the preview first
- Free-to-paid upgrades continue using Stripe Checkout (no change needed)

---

### 5. Downgrade Flow Verification
The existing downgrade flow (`downgrade-subscription`) already uses `proration_behavior: "none"`, which means:
- User keeps Extended perks until the current billing period ends
- At renewal, they're charged $7/month for Family
- No changes needed here, but will verify the webhook handler (`customer.subscription.updated`) properly applies the plan change at period end

---

### Technical Details

**New file: `supabase/functions/preview-upgrade/index.ts`**
```text
- Authenticates user
- Finds their Stripe customer and active subscription
- Calls stripe.invoices.createPreview() with the new price
- Returns { prorated_amount, new_monthly_price, next_billing_date, plan_name }
```

**Modified: `supabase/functions/upgrade-subscription/index.ts`**
- After successful upgrade, retrieve the latest invoice to get actual charged amount
- Send receipt email via Resend with the prorated amount
- Receipt subject: "Your Familial Receipt - [Date]"
- Receipt body: shows "Upgrade to [Plan] (prorated)" and the charged amount

**Modified: `src/components/landing/Pricing.tsx`**
- Add state for upgrade preview data and confirmation dialog
- When user clicks "Upgrade" on a higher tier:
  1. Call `preview-upgrade` (show loading spinner)
  2. Open AlertDialog with charge breakdown
  3. On confirm, call `upgrade-subscription`
- Free-to-paid continues using `create-checkout` (Stripe hosted page)

**Modified: `src/components/circles/UpgradePlanDialog.tsx`**
- Same preview + confirm flow for Family-to-Extended upgrades
- Free-to-paid continues using `create-checkout`

**Config: `supabase/config.toml`**
- Add `[functions.preview-upgrade]` with `verify_jwt = false`

### Flow Summary

```text
User clicks "Upgrade" (Family -> Extended)
  -> Frontend calls preview-upgrade
  -> Shows dialog: "You'll be charged $5.33 now. 
     Starting March 15, you'll pay $15/month."
  -> User clicks "Confirm & Pay"
  -> Frontend calls upgrade-subscription
  -> Stripe charges prorated amount
  -> Receipt email sent to user
  -> UI updates to show new plan
```

```text
User clicks "Downgrade" (Extended -> Family)
  -> Confirmation dialog (already exists)
  -> Calls downgrade-subscription
  -> Stripe schedules price change at period end
  -> User keeps Extended perks until renewal
  -> At renewal: charged $7/month, plan switches to Family
```

