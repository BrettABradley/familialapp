
## Scope

Six security findings + the "wrong circle name in header after tapping a push notification" bug. Some findings will be fixed in code; one will be downgraded in the security memory with reasoning. I'll also call out what (if anything) you need to do in Xcode.

---

## 1. Errors to fix

### A. Circle members can read circle owners' full billing rows (`user_plans`)
**Fix:** Replace the broad "Circle members can view circle owner plan" SELECT policy with a `SECURITY DEFINER` RPC that returns only the safe columns members actually need (`max_members_per_circle`, `extra_members`-equivalent via circle row, plan name only).

Steps:
1. Drop policy `Circle members can view circle owner plan` on `public.user_plans`. Keep `Users can view own plan` (`auth.uid() = user_id`).
2. Create `public.get_circle_owner_limits(_circle_id uuid)` returning `(plan text, max_members_per_circle int)` — SECURITY DEFINER, search_path=public, asserts caller is a member or owner of `_circle_id`.
3. Update `src/lib/circleLimits.ts → getCircleMemberLimit` to call the RPC instead of selecting from `user_plans` for non-self owners. When the owner is the current user, keep the direct query (still allowed).
4. Audit other client reads of `user_plans` where `user_id !== auth.uid()` — none expected, but I'll grep `from("user_plans")` and migrate any that read another user's row.

Sensitive columns (`apple_original_transaction_id`, `comp_note`, `pending_plan`, `cancel_at_period_end`, etc.) become inaccessible to non-owners, which is the intent.

### B. `send-push-notification` has no auth
**Fix:** Require the service-role bearer at the top of the function. The DB trigger `trigger_push_notification` already calls it with `Authorization: Bearer <anon_key>` from the vault — I'll switch the trigger to use the **service-role** secret and update the function to reject anything that doesn't match `SUPABASE_SERVICE_ROLE_KEY`.

Concretely:
1. Edit `supabase/functions/send-push-notification/index.ts` to 401 unless `Authorization === \`Bearer ${SUPABASE_SERVICE_ROLE_KEY}\``.
2. Update vault secret used by `trigger_push_notification` from `SUPABASE_ANON_KEY` to `SUPABASE_SERVICE_ROLE_KEY` (or add `SUPABASE_SERVICE_ROLE_KEY` to vault if not present) and update the function body to read it.

Side benefit: blocks the spam/phishing vector flagged by the scanner.

### C. Apple IAP receipt validation falls back to unverified client JWS
**Fix:** Remove the `decodeClientJws` fallback in `validate-apple-receipt`. If the App Store Server API call fails, surface a clear error and let the client retry. To avoid breaking users during transient Apple outages, also:
- Log the failure with `verificationSource = "apple-server-api-failed"`.
- Return HTTP 503 (so the client UI can say "Apple is temporarily unreachable, try again") instead of silently activating the plan.

This closes the payment-bypass risk completely. Genuine StoreKit purchases stay valid because Apple's Server API verifies them — the only thing removed is the unsigned fallback.

### D. Admin moderation secret in email URLs
**Fix:** Replace the URL-embedded `ADMIN_MODERATE_SECRET` with a short-lived signed token.
1. Create table `public.moderation_action_tokens` (`token text PK`, `report_id uuid`, `action text`, `expires_at timestamptz`, `used_at timestamptz`). RLS denies all; only service role uses it.
2. `notify-content-report` generates a random 32-byte token per action (ban / dismiss), inserts a row with 7-day expiry, and embeds **only the token** in the email URL (no secret).
3. `moderate-reported-user` looks up the token, verifies not expired and not used, marks `used_at`, then performs the action. Existing `secret=` query param support stays for one release as a fallback, then is removed.
4. After deploy, rotate `ADMIN_MODERATE_SECRET` (you'll do this in Cloud → Secrets — I'll remind you in the closing message).

---

## 2. Warnings — handle pragmatically

### E. Realtime `ELSE true` policy
**Fix:** Tighten the first `realtime.messages` policy to an explicit allowlist of topic patterns we actually use (`private-messages:*`, `group-messages:*`, `bell-*-{uuid}`, plus any others present in code). Anything else → deny.

Approach: I'll grep `supabase.channel(` across `src/` to enumerate every topic name we subscribe to, then write the policy with exact prefix matches. CDC subscriptions on tables are unaffected (those use a separate policy path).

