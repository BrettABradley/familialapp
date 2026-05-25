# Fix Reset-Password Delay + Deep-Link Notifications

Three concrete fixes. All backend + small frontend additions, no UI overhaul.

## 1. Reset password email — faster + clear destination

**Root cause of slowness:** auth emails are enqueued to pgmq, then drained by `process-email-queue` which runs every 5s on a 200ms-per-message delay. Worst case the email sits 5–10s before sending, plus Resend/Lovable Email API latency. Total can easily feel like 30s+ on a cold queue.

**Fixes:**
- In `auth-email-hook/index.ts`: after `enqueue_email` succeeds, immediately fire-and-forget invoke `process-email-queue` (no await, no error throw) so the auth email drains within the same second instead of waiting for the next cron tick.
- Lower `send_delay_ms` from 200 → 50ms in `email_send_state` (queue still throttles bursts but auth emails go out almost instantly).
- Recovery template button currently sends users to the magic recovery URL which lands on `/reset-password#access_token=...&type=recovery`. `ResetPassword.tsx` already listens for `PASSWORD_RECOVERY`/`SIGNED_IN` events and shows the password form — this works. Verified, no change needed.

**The "link doesn't take me to reset" complaint** is almost certainly the slow email — by the time the link arrives the recovery token has neared/exceeded the 1-hour Supabase default. With #1 fixes, link will be fresh on arrival.

## 2. Notification deep-links — include circle + exact target

Currently most notifications link only to a top-level route. Fix each trigger to include `?circleId=X` plus a target ID:

| Notification | Current `link` | New `link` |
|---|---|---|
| mention (`create_mention_notifications`) | `/feed` | `/feed?circleId={circle}&post={postId}` |
| direct_message (`notify_on_dm`) | `/messages` | `/messages?circleId={inferred}&thread={senderId}` |
| fridge_pin (`notify_on_fridge_pin`) | `/fridge` | `/fridge?circleId={circle}&pin={pinId}` |
| campfire_story (`notify_on_campfire_story`) | `/fridge` | `/fridge?circleId={circle}&pin={pinId}` |
| event_rsvp (`notify_on_rsvp`) | `/events` | `/events?circleId={circle}&eventId={eventId}` |
| event_created | already `?eventId=X` | add `circleId={circle}` |
| album_created | already `?albumId=X` | add `circleId={circle}` |

Also enrich messages so push titles/bodies include the circle name where it adds clarity:
- mention: `"{Actor} mentioned you in {CircleName}"`
- fridge_pin / campfire_story / event_created already include the title; add circle name when relevant.

**Frontend:** add a small `useDeepLinkCircleSync` hook (mounted once in `App.tsx`) that reads `?circleId=` from the URL and calls `setSelectedCircle()` from `CircleContext`. This makes EVERY deep link auto-switch to the right circle before the page renders content. Feed already scrolls to `?post=` ID; Fridge needs the same treatment for `?pin=`; Messages needs `?thread=` support.

## 3. Push tap routing

`pushNotifications.ts` already navigates via `window.location.href = link`. Once link values are updated in step 2, push taps land on the exact post/pin/thread in the correct circle. No code change here.

## Execution order

1. **Migration** — update notification trigger functions to emit richer links + circle names. Set `send_delay_ms = 50`.
2. **Edge function** — patch `auth-email-hook` to flush `process-email-queue` after enqueue. Deploy.
3. **Frontend** — add deep-link circle sync hook in `App.tsx`. Add `?pin=` scroll/expand in `Fridge.tsx` and `?thread=` open in `Messages.tsx`. Leave `Feed.tsx` alone (already works).

## Risk

- Auth hook flush: failure swallowed silently, so worst case is current behavior (5s wait). Zero regression risk.
- Notification trigger rewrites: append-only metadata; existing notifications keep their old links (still functional, just less rich). New notifications start using the new format immediately.
- Deep-link circle sync: only runs if `?circleId=` is present, so unrelated pages are untouched.

## Out of scope

- Reducing Supabase's auth recovery token lifetime (handled at Supabase level, not this codebase).
- Changing pg_cron interval below 5s (would need pg_cron upgrade; not necessary once auth-hook does immediate flush).
