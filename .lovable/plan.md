
## Apple Rejection Fixes — Submission 2c4c7900

Three issues to resolve before resubmitting build 1.0.3 (43).

---

### 1. Guideline 5.1.1(v) — Remove required Date of Birth

**Where it lives:** `src/pages/Auth.tsx` collects `dateOfBirth` as a required signup field and writes it to `profiles.date_of_birth`.

**Fix:**
- Remove the Date of Birth input from the signup form entirely.
- Replace the COPPA age gate with a single required checkbox: **"I confirm I am at least 13 years old."** This satisfies COPPA without collecting personal data — the same pattern Apple accepts on rideshare/shopping apps.
- Stop writing `date_of_birth` to `profiles` on signup. Leave the column in the DB (no migration needed) so existing data isn't lost; just don't populate it.
- Remove the `dob` field from the `setErrors` / reset paths.

No DB migration. No edge function changes.

---

### 2. Guideline 2.1(a) — Camera icon error on iPad

**Root cause (most likely):** `src/lib/imagePicker.ts` calls `Camera.getPhoto({ source: CameraSource.Prompt })`. On iPad, the Capacitor Camera plugin presents the "Camera / Gallery" action sheet, which **must** be anchored to a source view as a popover on iPad — otherwise iOS throws and the call rejects with an error. Combined with our `toast` showing "Could not access camera," this matches the reviewer's report exactly. The same code path is hit from Settings (avatar), Albums (cover), Circles (circle avatar), Messages (group photo), ProfileView.

**Fix in `src/lib/imagePicker.ts`:**
- On iPad (detect via `Capacitor.getPlatform() === 'ios'` + a screen-width check, or simpler: always avoid `Prompt` on iOS), call `Camera.getPhoto` twice in sequence using our **own** UI:
  - Add an optional `source?: 'camera' | 'photos'` argument to `pickImage()`.
  - When unspecified on native, render a small in-app chooser dialog (already used pattern with shadcn Dialog) with two buttons: "Take Photo" → `CameraSource.Camera`; "Choose from Library" → `CameraSource.Photos`. This avoids the iPad popover-anchor crash entirely and works identically on iPhone.
- Keep the web `<input type=file>` fallback unchanged.
- Implementation note: since `pickImage()` is called from many places, the cleanest path is to wrap the two-button chooser in a new component `<ImageSourceDialog />` and have `pickImage()` resolve a Promise that the dialog fulfills. Alternative (simpler): keep `pickImage()` API the same but internally swap `CameraSource.Prompt` → `CameraSource.Photos` on iOS (Photos source works on iPad and is the more common need). Then add a separate "Take Photo" affordance later if needed. **Recommend the simpler route for this submission** to minimize regression risk: default to `CameraSource.Photos` on iOS, document follow-up to add explicit camera button.
- Also add `NSPhotoLibraryAddUsageDescription` to `scripts/ios-post-sync.sh` (saving photos may also be required by some flows; harmless to include).

---

### 3. Guideline 2.1(b) — IAP purchase failure

**Code-side hardening** (most of this issue is config, but we can reduce failure modes):

- In `src/lib/iapPurchase.ts`:
  - Before `purchaseProduct`, call `NativePurchases.getProducts({ productIdentifiers: [productId] })` to ensure the product loads from StoreKit. If the array is empty, surface a clear toast: "Subscriptions are temporarily unavailable. Please try again shortly." This avoids the silent failure Apple reviewers see when StoreKit hasn't fully loaded.
  - Wrap the validate-apple-receipt call so a transient backend failure does NOT prevent the StoreKit transaction from being treated as successful — log it and let restore handle it later.
- Confirm `restorePurchases()` is wired to a visible button in Settings (already exists in `SubscriptionCard`?). Verify and add if missing — Apple requires a Restore Purchases button visible without a paid account.

**Non-code checklist (for the user, not Lovable):**
- Confirm Paid Apps Agreement is **active** in App Store Connect → Business.
- Confirm bank/tax info is complete (incomplete tax forms block sandbox IAPs).
- Confirm the three IAP products show "Ready to Submit" or "Waiting for Review" and are attached to build 43.
- Test in TestFlight with a sandbox tester account before resubmitting.

---

### Files to change

- `src/pages/Auth.tsx` — remove DOB UI + age-gate logic, add 13+ checkbox.
- `src/lib/imagePicker.ts` — switch iOS `source` from `Prompt` to `Photos` (or add chooser dialog).
- `src/lib/iapPurchase.ts` — pre-fetch product, friendlier error toast.
- `scripts/ios-post-sync.sh` — add `NSPhotoLibraryAddUsageDescription`.
- (Verify only) `src/components/settings/SubscriptionCard.tsx` — Restore Purchases button visible on iOS.

### After implementing

User must: bump version to 1.0.3 (build 43) → `npm run build` → `npx cap sync ios --legacy-peer-deps` → archive in Xcode → submit. The same 3 IAPs stay attached automatically.