### F. `cleanup-rescue-offers` unauthenticated cron endpoint
**Fix:** Require `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` at the top. Update whatever pg_cron / scheduled invocation header to use the service role. Same pattern as fix B.

---

## 3. Push-notification deep-link circle mismatch

**Symptom:** Tapping a push that links to `/events?circle=X&eventId=Y` lands on the right page, but the header still shows the previously selected circle.

**Root cause:** `useDeepLinkCircleSync` waits for `circles.length > 0` and switches via `setSelectedCircle`. But:
1. On a cold app open from a push, the navigation happens via `window.history.pushState` + a synthesized `popstate` (`src/lib/pushNotifications.ts`). React Router picks up the path, but the header's `currentCircle = circles.find(...)` is computed against `selectedCircle` from `CircleContext`, which is seeded from `localStorage` and not updated until *after* circles load AND the URL `?circle=` is read.
2. Some notification types (DM, comment, mention pre-fix) don't include `?circle=` in `link`, so the hook never fires for them, leaving the wrong header on whatever page they land on.

**Fix:**
1. **CircleHeader truth-source:** When the current route's `?circle=` query param is present and matches a circle the user belongs to, the header should display *that* circle's name regardless of `selectedCircle` state. I'll thread the URL param through `CircleHeader` so the displayed name/avatar reflects the URL immediately, even before `setSelectedCircle` resolves.
2. **Backfill missing `?circle=` on notification links.** Audit triggers that create notifications without it (`notify_on_dm` is intentional — DMs are global). For mention / comment / fridge / album / event triggers, confirm `link` already includes `?circle=`. Where it doesn't (e.g. older `comment` notifications), add the param to the generating trigger.
3. **Sync on push tap explicitly.** In `pushNotifications.ts pushNotificationActionPerformed`, after `pushState`, also broadcast a `window.dispatchEvent(new CustomEvent('familial:deep-link', { detail: link }))`. `useDeepLinkCircleSync` already keys off `searchParams` so the popstate handles it — but I'll add a tiny effect that also re-reads `window.location.search` on that custom event for belt-and-suspenders.

Net result: header circle always = the circle of the content being shown.

---

## 4. What you need to do (Xcode / Cloud / external)

Nothing requires an Xcode rebuild. All changes are server-side or pure web code that ships through Lovable Cloud + the existing TestFlight bundle.

After I implement and you accept the changes, you'll need to do this in **Cloud → Secrets**:
- **Rotate `ADMIN_MODERATE_SECRET`** (one click — "Update secret" with a fresh random value). Old URL-embedded tokens become invalid; new tokens go through the DB table.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is present in the vault (it should be — the trigger needs it).

No App Store submission, no Apple Developer account change, no APNs key change.

---

## 5. Security memory updates

After fixes land I'll update `mem://security/...` with:
- New rule: "Push, cron, and webhook edge functions must validate `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` at top of handler."
- New rule: "Never embed secrets in email URLs. Use single-use DB-backed tokens."
- New rule: "Apple IAP must require server-side verification — no client-JWS fallback."
- Note that the `user_plans` exposure was tightened via SECURITY DEFINER RPC; future RLS policies must not expose billing columns to circle members.

Nothing will be "downgraded and ignored" — all six are getting fixed.

---

## Technical details

**Files I'll edit:**
- `supabase/migrations/<new>.sql` — drop+create user_plans policy, new `get_circle_owner_limits` RPC, new `moderation_action_tokens` table + RLS + grants, tighten `realtime.messages` policy, update `trigger_push_notification` to use service role secret.
- `src/lib/circleLimits.ts` — switch to RPC.
- `supabase/functions/send-push-notification/index.ts` — auth gate.
- `supabase/functions/cleanup-rescue-offers/index.ts` — auth gate.
- `supabase/functions/validate-apple-receipt/index.ts` — drop client JWS fallback, return 503.
- `supabase/functions/notify-content-report/index.ts` — generate token, drop secret from URL.
- `supabase/functions/moderate-reported-user/index.ts` — accept token, keep secret fallback for one release.
- `src/lib/pushNotifications.ts` — broadcast deep-link event.
- `src/hooks/useDeepLinkCircleSync.ts` + `src/components/layout/CircleHeader.tsx` — URL-param-driven header truth.
- Possibly trigger functions that produce notifications missing `?circle=` (only if grep shows any).

**Order of operations:** migration first (you approve), then code edits in one batch, then I'll ask you to rotate `ADMIN_MODERATE_SECRET`.
