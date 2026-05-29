## Priority

1. **#2 Circle member privilege escalation (Error)** — real, exploitable. Any member can `UPDATE circles SET owner_id = auth.uid()` and seize ownership. Fix first.
2. **#4 `Math.random()` 2FA codes (Warning)** — low-likelihood but trivial 2-line swap to `crypto.getRandomValues()`.
3. **#1 Invite token RLS (Error)** — column-level GRANT from last migration already blocks `select('token')` at the API; scanner only inspects the policy. Replace with a SECURITY DEFINER view to clear the finding cleanly.
4. **#3 Realtime channel scoping (Warning)** — already mitigated last round (per-user topic + `realtime.messages` policy). Leave as-is; re-run scan after the other fixes to confirm.

## Plan

### Fix #2 — Block `owner_id` (and other sensitive columns) overwrites by members

- Drop policy `Members can update circle avatar` on `public.circles`.
- Create SECURITY DEFINER RPC `update_circle_avatar(_circle_id uuid, _avatar_url text)`:
  - Verifies `is_circle_member(auth.uid(), _circle_id)`.
  - Updates only `avatar_url` and `updated_at`.
  - `GRANT EXECUTE ... TO authenticated`.
- Update `src/components/profile/AvatarCropDialog.tsx` (and any other circle-avatar upload site — `CircleHeader.tsx`, `Circles.tsx`) to call `supabase.rpc('update_circle_avatar', { _circle_id, _avatar_url })` instead of `supabase.from('circles').update({ avatar_url })`.
- Audit `circles` UPDATE call sites to ensure no other client-side update relies on the dropped permissive policy. Remaining UPDATE policy `Owners can update circles` stays for name/description/transfer_block/invite_code (already owner-scoped).

### Fix #4 — CSPRNG for 2FA codes

- In `supabase/functions/send-2fa-code/index.ts`, replace:
  ```ts
  const code = String(Math.floor(100000 + Math.random() * 900000));
  ```
  with:
  ```ts
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = String(100000 + (buf[0] % 900000)).padStart(6, "0");
  ```
- No other call sites use `Math.random()` for security purposes (spot-check `rg "Math.random" supabase/functions`).

### Fix #1 — Clear scanner on invite token

- Drop policy `Invited users can view their pending invites` on `circle_invites`.
- Create view `public.circle_invites_safe` (security_invoker = on) selecting `id, circle_id, invited_by, email, status, created_at, expires_at` with predicate `email = auth.jwt()->>'email' AND status = 'pending' AND expires_at > now()`.
- `GRANT SELECT ON public.circle_invites_safe TO authenticated`.
- Keep the column-level GRANT on the base table for the existing UPDATE policy (`Invited users can respond to their invites`) to keep working — UPDATE doesn't need SELECT access to `token`.
- Update `src/components/circles/PendingInvites.tsx` to read from `circle_invites_safe` instead of `circle_invites`. (Already avoids `token`, so just a table-name swap.)

### Fix #3 — Verify only

- Re-run security scan after #1, #2, #4 land. If realtime warning persists, revisit; current mitigation (per-user topic + `realtime.messages` policy) is sufficient in practice.

### Verification

- `supabase--linter` + security scan: #1, #2, #4 should clear.
- Manual #2: as a non-owner member, `supabase.from('circles').update({ owner_id: '<my uid>' }).eq('id', circleId)` → expect permission error. Avatar upload via the new RPC still works.
- Manual #1: `supabase.from('circle_invites').select('*')` → permission error. `from('circle_invites_safe').select('*')` → returns rows without `token`. PendingInvites UI still lists pending invites.
- Manual #4: trigger 2FA, confirm email arrives with a 6-digit code.

No auth flow, billing, or business-logic changes. No data migration needed.
