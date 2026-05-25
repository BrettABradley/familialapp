# Wave 3 Security Triage

Quick verdict on each finding, then what to do.

## 1. Circle UPDATE policy overlap — **REAL, fix**
The `circles` table has two UPDATE policies:
- `Owners can update circles` (owner only)
- `Members can update circle avatar` (any member, intended for avatar only)

Because Postgres RLS can't restrict UPDATE to specific columns, any member can technically write `invite_code`, `transfer_block`, `extra_members`, `owner_id`, `name`, `description`. We rely on a trigger (`restrict_circle_member_update` per memory) to block this, but the scanner can't see that.

**Fix:** Verify the trigger actually whitelists only `avatar_url` for non-owners. If gaps exist, tighten it. No frontend changes.

## 2. `profile-images` bucket missing UPDATE policy — **REAL, fix**
Users uploading a new avatar with the same filename will silently fail on overwrite. Add:
```sql
CREATE POLICY "Users update own profile images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```
Most code uses `upsert: true`, so this prevents silent failures. No frontend changes.

## 3. `shadow_reports` missing INSERT policy — **IGNORE**
Shadow reports are inserted by the `report-content` edge function using the service role when `spam_reporter = true`. Clients never insert directly — that's by design (the reporter must not know their report is shadowed). Mark ignored with explanation.

## 4. `two_factor_codes` no SELECT policy — **VERIFY then IGNORE**
2FA verification runs entirely in the `verify-2fa-code` edge function with service role. Clients should never SELECT codes. Plan: confirm no SELECT policy exists (default deny) and no client code queries the table, then mark ignored.

## 5. `user_appeals` missing INSERT policy — **REAL, fix**
Suspended users need to appeal. Currently no path. Add INSERT policy:
```sql
CREATE POLICY "Users can submit own appeals"
ON public.user_appeals FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
```
Frontend already has an appeal UI on the suspended screen (need to verify) — if not, that's a separate feature, just fix the policy now.

## Execution order
1. Audit `restrict_circle_member_update` trigger — confirm column whitelist
2. Single migration:
   - Tighten circle trigger if needed
   - Add `profile-images` UPDATE policy
   - Add `user_appeals` INSERT policy
3. Mark `shadow_reports` and `two_factor_codes` findings as ignored with rationale
4. Update security memory with accepted risks
5. Re-run scan

## Risk
Lowest-risk wave so far — all additive policies plus a trigger audit. No table drops, no frontend refactors. Verification: confirm avatar upload still works, confirm a member can't rename a circle they don't own.

## Out of scope
- Building the appeals submission UI (separate task if missing)
- Dependency vulnerabilities (2 packages) — separate `bun update` pass
