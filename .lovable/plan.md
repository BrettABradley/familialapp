## Goal

Make the circle invite email adapt to whether the recipient already has a Familial account:

- **No account** → copy: "{Inviter} is inviting you to join {Circle} on Familial." CTA "Sign up" links to `/auth?mode=signup&email={invitedEmail}`.
- **Has account** → copy: "{Inviter} has invited you to {Circle} on Familial." CTA "Log in" links to `/auth?mode=login&email={invitedEmail}`.

## Changes

### 1. `supabase/functions/send-circle-invite/index.ts`
- We already do an admin lookup that sets `targetUser` (line 141). Reuse that as the `hasAccount` flag.
- Build two link variants:
  - `signupUrl = https://familialmedia.com/auth?mode=signup&email=<encoded>`
  - `loginUrl  = https://familialmedia.com/auth?mode=login&email=<encoded>`
- Branch the email `subject`, headline, body sentence, CTA label, and CTA href on `hasAccount`:
  - Signup variant: heading "You're invited", body "{Inviter} is inviting you to join {Circle} on Familial.", button "Sign up", footer keeps "Once you sign up with this email address ({email}), you'll automatically be connected to the circle."
  - Login variant: heading "You've been invited to a new circle", body "{Inviter} has invited you to {Circle} on Familial.", button "Log in", footer "Log in with {email} to accept the invite."
- Update both the HTML and plain-text bodies symmetrically.
- No DB schema changes. No new env vars.

### 2. `src/pages/Auth.tsx`
- Read `mode` and `email` from `useSearchParams`.
- On mount:
  - If `mode === "signup"` → `setIsLogin(false)`.
  - If `mode === "login"` → `setIsLogin(true)` (already default, but explicit).
  - If `email` is present and looks valid → `setEmail(decoded)` to prefill the field. Leave editable (don't lock — user may still want to correct).
- No change to submit logic; the prefill just seeds existing state.

### 3. Deploy
- Deploy `send-circle-invite` edge function so the new email copy goes live.

## Out of scope
- No change to the in-app PendingInvites flow.
- No new "circleId carried through signup" plumbing — the existing post-signup auto-attach via matching email continues to work.
- Not changing the unsubscribe footer or token logic.

## Risk / edge cases
- Admin `listUsers()` is already used here, so detection accuracy is unchanged.
- If a user has an account but is signed out in Chrome, the "Log in" link still works — they land on the login form with email prefilled.
- Existing pending invites already in the queue were sent under the old copy; nothing to migrate.
