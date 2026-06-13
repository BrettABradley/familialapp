## Goal

Two tracks, independent and additive:

1. **Harden push notifications** so transient APNs/FCM failures, credential drift, and stale device tokens stop silently dropping pushes.
2. **Close the two security warnings** on `notifications` and `private_messages` without breaking any working feature.

Nothing in here removes a working call path — every client write that currently works keeps working, just routed through a `SECURITY DEFINER` function that enforces the rules.

---

## Track 1 — Push reliability

### Edge function (`send-push-notification`)

Today: single attempt per token, JWT cached 50 min, no retry, no auth-failure self-heal, no audit trail.

Changes:
- **Retry with backoff** (3 attempts, 250ms → 1s → 2s) for transient APNs/FCM responses: HTTP 429, 500, 502, 503, 504, network errors. Permanent failures (410 Unregistered, 400 BadDeviceToken, FCM `UNREGISTERED`/`INVALID_ARGUMENT`) skip retry and go straight to token cleanup — same behavior as today.
- **Self-heal credential cache**: if APNs returns `403 InvalidProviderToken` or `ExpiredProviderToken`, clear `cachedJwt` and retry once. Same for FCM `UNAUTHENTICATED`/401 — clear `cachedFcm`.
- **Per-token timeout** (~8s) using `AbortController` so a hung APNs/FCM socket can't stall the whole notification.
- **Send tokens in parallel** with `Promise.allSettled` instead of the current sequential loop, capped at 10 concurrent. Faster and one bad token can't block the rest.
- **Structured outcome log** to a new `push_delivery_log` table: `notification_id`, `user_id`, `platform`, `status` (`sent` / `retried` / `failed` / `skipped_pref` / `invalid_token`), `reason`, `attempts`, `created_at`. Bounded retention (cron-delete >30 days).
- **Credential-failure alert**: if APNs returns `InvalidProviderToken` even after the cache-bust retry, insert a `platform_admins` notification ("APNs auth failing — re-check Team ID / Key ID / .p8") at most once per hour (debounced via the log table). This is what would have surfaced the recent breakage immediately.

### Trigger path (`trigger_push_notification`)

- Keep the existing `pg_net.http_post` enqueue, but **also write the request_id** so we can correlate with `net._http_response` for forensics. Add a `RAISE LOG` line with the notification id + request id on failure.
- No behavioral change for the happy path.

### Token hygiene

- Add `last_used_at timestamptz` to `push_tokens`. The edge function updates it on a successful send. A weekly cron deletes tokens unused for 90+ days (stale device, app uninstalled, user changed phones).
- No change to the existing on-failure cleanup (`410 Unregistered` etc.).

### Canary / health check

- New edge function `push-credentials-health` (service-role gated): mints an APNs JWT and an FCM access token, returns `{ apns: "ok"|reason, fcm: "ok"|reason }`. No actual push sent. Lets the admin panel surface "credentials valid" without waiting for a real notification.

---

## Track 2 — Security findings

### Finding 1 — `notifications` impersonation

Today: `INSERT` policy is `auth.uid() = user_id` (recipient must be self), so a user can write fake "system" notifications to their own inbox. Cross-user client inserts in the codebase (comment replies, transfer-block fan-out, group-chat add, upgrade requests, plan-change fan-out, etc.) currently rely on this policy and either succeed because user_id is the caller, or silently fail when user_id is another user. We're going to make this honest.

- **Drop the client `INSERT` policy on `notifications`.** Only `service_role` and `SECURITY DEFINER` functions can insert after this.
- Add `SECURITY DEFINER` RPCs that wrap each currently-client-driven flow and enforce authorization server-side:
  - `notify_comment(_post_id, _content, _parent_comment_id)` — caller must be post-circle member; notifies post author + parent-comment author.
  - `notify_upgrade_request(_circle_id)` — caller must be circle member, owner is recipient, reuses the existing 24h rate-limit logic in SQL.
  - `notify_transfer_block(_circle_id)` — caller must currently own the circle; fans out to members.
  - `notify_group_chat_added(_group_chat_id, _user_ids[])` — caller must be the group creator; recipients must be members of the same circle.
  - `notify_plan_change(_circle_id, _message)` — caller must be circle owner; fans out to members.
- Update the six client call-sites (`useFeedPosts.ts`, `Circles.tsx` x2, `Messages.tsx`, `TransferBlockBanner.tsx`, `SubscriptionCard.tsx`, `Pricing.tsx`) to call the new RPCs instead of `.from('notifications').insert(...)`.
- Existing trigger-driven notifications (`notify_on_dm`, `notify_on_fridge_pin`, `notify_on_album_created`, `notify_on_event_created`, `notify_on_campfire_story`, mention RPCs, invite notification, etc.) are already `SECURITY DEFINER` and unaffected.

### Finding 2 — `private_messages` to anyone / blocked users

Today: `INSERT WITH CHECK (auth.uid() = sender_id)` — no recipient gate.

- Tighten the `INSERT` policy to also require:
  - `public.shares_circle_with(auth.uid(), recipient_id)` (already exists), **and**
  - `NOT EXISTS (SELECT 1 FROM blocked_users WHERE blocker_id = recipient_id AND blocked_id = auth.uid())` — recipient hasn't blocked sender,
  - and the symmetric block in the other direction.
- Wrap the two block-existence checks in a small `SECURITY DEFINER` helper `public.can_dm(_sender, _recipient)` to keep the policy expression readable and avoid the policy needing `SELECT` on `blocked_users`.
- The existing UI already prevents starting a thread with non-circle/blocked users, so legitimate sends are unaffected; this just enforces it at the DB.

### Out of scope for this pass

- The 24 already-ignored findings shown under "Show ignored issues" — not touching.

---

## Migrations summary

1. `push_delivery_log` table + GRANTs + RLS (service_role only) + 30-day cleanup cron.
2. `push_tokens.last_used_at` column + 90-day stale-token cleanup cron.
3. Drop client `INSERT` policy on `notifications`; add the five `SECURITY DEFINER` notify_* RPCs with `GRANT EXECUTE ... TO authenticated`.
4. Tighten `private_messages` `INSERT` policy via `public.can_dm` helper.

## Code summary

- Rewrite `supabase/functions/send-push-notification/index.ts` with retry/backoff, cache-bust on auth failure, parallel sends, structured logging, debounced admin alert.
- New `supabase/functions/push-credentials-health/index.ts`.
- Update six client files to call the new RPCs instead of inserting directly into `notifications`.

## Verification

- Re-run a test push to the known device — expect `sent=1`, a `push_delivery_log` row with `status=sent`, `last_used_at` bumped on the matching token.
- Manually break the APNs cache (force `InvalidProviderToken` by temporarily setting a bad kid) → confirm one retry, then admin notification appears, then real credentials restore cleanly.
- Try a client `.from('notifications').insert(...)` from the browser console → expect RLS denial.
- Try `private_messages` insert to a user not sharing a circle → expect RLS denial. Existing in-circle DMs still send.
- Re-run security scan; both warnings should drop off.
