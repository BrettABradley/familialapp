## Goal

1. Make Terms of Service acceptance happen **on the signup form** (compliance: agreement before account creation), keeping the post‑login TOS dialog only as a fallback for legacy accounts.
2. Replace the silent "Check your email" toast with a **dedicated verification‑pending screen**, and when the user returns from the email link, show a **green checkmark success state** before dropping them into the app.

## Changes

### 1. Signup form — inline TOS acceptance (`src/pages/Auth.tsx`)

- Add a second checkbox below the age checkbox (signup only):
  > "I agree to the [Terms of Service](/terms) and [Privacy Policy](/privacy)."
- New state `tosAccepted`. Submit blocked (with inline error) until checked.
- After `signUp()` succeeds, immediately record acceptance so the post‑login TOS dialog does not re‑prompt:
  - Stash `{ accepted_terms_at, accepted_terms_version: "2026-05-17", email }` in `sessionStorage` under `pendingTermsAcceptance`.
  - On first authenticated session (in `TermsAcceptanceGate`), if that stash matches `auth.user.email`, upsert to `user_private` and clear the stash. (Can't upsert at signup time — user isn't authenticated until email confirm.)

### 2. Dedicated "verification email sent" screen (`src/pages/Auth.tsx`)

- New local state `verificationSentTo: string | null`. On successful signup, set it to the email instead of toasting + flipping to login.
- When set, the `<Card>` body renders a verification panel instead of the form:
  - Large mail icon, heading "Check your email", body "We sent a verification link to **{email}**. Open it on this device to finish setting up your account."
  - "Resend email" button (calls `supabase.auth.resend({ type: 'signup', email })`) with the existing 60s cooldown pattern.
  - "Use a different email" link → clears state, returns to signup form.
- Persist `verificationSentTo` in `sessionStorage` so refreshing the Auth tab keeps the panel.

### 3. Green‑checkmark confirmation on return (`src/pages/Auth.tsx`)

- Add an `onAuthStateChange` listener on the Auth page (only while unauthenticated UI is mounted). When event is `SIGNED_IN` and `verificationSentTo` (or stored value) matches `session.user.email`:
  - Swap the Card content for a success state: large animated green `CheckCircle2`, "Email confirmed!", subtext "Welcome to Familial".
  - After ~1.5s, clear `verificationSentTo`, navigate to `/circles` (or `/upgrade` if `planParam` present — keep existing checkout redirect logic untouched).
- If the user instead clicks the email link on a different device, the existing redirect path still works — the post‑login flow shows `TermsAcceptanceGate` (no‑op because we stashed acceptance) → `OnboardingFlow` ("Let's get started").

### 4. TermsAcceptanceGate — honor pre‑accepted stash (`src/components/shared/TermsAcceptanceGate.tsx`)

- On mount, before deciding `needsAcceptance`, check `sessionStorage.pendingTermsAcceptance`. If present and email matches `user.email`, write it to `user_private` immediately and skip the dialog.
- Legacy users without a current accepted version still see the existing dialog (unchanged).

## Technical Notes

- No DB migration needed — `user_private.accepted_terms_at` / `accepted_terms_version` already exist.
- Uses existing `supabase.auth.resend()`; rate‑limit reuses `RESET_COOLDOWN_SECONDS` pattern under a new key (`lastVerificationResendAt`).
- The success state and the verification panel both live inside the existing Auth Card to keep mobile layout, safe‑area padding, and keyboard handling intact.
- No changes to `OnboardingFlow` — it still runs after auth + TOS, providing the "Let's get started" steps the user described.

## Out of scope

- Auth email template wording (uses current template; only the in‑app return flow changes).
- Server‑side enforcement of TOS at signup — Supabase signup endpoint has no metadata hook for this; the stash + gate combination guarantees acceptance is persisted before any app interaction.