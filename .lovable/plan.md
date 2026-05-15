# Final Apple Resubmission Plan — v1.0.4 (build 44)

Two rejections to clear: **3.1.2(c)** (missing subscription disclosures + EULA/Privacy links at point of purchase) and **2.1(b)** ("Cannot find product" on iPad). Code fixes below; manual App Store Connect steps at the bottom — both halves must ship together or the rejection will repeat.

---

## Part A — Subscription disclosures (3.1.2(c))

Create one shared component so every IAP entry point shows identical, reviewer-proof copy.

**New file: `src/components/shared/SubscriptionDisclosure.tsx`**
- Reusable block, two variants via prop: `variant="full"` (used on Pricing page) and `variant="compact"` (used inline under each Buy/Upgrade button in dialogs).
- Full variant content:
  - Heading: "Auto-renewable subscriptions"
  - Family — $7.00 USD / month, renews monthly until canceled
  - Extended — $15.00 USD / month, renews monthly until canceled
  - Length of subscription: 1 month
  - "Payment is charged to your Apple ID at confirmation. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID Settings → Subscriptions."
  - Two `<Link>`s (react-router-dom): **Terms of Use (EULA)** → `/terms-of-service`, **Privacy Policy** → `/privacy-policy`.
- Compact variant: single line — "Auto-renews monthly until canceled. " + EULA + Privacy links. Used inline.
- Monochrome `text-muted-foreground text-xs`, no decoration that breaks the brand.

**Wire it in three places:**
1. `src/components/landing/Pricing.tsx` — render `<SubscriptionDisclosure variant="full" />` directly above the pricing card grid (not in a collapsed accordion — must be visible without scrolling on iPad).
2. `src/components/circles/UpgradePlanDialog.tsx` — render `<SubscriptionDisclosure variant="full" />` at the bottom of the `DialogContent`, after the options list.
3. `src/components/circles/CircleRescueDialog.tsx` — render `<SubscriptionDisclosure variant="compact" />` inside the `DialogFooter` area, under the Take Over button.

Also add the compact variant under each per-tier upgrade button on iOS in `UpgradePlanDialog` (visible at the literal moment of tap).

---

## Part B — Harden IAP product loading (2.1(b))

**`src/lib/iapPurchase.ts`**
- Add exported `prewarmProducts()` — calls `NativePurchases.getProducts({ productIdentifiers: [family, extended, extraMembers] })` once, returns the parsed product list, and caches it in module scope so subsequent calls are instant.
- Add exported `getCachedProducts()` returning the cached list (or null).
- Bump `ensureProductLoaded` to **3 attempts** with **800 ms → 1500 ms** backoff (currently 2 attempts / 800 ms).
- Improve thrown error: when getProducts returns empty after all retries, throw "This subscription isn't available from the App Store right now. Make sure you're signed in with a valid Apple ID, then try again." (instead of generic "still loading").
- Add a `console.log("[IAP][diag]", { platform, productIds, attempt, rawResponse })` on each attempt so the device console (and App Review logs) leave a paper trail.

**Pre-warm on mount in three places** — call `prewarmProducts()` inside a `useEffect` (iOS-only via `isIOSNative()`):
1. `Pricing.tsx`
2. `UpgradePlanDialog.tsx` (when `isOpen` becomes true)
3. `CircleRescueDialog.tsx` (when `open` becomes true)

**Render live StoreKit prices on iOS.** When pre-warm returns products, store them in local state and substitute `product.localizedPrice` / `product.priceString` into the tier card price line in place of the hard-coded "$7/month" / "$15/month". On web (non-iOS) keep the hard-coded strings. This both:
- Proves to the reviewer that StoreKit successfully returned products (kills 2.1(b) cold).
- Satisfies the 3.1.2(c) requirement to display Apple-validated localized prices at point of purchase.

---

## Part C — What you need to do in App Store Connect (manual, blocking)

These are non-negotiable. If any one is missing the IAP rejection returns regardless of code:

1. **Paid Apps Agreement → Active.** App Store Connect → Business → Agreements, Tax, and Banking. Status must read **Active**, not Pending. (This is the single most common cause of "Cannot find product".)
2. **All 3 IAPs attached to build 44.** Open the 1.0.4 version page → scroll to **In-App Purchases and Subscriptions** → click the **+** → add all three:
   - `com.familialmedia.familial.family.monthly`
   - `com.familialmedia.familial.extended.monthly`
   - `com.familialmedia.familial.extramembers`
   Each must show status **Ready to Submit** (yellow dot is fine — they get reviewed alongside the binary).
3. **EULA.** App Information → **License Agreement** → either keep Apple's standard EULA (default) or paste your custom one. If keeping the default, also reference it in the App Description footer: "Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
4. **Privacy Policy URL.** App Information → Privacy Policy URL → `https://familialmedia.com/privacy-policy`
5. **App Review notes** — paste verbatim into the Notes field on the version page:
   > Subscription disclosures (length, price, auto-renewal terms) and functional Terms of Use (EULA) + Privacy Policy links are now visible on the Pricing page and inside both upgrade dialogs (UpgradePlanDialog and CircleRescueDialog). Live App Store-validated prices render automatically once StoreKit returns products. All 3 IAP products are attached to this build.
6. **Verify on iPad before submitting.** Install the TestFlight build on an iPad signed into a Sandbox tester account, open Pricing, confirm prices render as "$7.00" / "$15.00" (not "loading…"), tap Upgrade, confirm the Apple sheet appears. If the sheet shows "Cannot connect to iTunes Store" → Paid Apps Agreement is still pending; do not resubmit.

---

## Files touched

- **New:** `src/components/shared/SubscriptionDisclosure.tsx`
- **Edit:** `src/lib/iapPurchase.ts` (prewarm, cache, retry, diagnostics, better error)
- **Edit:** `src/components/landing/Pricing.tsx` (disclosure block + iOS prewarm + live prices)
- **Edit:** `src/components/circles/UpgradePlanDialog.tsx` (disclosure + prewarm + live prices)
- **Edit:** `src/components/circles/CircleRescueDialog.tsx` (compact disclosure + prewarm)

No backend, schema, or edge function changes. No new dependencies.

---

## Order of operations on resubmission day

1. Approve this plan → I ship the code.
2. You bump version to **1.0.4 / build 44**, run `npx cap sync ios --legacy-peer-deps`, archive in Xcode, upload.
3. While the build processes (~30 min), you complete the 6 App Store Connect items above.
4. Attach build 44, paste the review notes, submit.
5. Optional but recommended: TestFlight smoke test on iPad first (step 6 above).
