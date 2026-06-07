# Warmer Onboarding + Smarter Deep Links

Make the first-time experience feel like welcoming a new family member, not "setting up an account." Rewrite the signup/welcome copy and rebuild `OnboardingFlow` as a warmer checklist where every step jumps directly to the right action.

## 1. Signup screen copy (`src/pages/Auth.tsx`, lines 580–608)

Replace the generic titles/descriptions with family-warm copy.

| State | Today | New |
|---|---|---|
| Sign-up title | "Join Familial" | "Start your family circle" |
| Sign-up subtitle | "Create an account to start your family circle" | "A private space for the people who matter most — no algorithms, no ads, just family." |
| Sign-in title | "Welcome" | "Welcome back" |
| Sign-in subtitle | "Sign in or sign up to connect with your family" | "Sign in to catch up with your family." |
| Verification sent title | "Check your email" | (unchanged) |
| Verification sent body | "We sent a verification link to finish setting up your account" | "We just sent a link to confirm it's really you. Open it on this device and we'll bring you right in." |
| Email confirmed | "Welcome to Familial" | "You're in. Let's get your family together." |

## 2. Rebuild `OnboardingFlow` (`src/components/shared/OnboardingFlow.tsx`)

Keep the existing modal-checklist shape (per your pick) but warm it up and make every action land in the right place.

**Visual + copy refresh**
- Title: `"Welcome to Familial 👋"` → **`"Let's get your family together"`** (Playfair serif, no emoji — matches the monochrome warm/nostalgic identity)
- Subtitle: **`"Three small steps so the people who matter most can find you here."`**
- Each step shows progress as `1 of 3 done` with a thin progress bar at the top.
- "Skip for now" stays, but it just hides the dialog this session — the checklist stays available (see #3) until completed.

**Step copy — family-warm**

| # | Today | New title | New subcopy |
|---|---|---|---|
| 1 | "Add a profile photo" | **"Add a photo of yourself"** | "So Mom, Dad, and the kids know it's you." |
| 2 | "Tell us about yourself" | **"What should family call you?"** | "Set the name your family will see — first name, nickname, 'Grammy', whatever feels right." |
| 3 | "Create or join a circle" | **"Start your first circle"** | "A circle is your private family space. Invite your people next." |

**Deep-link behavior (the real fix)**

Each step needs to land on the actual action, not just a page. The cleanest pattern that fits the codebase is a query-param hook the destination pages already-don't-but-will read:

- **Photo** → `navigate("/settings?open=avatar")` — `Settings.tsx` opens the `AvatarCropDialog` on mount when `?open=avatar` is present, then strips the param.
- **Display name** → `navigate("/settings?focus=displayName")` — `Settings.tsx` scrolls to and focuses the `#displayName` input on mount. (Re-using Settings rather than introducing a new dialog keeps the change small and avoids duplicating the save logic that already writes `display_name`.)
- **Circle** → `navigate("/circles?open=create")` — `Circles.tsx` sets `isCreateOpen = true` on mount when `?open=create` is present, then strips the param.

All three params get cleaned with `navigate(location.pathname, { replace: true })` after they fire so a refresh doesn't re-trigger the dialog.

**Done-state logic** stays the same (`hasAvatar`, `hasBio`, `hasCircles`) — but the second step's `done` becomes `hasDisplayName` (truthy `profile.display_name`) instead of `hasBio`, matching the new copy and your "Display name" pick. Bio stays as an optional Settings field, just not part of onboarding.

## 3. Lighter dismiss behavior

Today's dismiss is permanent (`localStorage onboarding_dismissed = true`), so a user who taps "Skip" never sees the checklist again even if they never finished. Change to a **per-session** hide:
- `sessionStorage onboarding_hidden_this_session = "1"` — gone on next app open.
- Once all three steps are actually `done`, set the permanent `localStorage onboarding_dismissed = "true"` so it doesn't reappear after completion.

`AppLayout` still controls when the modal mounts based on the three completion flags.

## 4. Files changed

- `src/pages/Auth.tsx` — copy refresh in the header block (lines 582–608)
- `src/components/shared/OnboardingFlow.tsx` — title/subcopy, deep-link query params, session-vs-permanent dismiss, `hasDisplayName` flag
- `src/components/layout/AppLayout.tsx` — pass `hasDisplayName={!!profile.display_name}` instead of `hasBio`
- `src/pages/Settings.tsx` — on mount, read `?open=avatar` (open `AvatarCropDialog`) / `?focus=displayName` (scroll + focus the input), then strip the param
- `src/pages/Circles.tsx` — on mount, read `?open=create` (set `isCreateOpen=true`), then strip the param

## 5. Verification

- Sign up → confirm email → onboarding modal shows the new warm copy.
- Tap **"Add a photo"** → lands on Settings with the avatar cropper open.
- Tap **"What should family call you?"** → lands on Settings with the Display Name input focused and scrolled into view.
- Tap **"Start your first circle"** → lands on Circles with the Create Circle dialog open.
- Hit "Skip for now" → modal closes for the session; reopens on next app launch until all three are complete.
- Complete all three → modal disappears permanently.

## Out of scope

- No new bio fields, relationship picker, birthday, or invite-family step (you didn't pick those).
- No full-screen wizard or persistent inline checklist.
- No DB schema changes — `display_name` already exists on `profiles`.
