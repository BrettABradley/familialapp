## Decision

Ignore the remaining warning **"Any authenticated user can subscribe to private-messages and group-messages Realtime channels"**. The risk it describes is already mitigated and the scanner is being conservative.

## Why it's a false positive now

1. **Per-user topic names.** `src/pages/Messages.tsx` subscribes to `private-messages:${user.id}` (line 238) and `group-messages:${user.id}` (line 258). Each authenticated user can only listen on a topic that embeds their own UID — there is no shared topic name for outsiders to subscribe to.
2. **Realtime authorization policy.** The `realtime.messages` policy added in the last security migration restricts subscriptions on these prefixes to topics whose suffix equals `auth.uid()`.
3. **Row payloads remain RLS-filtered.** `private_messages` and `group_chat_messages` keep their existing table-level RLS, so even if a topic were reached, CDC rows would be filtered out for non-participants.
4. **No broadcast / no presence.** The app only uses Postgres `postgres_changes` CDC. The extra leak vector the scanner mentions ("if Realtime broadcast or presence features are used") does not apply.

The scanner can't introspect the dynamic topic format and is still matching the old hardcoded channel names from prior commits.

## Plan

1. Use `security--manage_security_finding` to **ignore** `realtime_channel_private_group_messages_unscoped` with an explanation pointing at the per-user topic + `realtime.messages` policy.
2. Update **security memory** (`security--update_memory`) with a short "accepted risk / what should never happen" entry stating:
   - Realtime channels for private + group messages are intentionally namespaced per user (`private-messages:<uid>`, `group-messages:<uid>`), authorized via `realtime.messages` topic-suffix check.
   - Don't re-introduce a shared/global channel name for these features.
   - The app uses only Postgres CDC — do not enable broadcast or presence on these channels without re-evaluating.
3. No code changes. No migration.

## Verification

- Re-run the security scan after ignoring; the finding should drop off.
- Manually confirm DMs and group chats still receive realtime inserts (no behavior change).
