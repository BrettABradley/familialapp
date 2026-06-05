## Security findings — triage

### 1. ERROR: Any authenticated user can subscribe to any `bell-*` notification channel
**Real risk:** Low-medium. The bell channel currently uses Postgres CDC with `filter: user_id=eq.<userId>`, and RLS on `notifications` only returns each user their own rows — so subscribers don't actually receive other people's notification *payloads*. However, the realtime topic itself isn't user-scoped, so a malicious user could subscribe to another user's bell topic name and observe broadcast presence/timing.

**Fix (safe, no functional change):**
- Rename the bell channel from `bell-{variant}-{circleId}` to `bell-{userId}-{variant}-{circleId}` in `src/components/layout/CircleHeader.tsx`.
- Update the realtime policy so the `'bell-%'` branch requires `realtime.topic() LIKE 'bell-' || auth.uid()::text || '-%'`.

### 2. ERROR: Realtime topics not matching known prefixes are open to all authenticated users
**Real risk:** Medium. Two policies have permissive fallbacks:
- `"Users can only subscribe to their own private-messages topic"` falls through to `ELSE true`.
- `"authenticated can subscribe to allowed topics"` has an open `'realtime:%' ⇒ true` branch.

Combined, any authenticated user could subscribe to arbitrary CDC topics. We don't use any `realtime:*` topics in the client (verified — only `private-messages:`, `group-messages:`, and `bell-*` are used).

**Fix (safe, no functional change):**
- Change the first policy's `ELSE true` to `ELSE false`.
- Remove the `'realtime:%' ⇒ true` branch from the second policy; keep only the explicit user-scoped allowlist (`private-messages:{uid}`, `group-messages:{uid}`, and the new `bell-{uid}-%`).

### 3. WARNING: `circles.invite_code` is readable by all circle members
**Real risk:** None — this is intentional product behavior. The invite code is masked by default in the UI, members can reveal/share it, and owners can refresh it at any time (existing "Invites" memory). Restricting it to owners-only would break the documented sharing flow.

**Action:** Ignore the finding with an explanation and update `@security-memory` to record this as intentional so the scanner stops flagging it.

---

## Implementation steps

1. **Migration** — replace both realtime policies:
   ```sql
   DROP POLICY "Users can only subscribe to their own private-messages topic" ON realtime.messages;
   DROP POLICY "authenticated can subscribe to allowed topics" ON realtime.messages;

   CREATE POLICY "authenticated topic allowlist" ON realtime.messages
   FOR SELECT TO authenticated
   USING (
     realtime.topic() = 'private-messages:' || auth.uid()::text
     OR realtime.topic() = 'group-messages:' || auth.uid()::text
     OR realtime.topic() LIKE 'bell-' || auth.uid()::text || '-%'
   );
   ```
   (One consolidated policy is cleaner than two overlapping ones.)

2. **Client edit** — `src/components/layout/CircleHeader.tsx` line 75:
   ```ts
   .channel(`bell-${userId}-${variant}-${selectedCircle}`)
   ```

3. **Ignore the `invite_code` finding** via `security--manage_security_finding` with rationale: "Members are intended to be able to reveal and share the 8-char invite code; owners can refresh it at any time. Restricting to owners would break the documented invite-sharing flow."

4. **Update `@security-memory`** — add a "what is intentionally readable" note for `circles.invite_code` and a note that realtime topics are now strictly scoped to `auth.uid()`.

5. **Verify** — re-run the security scan; confirm the two ERRORs clear and that Messages + Notifications still work in the preview (private messages topic, group messages topic, and the per-user bell channel).

## What stays the same / cannot break
- `private-messages:{uid}` and `group-messages:{uid}` topic names are unchanged → `Messages.tsx` keeps working.
- Bell still uses postgres_changes CDC with the same RLS-filtered notifications query, just on a user-scoped topic name → no UX change.
- No edge functions, no DB schema, no Stripe/IAP, no iOS/Android logic touched.