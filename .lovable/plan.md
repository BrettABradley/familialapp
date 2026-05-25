# Wave 2 — Security Hardening Plan

Two scanner findings remain. Both are real, both touch code paths used across the app, so this wave is more invasive than Wave 1. The plan is built around **not breaking anything currently working**.

---

## Finding 1 — Sensitive profile fields exposed to circle peers

`profiles` is readable by anyone who `shares_circle_with` the row owner. That exposes:
`date_of_birth`, `two_factor_enabled`, `account_status`, `suspended_until`, `spam_reporter`, `accepted_terms_version`, `accepted_terms_at`.

### Why a "view + column-list" rewrite is too risky here
The app reads profiles in many places with `select("*")` (Messages, CircleMembers, Events, CircleContext, Circles, CampfireDialog, etc.). Forcing every call site to switch to a view or explicit column list is a large surface area and easy to regress.

### Chosen approach — split sensitive columns into a private sibling table
Create `public.user_private` keyed by `user_id` (1:1 with profiles). Move the seven sensitive columns there. RLS: **self-only** SELECT/UPDATE; service role full access. `profiles` stays peer-readable but with all sensitive columns gone, so `select("*")` is automatically safe.

### Migration steps (single migration)
1. `CREATE TABLE public.user_private (user_id uuid PK references nothing, date_of_birth date, two_factor_enabled bool default false, account_status text default 'active', suspended_until timestamptz, spam_reporter bool default false, accepted_terms_version text, accepted_terms_at timestamptz, updated_at timestamptz default now())`.
2. Backfill: `INSERT INTO user_private SELECT user_id, date_of_birth, two_factor_enabled, account_status, suspended_until, spam_reporter, accepted_terms_version, accepted_terms_at FROM profiles`.
3. Update `handle_new_user()` trigger to also insert a `user_private` row.
4. Update `redirect_spam_reporter()` to read `spam_reporter` from `user_private`.
5. Update `check_banned_email()` — unaffected (uses banned_emails).
6. Enable RLS on `user_private`:
   - SELECT: `user_id = auth.uid()`
   - UPDATE: `user_id = auth.uid()` (but restrict which columns the user can self-update — see below)
   - INSERT: self only (handled by trigger; user policy `user_id = auth.uid()`)
7. Add a BEFORE UPDATE trigger on `user_private` that blocks non-service-role updates to `account_status`, `suspended_until`, `spam_reporter` (only admin edge functions / triggers should write those — they run as service role so `auth.uid() IS NULL` passes through).
8. `ALTER TABLE profiles DROP COLUMN` for the seven fields **last**, after code is updated. To stay safe, do this in the same migration but after backfill — Supabase types regenerate automatically.

### Code updates (frontend)
- `src/pages/Settings.tsx`: `two_factor_enabled` read/write → `user_private`. Terms write (already in TermsAcceptanceGate).
- `src/components/auth/TwoFactorGate.tsx`: read `two_factor_enabled` from `user_private`.
- `src/components/shared/TermsAcceptanceGate.tsx`: read/write terms fields from `user_private`.
- `src/pages/Admin.tsx`: update `account_status` / `suspended_until` → `user_private` (admin path runs through service-role edge functions in most places; the direct `supabase.from("profiles").update(...)` at line 132 needs to become an admin edge function call, or call `user_private` via service role through an edge function). Simpler: route that one update through the existing `admin-manage-users` edge function.
- `src/components/admin/AdminsUsersTab.tsx`: display `account_status` — fetch through admin edge function (already service-role).

### Code updates (edge functions)
Audit and patch references in:
`moderation-action`, `delete-account`, `download-my-data`, `handle-block`, `admin-manage-users`, `admin-dashboard`, `notify-content-report`, `send-invoice-reminders`, `send-unread-message-emails`. Any read of the seven moved fields gets pointed at `user_private`. Service role bypasses RLS so this is mechanical.

### What does NOT change
- `display_name`, `avatar_url`, `bio`, `location`, `email_on_*` notification prefs stay on `profiles`.
- All `select("*")` peer reads keep working — they just no longer return sensitive fields.
- The existing peer SELECT policy on `profiles` stays as-is.

---

## Finding 2 — Realtime channels lack RLS

`realtime.messages` has no policies, so any authed user could subscribe to any topic. Current channels in the app:
- `bell-{variant}-{circleId}` (CircleHeader notifications bell) — circle-scoped
- `private-messages-realtime` — postgres_changes on `private_messages`
- `group-messages-realtime` — postgres_changes on `group_chat_messages`

The last two use **postgres_changes**, which still send through `realtime.messages` for authorization in the newer Realtime Authorization model. Underlying row reads are already RLS-protected, so the practical leak is mostly the channel-name pattern. We still add policies for defense-in-depth and to satisfy the scanner.

### Migration
Enable RLS on `realtime.messages` and add SELECT policy:
```
CREATE POLICY "authenticated can subscribe to allowed topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Bell channels: bell-<variant>-<circleId>
  (
    realtime.topic() LIKE 'bell-%-%'
    AND public.is_circle_member(
      auth.uid(),
      (regexp_match(realtime.topic(), '^bell-[^-]+-(.+)$'))[1]::uuid
    )
  )
  OR realtime.topic() IN ('private-messages-realtime', 'group-messages-realtime')
);
```
The two global postgres_changes channels stay open at the channel level (any authed user can subscribe) but row-level RLS on the underlying tables still gates what events they actually receive — which is the current behavior. Bell channels get strict per-circle gating.

If we want stricter gating on the two global channels later, we'd refactor them to per-user topics. **Out of scope for Wave 2** to avoid breaking the messaging UI.

---

## Execution order
1. Write & apply the migration (user_private table + backfill + trigger updates + drop columns + realtime policy).
2. Update the 5 frontend files above.
3. Update edge functions that reference the moved fields.
4. Re-run security scan, update security memory, mark findings fixed.

## Verification checklist (must all pass before iOS sync)
- Sign up new account → profile + user_private rows both created; terms gate shows once.
- Enable/disable 2FA in Settings → persists, gate enforces on next login.
- Admin suspends a user → `account_status` updates, user is blocked.
- Spam-reporter flagging still silently swallows reports.
- DM realtime: open two browsers, send a DM → recipient sees it live.
- Group chat realtime: same test in a circle group chat.
- Notification bell badge updates in real time on new notifications.
- Circle members list, messages list, events RSVPs, fridge campfire all still render peer names/avatars.

## Risk register
- **Highest risk:** dropping columns from `profiles`. Mitigated by backfilling first and updating all known reader code in the same change. Edge function audit is critical.
- **Realtime policy regression:** if the topic-matching regex is wrong, the bell goes silent. Mitigated by keeping the two existing global channels permissive.
- **Admin update path:** the direct `profiles.update` from `Admin.tsx` line 132 must move to an edge function or `user_private` will reject it under user RLS.

## Scanner context gaps you should know about
- The scanner flags `profiles` peer exposure as a single issue, but `display_name/avatar_url/bio/location` are **intentionally** peer-visible — that's the product. We are only moving the seven fields it explicitly listed.
- The realtime finding is generic; the scanner can't tell that `private-messages-realtime` is a shared postgres_changes channel rather than a private topic. We're handling defense-in-depth without breaking the working messaging UI.
- Wave-1 accepted risks (SECURITY DEFINER, public bucket listing, capacitor-voice-recorder advisory) remain accepted.
