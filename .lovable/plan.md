## Goal

Two related bugs when a notification is tapped:

1. **Deep link doesn't carry circle context** — Tapping a push (or clicking an email) for a DM, mention, RSVP, etc. should open that exact item inside the right circle. Today, DM links are missing the circle entirely, and the unseen-message email always sends users to `/messages` with no thread or circle.
2. **iOS gets "stuck" in Messages after a push tap** — After landing in a chat from a push, the user can't navigate away (bottom nav / back affordances don't behave). This is a side-effect of how the native push handler injects history before Messages mounts its sentinel history entry.

## What's already correct

These triggers already write good deep links and don't need changes:

- `mention` → `/feed?circle=…&post=…`
- `event_rsvp`, `event_created` → `/events?circle=…&eventId=…`
- `fridge_pin`, `campfire_story` → `/fridge?circle=…&pin=…`
- `new_album` → `/albums?circle=…&album=…`

## Fix 1 — DM notification link includes the circle

Update `notify_on_dm()` in a new migration so the inserted `notifications.link` is:

```
/messages?circle=<shared_circle_id>&thread=<sender_id>
```

The shared circle is picked deterministically (most recent shared membership between sender and recipient, falling back to any shared circle). If no shared circle is found, fall back to today's `/messages?thread=<sender_id>` so behavior never regresses.

This makes `useDeepLinkCircleSync` switch the header to the right circle, and Messages' existing `?thread=` effect opens the thread once `circleMembers` for that circle finishes loading.

Group-chat link in `Messages.tsx` (line 530) already uses `/messages?circle=…&group=…` — no change.

## Fix 2 — Email links use the notification's deep link

- `send-unread-message-emails`: change the `url` field from a hardcoded `${SITE_URL}/messages` to `${SITE_URL}<notification.link>` for that recipient's most-recent unseen DM. Falls back to `/messages` only when no link is available.
- Any future mention/album/event emails sent from the queue should pass `notification.link` through to the template's `url` prop the same way. (Scope of this plan: wire the unseen-message path; leave other templates untouched unless we discover they're hardcoded too.)

## Fix 3 — iOS "trapped in Messages" after push tap

Root cause: `pushNotifications.ts`'s `pushNotificationActionPerformed` handler does `history.pushState` + dispatches `popstate`. On a cold launch from a push that targets `/messages?thread=…`:

- The history stack has only one entry (the launched route).
- Messages mounts, opens the thread, then pushes its own sentinel history entry so that hardware/back exits the chat (line 342–349 of `Messages.tsx`).
- The synthetic `popstate` from the push handler and the sentinel push collide, so the first back action either no-ops or pops out of the app instead of returning to the conversation list. Additionally, on cold launch the mobile portal chat covers the bottom nav with no remaining history to pop.

Changes:

1. **`src/lib/pushNotifications.ts`** — Stop dispatching a synthetic `popstate`. Instead:
   - If a SPA history entry already matches the link, do nothing extra.
   - Otherwise call `window.history.pushState({}, '', link)` and then trigger React Router via the existing `familial:deep-link` custom event (no popstate). Add a small `navigate`-style helper by dispatching a `pushstate` event the app listens for, OR — simpler — keep using popstate but **defer it by one tick** and mark the event so Messages' sentinel effect can ignore the first popstate.
   - The cleaner path we'll ship: emit `familial:deep-link` with `{ link }`, and have `AppLayout` (or a tiny new hook) call `navigate(link)` from React Router in response. This avoids touching the history stack twice.

2. **`src/pages/Messages.tsx`** — Make the chat-exit affordance bullet-proof when arrived via a deep link:
   - When a chat is opened because of `?thread=` / `?group=` (deep link), do NOT push the extra sentinel history entry. Instead, the chat back arrow already calls `handleExitChat()` directly, which resets state and shows the list with the bottom nav restored — no history dependency required.
   - Track this with a `openedViaDeepLink` ref set in the deep-link effects, cleared on `handleExitChat`.

3. **Sanity** — Keep the existing Android hardware-back behavior intact for chats opened normally (non-deep-link), since that path still benefits from the sentinel popstate.

## Files changed

- New migration: `supabase/migrations/<ts>_dm_link_with_circle.sql` — replaces `notify_on_dm()`.
- `supabase/functions/send-unread-message-emails/index.ts` — use per-notification `link`.
- `src/lib/pushNotifications.ts` — remove synthetic popstate, use a single deep-link event consumed by the app to call React Router `navigate`.
- New hook usage in `src/App.tsx` or `src/components/layout/AppLayout.tsx` — listens for `familial:deep-link` and calls `navigate(link)`.
- `src/pages/Messages.tsx` — skip sentinel history push when opened via deep link.

## Out of scope

- No iOS rebuild required; all changes are JS + SQL + edge function. (The push payload still carries `link` exactly as it does today.)
- No changes to other notification triggers, since their links are already complete.
- No template redesign — just URL plumbing.

## Verification

1. Insert a test `direct_message` notification → confirm `link` is `/messages?circle=…&thread=…`.
2. Tap a DM push on iOS → header switches to that circle, thread opens, back arrow returns to the conversation list, bottom nav is interactive, and tapping another tab navigates away.
3. Tap a mention push → lands on `/feed?circle=…&post=…` with the correct circle active.
4. Trigger an unseen-message email digest → the email's button URL is `https://www.familialmedia.com/messages?circle=…&thread=…`.
