## Decision

Ignore both findings. Neither represents a real exploit path in this app.

### Finding 1 — Post-media upload "any circle membership" check
- Storage INSERT requires `(storage.foldername(name))[1] = auth.uid()::text`. That alone restricts every authenticated user to writing inside their own UID folder.
- The `EXISTS … circle_memberships` clause is redundant; removing or keeping it does not change who can write where.
- No cross-user write is possible. Files referenced from posts go through `posts` RLS for read access separately.

### Finding 2 — Realtime `group-messages:<uid>` topic scoping
- The topic string is a channel label, not the security boundary.
- Row delivery from `group_chat_messages` is gated by the table's RLS, which uses `is_group_chat_member(auth.uid(), group_chat_id)` (SECURITY DEFINER).
- A user removed from a group loses RLS visibility immediately and stops receiving inserts on that group, regardless of topic name.

## Actions

1. Mark both scanner findings as ignored with the rationale above (`security--manage_security_finding`).
2. Append a short note to security memory so future scans don't re-flag:
   - "Storage post-media writes are gated by UID-folder scope (`(storage.foldername(name))[1] = auth.uid()::text`); any extra `circle_memberships` EXISTS clause is decorative."
   - "Realtime topic names like `group-messages:<uid>` are labels only. Row delivery is gated by RLS on the underlying tables using `is_group_chat_member` / `shares_circle_with` SECURITY DEFINER helpers."

## Out of scope
No code, policy, or migration changes.
