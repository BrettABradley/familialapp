# Big Batch Fixes

## 1. Maps deep link opens web instead of Apple/Google Maps app
**Where:** `src/lib/externalUrl.ts` / `EventLocationPopover.tsx`

On iOS, `https://maps.apple.com` is supposed to be a universal link, but Capacitor's `App.openUrl` with `https://` often gets handed to the in-app webview / Safari instead of the Maps app. Same with Google Maps.

**Fix:**
- Add a new helper `openMapsApp(app: "apple" | "google", query)` that uses native URL schemes first:
  - Apple Maps: `maps://?q=<query>` (iOS only)
  - Google Maps: `comgooglemaps://?q=<query>&views=traffic` on iOS, `geo:0,0?q=<query>` on Android
- Use `Capacitor.getPlatform()` + `App.canOpenUrl({ url })` to detect availability.
- Fallbacks (in order):
  - Apple Maps unavailable on Android → use Google Maps web/app instead.
  - Google Maps app unavailable → open App Store / Play Store deep link (`itms-apps://apps.apple.com/app/id585027354` for Google Maps, store page for Apple Maps doesn't apply since it's preinstalled on iOS).
  - Final fallback: `https://maps.apple.com/?q=` or `https://www.google.com/maps/search/?api=1&query=`.
- Update `EventLocationPopover.openMaps()` to call this new helper.

## 2. Push notification to messages traps the user
**Where:** `src/pages/Messages.tsx` chat view (DM + group), `src/lib/capacitorInit.ts` (deep-link handler)

When a push notification opens a chat directly via deep link, `chatView` is set to `"dm"` / `"group"` but the bottom nav and back button stop working because the chat is rendered as `fixed inset-0 z-[60]`. There is no Android hardware-back handler or fallback navigation.

**Fix:**
- In the chat view headers, ensure the back button always:
  - Clears `selectedUser` / `selectedGroup` and sets `chatView="list"`.
  - If opened directly via deep-link (no prior list state), `navigate("/messages")` and then to `/circles` as a fallback.
- Add a Capacitor `App.addListener('backButton', ...)` in `Messages.tsx` (active only when `chatView !== "list"`) that calls the same back handler. This is the actual cause of the "trapped" feeling on Android and on iOS when the gesture is intercepted.
- Make sure the deep-link handler in `capacitorInit.ts` doesn't block the bottom nav by routing to `/messages?dm=<id>` (route-based) instead of locking state; `Messages.tsx` reads the query param and opens the chat — then the user can navigate away normally.

## 3. Cannot leave message chats (even when alone)
**Where:** `handleLeaveGroup` in `Messages.tsx`, plus RLS on `group_chat_members`

The current implementation does a direct `DELETE` on `group_chat_members`. If RLS doesn't allow the user to delete themselves, this silently freezes (no error toast triggers because policy rejects). We also need the creator-only case where the user is the only member.

**Fix:**
- Add a SECURITY DEFINER RPC `leave_group_chat(_group_chat_id uuid)` that:
  - Removes `auth.uid()` from `group_chat_members`.
  - If the chat now has 0 members, deletes the `group_chats` row and any messages.
- Update `handleLeaveGroup` to call this RPC.
- Add proper error toast + closing of the leave dialog before navigation so the UI never freezes.
- Also wrap the dialog close in `try/finally` so a network error still re-enables the button.

## 4. Messages: images/voice notes show as "(Attachment)" and download instead of opening
**Where:** `renderMediaAttachments` in `Messages.tsx`

Two issues:
- Text shows "(attachment)" when there is media — should be hidden if media exists and content is the default.
- Tapping an image calls `handleMediaDownload` instead of opening a lightbox. On iOS Capacitor this triggers a save to Camera Roll.

