## Goal

Revert the signup‑form TOS checkbox. TOS acceptance stays where it already lives: a gate that appears **after email verification** and **before** the "Let's create your first circle" onboarding prompt — already implemented by `TermsAcceptanceGate` wrapping `OnboardingFlow` in `AppLayout`.

Keep all other recent changes (dedicated "Check your email" panel, resend, green‑checkmark success state).

## Changes

### 1. `src/pages/Auth.tsx`
- Remove the TOS checkbox UI from the signup form.
- Remove `tosAccepted` state, its `tos` error field, and the `tos` validation branch in `handleSubmit`.
- Remove the `sessionStorage.setItem(PENDING_TERMS_KEY, ...)` stash on signup success (no longer needed — TOS is collected post‑verify).
- Remove the `Link` import and `PENDING_TERMS_KEY` constant if unused after the cleanup.
- Drop the `setTosAccepted(false)` call from the login/signup toggle handler.
- Keep `ageConfirmed` checkbox (COPPA 13+) — that stays at signup.

### 2. `src/components/shared/TermsAcceptanceGate.tsx`
- Remove the `pendingTermsAcceptance` sessionStorage shortcut added previously.
- Restore the original behavior: query `user_private`, show the TOS dialog if the current version isn't accepted. Gate runs after sign‑in and before `OnboardingFlow` (existing AppLayout order).

## Resulting flow (post‑fix)

1. User fills signup form (age‑13+ checkbox only) → submits.
2. "Check your email" panel appears with resend / different email.
3. User taps verification link → returns authenticated → green checkmark → routed in.
4. `TermsAcceptanceGate` dialog: **Accept TOS / Privacy / Community Standards**.
5. `OnboardingFlow`: **"Welcome to Familial! Let's get you set up"** → create first circle, etc.

## Out of scope

- No DB or `OnboardingFlow` changes.
- No edits to the verification panel or green‑check confirmation (those were correct).