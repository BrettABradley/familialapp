## Are these urgent?

**#1 (Error — invite token exposed): Yes, worth fixing before launch.** The `circle_invites.token` column is a unique secret meant for SECURITY DEFINER redemption only, but the current SELECT policy lets the invited user read their full row including `token`. The client code never actually uses `token` (it only reads `id`, `circle_id`, `status`, `email`), so we can safely hide it without breaking anything. Real-world blast radius is small (invitee can already accept/decline), but it violates the documented model and is an easy fix.

**#2 (Warning — Realtime channel scoping): Not urgent, but worth tightening.** Row payloads on `private_messages` and `group_chat_messages` are still filtered by table RLS, so non-participants can't read message contents. What leaks today is *metadata* — the fact that *some* message arrived on the shared channel name. Low severity, but cheap to address.

Neither is a "stop the launch" bug. #1 should ship in this submission; #2 can ship now or shortly after.

## Plan

### Fix 1 — Hide invite token from clients (migration)

- Drop policy `Invited users can view their pending invites` on `public.circle_invites`.
- Create a security-invoker view `public.circle_invites_safe` that selects only `id, circle_id, invited_by, email, status, created_at, expires_at` (no `token`).
- Grant `SELECT` on the view to `authenticated`; the view inherits row visibility from the user's own JWT email match via a new restricted SELECT policy on the base table that scopes by email **and** is read through the view only.
- Simpler equivalent: keep the existing predicate but enforce column-level grants — `REVOKE SELECT ON public.circle_invites FROM authenticated; GRANT SELECT (id, circle_id, invited_by, email, status, created_at, expires_at) ON public.circle_invites TO authenticated;`. This preserves the existing PendingInvites query (it never references `token`) and blocks any attempt to select `token`.
- Update `src/components/circles/PendingInvites.tsx` only if needed — current `select("id, circle_id, status, ...")` already avoids `token`, so no client change required.

### Fix 2 — Scope Realtime channels to participants

- Rename the two shared channels in `src/pages/Messages.tsx` so the topic includes the user id, e.g. `private-messages:${userId}` and `group-messages:${userId}`. The Postgres-changes filter already scopes the row payload; the per-user topic prevents non-participants from even subscribing to the shared name.
- Add a `realtime.messages` RLS policy (via migration) that allows a subscription only when the topic ends with the subscriber's own `auth.uid()` for these two prefixes. For group chats, additionally allow `group-chat:<group_id>` topics only when `is_group_chat_member(auth.uid(), group_id)` — but we are not using per-group topics today, so the per-user topic is sufficient as a first pass.
- No data-shape changes; only the channel name string changes in the client.

### Verification

- Run `supabase--linter` and re-run the security scan; both findings should clear.
- Manually: as user A, try `supabase.from('circle_invites').select('token')` → expect permission error. `select('id, circle_id, status')` still works.
- Send a DM and confirm the recipient still receives the realtime insert.

No edge function, auth, or business-logic changes needed.