**Fix:**
- Hide the message text when `content === "(attachment)"` (case-insensitive) and `media_urls.length > 0`.
- Replace the image `onClick={handleMediaDownload}` with a `ZoomableImage`/lightbox open (re-use `src/components/shared/ZoomableImage.tsx` pattern already used in Feed/Albums). Add a separate explicit Download button inside the lightbox (long-press friendly).
- Voice notes already render `<audio controls>` — confirm `getMediaType` correctly tags `voice-note-*` blobs as `audio`. The previous fix already addresses MP4-as-audio detection; verify it covers `audio/webm`, `audio/mp4`, `audio/m4a`.

## 5. Email verification required before access (magic link → app)
**Where:** `useAuth.tsx`, `Auth.tsx`, `capacitorInit.ts`, Supabase auth config, `auth-email-hook`

We need to actually require email confirmation for new signups, and the magic link must deep-link back into the iOS app.

**Fix:**
- Disable `auto_confirm_email` in Supabase auth config (currently signups are auto-confirmed).
- Signup flow:
  - `signUp()` sets `emailRedirectTo: "https://familialmedia.com/auth/callback"` (universal link configured in iOS `apple-app-site-association` → already deep-links to app via existing Capacitor universal links setup).
  - On success → show a "Check your email" screen explaining the verification flow.
- Add a `/auth/callback` route that:
  - On web: shows a confirmation card "Your email is verified — open Familial in the app or [Continue to web]".
  - On native (via deep-link): Capacitor's `appUrlOpen` already handles this; route to `/circles`.
- Gate the app: `AppLayout` / `RequireAuth` already checks session, but add a check on `user.email_confirmed_at`. If missing → redirect to `/auth?unverified=1` with a "Resend verification email" button.
- Keep the auth email branded by re-using existing `auth-email-hook` and the `signup.tsx` template — confirm the template's `confirmationUrl` points to the universal link.
- Address keyboard issues in `Auth.tsx`:
  - Wrap auth form in `ScrollArea` with `pb-32` so submit button stays above keyboard.
  - Use `scroll-margin-bottom` on inputs as we do elsewhere.

## 6. Cannot decline circle invitation
**Where:** `PendingInvites.tsx` + RLS on `public.circle_invites`

The decline UPDATE is being silently blocked by RLS — the invitee likely has no UPDATE policy (only the inviter does). Currently the error toast may fire but the row never updates.

**Fix:**
- Add a SECURITY DEFINER RPC `decline_circle_invite(_invite_id uuid)` that:
  - Verifies the calling user's email matches `circle_invites.invitee_email`.
  - Sets `status = 'declined'`.
- Update `handleDecline` to call the RPC.
- Same treatment for accept if it has the same issue (will verify during implementation).

## 7. Enterprise welcome email
**Where:** new template under `supabase/functions/_shared/transactional-email-templates/`, plus trigger point

We already have `enterprise-welcome.tsx`. It is not actually sent anywhere.

**Fix:**
- Update copy to match the requested wording: "Thank you so much for choosing Familial Enterprise to help connect your community. We will not let you down and are always here to support. Contact me directly at brett@familialmedia.com if you have any questions or issues."
- Add a trigger: when an admin marks a user's plan as `enterprise` via the admin dashboard, call `send-transactional-email` with `templateName: "enterprise-welcome"`. (Confirm exact admin code path during implementation — likely `admin-manage-users` or a subscription update edge function.)

---

## Technical Notes

- All RPCs use `SECURITY DEFINER` with `SET search_path = public` and explicit GRANT to `authenticated`.
- New `/auth/callback` page must be in the SPA router (works automatically via Lovable SPA fallback).
- Plist (`scripts/ios-post-sync.sh`) needs `LSApplicationQueriesSchemes` entries for `maps`, `comgooglemaps`, `itms-apps` so `App.canOpenUrl` returns true on iOS — will add to that script.
- For the email gate, `email_confirmed_at` is on `auth.users` and accessible via `session.user.email_confirmed_at`, so no DB changes needed.

## Out of Scope (for this batch)
Anything not listed above — including the additional issues you mentioned saving for the next round.
