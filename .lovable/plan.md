

# Apple App Store Review Fixes — 3 Guidelines

## Issue 1: Guideline 2.1(a) — Demo Account Needs Invite Code

The review account (appreview@familialapp.com) exists with a "Demo Family" circle, but Apple needs the **invite code** for that circle provided in App Store Connect's App Review Information section.

**Action (no code change needed):** Log in as the review account, copy the Demo Family circle's invite code, and paste it into the App Review Information notes field in App Store Connect alongside the credentials. If the invite code has expired or been refreshed, generate a new one.

---

## Issue 2: Guideline 3.1.1 — In-App Purchase Required

The app uses Stripe web checkout for subscriptions (Family $7/mo, Extended $15/mo), which Apple rejects. On iOS, subscriptions must go through Apple's In-App Purchase (StoreKit).

**Approach:** Platform-detect on iOS (Capacitor native) and swap Stripe checkout for StoreKit IAP. On web, keep Stripe as-is.

### Changes

1. **Create IAP products in App Store Connect** — configure two auto-renewable subscriptions matching the existing tiers (Family, Extended) in a single subscription group.

2. **New file: `src/lib/iapPurchase.ts`**
   - Use `@capawesome/capacitor-in-app-purchases` (or `cordova-plugin-purchase` via Capacitor) to handle StoreKit flows
   - Export `initializeIAP()`, `purchaseSubscription(productId)`, `restorePurchases()`
   - After a successful purchase, call a new edge function to validate the receipt server-side

3. **New edge function: `supabase/functions/validate-apple-receipt/index.ts`**
   - Receives the Apple transaction receipt from the client
   - Validates with Apple's App Store Server API (v2)
   - On success, updates `user_plans` table (same as Stripe webhook does today)
   - Needs `APPLE_SHARED_SECRET` or App Store Server API key as a secret

4. **Modify `src/components/landing/Pricing.tsx`**
   - Import `Capacitor.isNativePlatform()` and `Capacitor.getPlatform()`
   - When platform is `ios`, replace the Stripe checkout CTA with `purchaseSubscription(appleProductId)`
   - Add "Restore Purchases" button on iOS
   - Keep Stripe flow for `web` and `android`

5. **Modify `src/pages/Settings.tsx`** (subscription management)
   - On iOS, link to Apple subscription management (`itms-apps://apps.apple.com/account/subscriptions`) instead of Stripe customer portal

6. **New edge function: `supabase/functions/apple-server-notifications/index.ts`** (optional but recommended)
   - Webhook endpoint for Apple Server-to-Server notifications (renewals, cancellations, refunds)
   - Updates `user_plans` accordingly

### Database migration
- Add `apple_original_transaction_id` column to `user_plans` to track Apple subscriptions alongside Stripe

---

## Issue 3: Guideline 1.2 — User-Generated Content Safety

The app has AI moderation (auto-removes flagged content) and Terms of Service, but is missing: EULA acceptance gate, user-facing report/flag, block user, and visible enforcement.

### 3a. EULA/Terms Acceptance Gate

**New file: `src/components/shared/TermsAcceptanceGate.tsx`**
- On first login (or if `accepted_terms_at` is null), show a modal requiring the user to accept Terms of Service before accessing any UGC
- Terms must explicitly state "no tolerance for objectionable content or abusive users"

**Database migration:** Add `accepted_terms_at timestamptz` column to `profiles` table.

**Modify `src/App.tsx`** — wrap authenticated routes with the acceptance gate.

### 3b. Flag/Report Content

**Modify `src/components/feed/PostCard.tsx`**
- Add a "Report" option (Flag icon) in the post actions area (visible to non-authors)
- Opens a simple report dialog with reason categories (Inappropriate, Harassment, Spam, Other)
- Inserts into a new `content_reports` table

**Database migration:** Create `content_reports` table:
```sql
CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  post_id uuid,
  comment_id uuid,
  user_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
```
With RLS: reporters can insert (own id), admins can view.

### 3c. Block Users

**Database migration:** Create `blocked_users` table:
```sql
CREATE TABLE blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
```

**Modify `src/components/feed/PostCard.tsx`** and **`src/pages/ProfileView.tsx`**
- Add "Block User" option; triggers insert + auto-creates a content report notifying the developer
- Blocked users' posts/comments are filtered from the blocker's feed immediately

**Modify `src/hooks/useFeedPosts.ts`**
- Fetch blocked user IDs and filter them out of post results client-side

**New edge function: `supabase/functions/handle-block/index.ts`**
- Inserts block record, creates a content report, and sends an email notification to `support@support.familialmedia.com` about the block (satisfies "blocking should notify the developer")

### 3d. 24-Hour Enforcement Commitment
- Already partially met by AI auto-moderation
- Add documentation in App Store Connect notes explaining the automated system + manual review process

---

## Summary of Files

| File | Action |
|------|--------|
| App Store Connect | Add invite code + review notes |
| `src/lib/iapPurchase.ts` | New — StoreKit IAP wrapper |
| `supabase/functions/validate-apple-receipt/index.ts` | New — receipt validation |
| `src/components/landing/Pricing.tsx` | Modify — iOS IAP flow |
| `src/pages/Settings.tsx` | Modify — iOS subscription mgmt link |
| `src/components/shared/TermsAcceptanceGate.tsx` | New — EULA gate |
| `src/App.tsx` | Modify — wrap with terms gate |
| `src/components/feed/PostCard.tsx` | Modify — add Report + Block |
| `src/pages/ProfileView.tsx` | Modify — add Block option |
| `src/hooks/useFeedPosts.ts` | Modify — filter blocked users |
| `supabase/functions/handle-block/index.ts` | New — block + notify |
| Database migrations | `accepted_terms_at`, `content_reports`, `blocked_users`, `apple_original_transaction_id` |

