# Notification Deep-Link Hardening

Today most notifications already carry `?circle=<id>&...=<id>` and `useDeepLinkCircleSync` swaps the active circle from the URL. The remaining gaps: a few links omit `circle=`, a few have no link at all, and the Fridge page ignores its `pin` param. After this plan every bell tap (in-app card *and* push) routes to the exact item inside the correct circle.

## What's wrong today (verified against DB + code)

| Source | Current link | Issue |
|---|---|---|
| `useFeedPosts.ts` comment / comment_reply | `/feed?post=<id>` | missing `circle=` → wrong circle on tap |
| `notify_on_rsvp` (trigger) | inconsistent (some rows missing `circle=`) | wrong circle |
| `Messages.tsx` group_chat invite | `/messages` | doesn't open the new group |
| DB trigger `notify_on_group_message` (if any) / direct_message | `/messages?thread=<senderId>` works | OK |
| `Circles.tsx` transfer_block insert | no `link` | nothing happens on tap |
| `handle_invite_notification` (circle_invite) | no `link` | tap is a no-op (must reach Pending Invites) |
| `cleanup-rescue-offers` gift | no `link` | tap no-op |
| Fridge `?pin=<id>` deep-link | Fridge page ignores it | lands on board, not the pin |

## Fixes

### 1. Client-side notification inserts
- `src/hooks/useFeedPosts.ts`: change both comment notification links to `/feed?circle=${post.circle_id}&post=${postId}`.
- `src/pages/Messages.tsx` (group create): set link to `/messages?circle=${circleId}&group=${group.id}` and add a `?group=` consumer in `Messages.tsx` that selects that group chat after fetch.
- `src/pages/Circles.tsx` transfer_block insert: add `link: /circles?circle=${circle.id}`.

### 2. DB migration — backfill links + fix triggers
A single migration that:
- Rewrites `notify_on_rsvp` to always emit `/events?circle=<id>&eventId=<id>`.
- Rewrites `handle_invite_notification` to set `link = /notifications` (where `PendingInvites` is already rendered).
- Adds `link = /circles` to any future gift inserts is owned by an edge function — update `supabase/functions/cleanup-rescue-offers/index.ts` to set `link: /store`.
- Backfills existing rows so tapping old notifications also works:
  - `UPDATE notifications SET link = '/feed?circle='||related_circle_id||'&post='||related_post_id WHERE type IN ('comment','comment_reply','mention','reaction') AND related_post_id IS NOT NULL AND (link IS NULL OR link NOT LIKE '%circle=%');`
  - `UPDATE notifications SET link = '/notifications' WHERE type='circle_invite' AND link IS NULL;`
  - `UPDATE notifications SET link = '/circles?circle='||related_circle_id WHERE type='transfer_block' AND link IS NULL;`
  - `UPDATE notifications SET link = '/events?circle='||related_circle_id||'&eventId='||COALESCE(substring(link from 'eventId=([0-9a-f-]+)'), '') WHERE type='event_created' AND link NOT LIKE '%circle=%' AND related_circle_id IS NOT NULL;`

### 3. Page-level consumers
- `src/pages/Fridge.tsx`: read `searchParams.get("pin")`; when pins load, find the matching pin and open its detail dialog (existing pin click handler). Strip param via `setSearchParams` to avoid re-opens.
- `src/pages/Messages.tsx`: read `searchParams.get("group")`; when group chats load, `setSelectedGroup(...)` + `setChatView("group")`. Strip param.
- `src/pages/Circles.tsx`: read `searchParams.get("circle")` to scroll the matching circle card into view (so transfer-block notifications land in context). Strip param.

### 4. Sanity checks already in place (no change)
- `useDeepLinkCircleSync` switches active circle from `?circle=` on every route — keeps header, feed, fridge, events, albums in sync.
- `Notifications.tsx` already calls `navigate(notification.link)` and the native push handler dispatches `familial:deep-link` which `useDeepLinkCircleSync` listens to.

## Out of scope
- Visual changes to the bell list or push payloads.
- New notification types or grouping.
- Changing read/unread semantics.

## QA after build
1. Comment on a post in Circle A while viewing Circle B → tap bell item → Feed loads Circle A and scrolls to the post.
2. Create an event in Circle A → recipient taps bell → Events page in Circle A, event dialog opens.
3. New album, fridge pin, campfire story, mention, DM, group chat add → each lands on the exact item in the right circle.
4. Circle invite & transfer-block taps reach Pending Invites / the affected circle.
5. Repeat all of the above from a cold push notification on device.
