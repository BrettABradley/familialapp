# Wave 1 Security Hardening

Knocks out 3 of 5 errors and most warnings with **no user-visible changes** and no risk to existing flows. Wave 2 (profiles view + realtime RLS) will be handled separately.

## What gets fixed

### 1. Avatar overwrite vulnerability (ERROR)
Drop the redundant `Authenticated users can update avatars` storage policy. The ownership-scoped `Users can update their own avatar` policy remains and continues to work.

### 2. Post media upload path scope (ERROR)
Update the `Circle members can upload post media` storage INSERT policy to also require `(storage.foldername(name))[1] = auth.uid()::text`. Upload code already writes to `{userId}/...` paths, so behavior is identical.

### 3. `pending_unread_email_notifications` RLS (WARN)
Add explicit "deny all" policies for authenticated users. Service role (used by triggers + edge functions) is unaffected.

### 4. `circle_invites` token leak (WARN)
- Create a `circle_invites_sent` view (security_invoker=on) that excludes the `token` column.
- Drop the `Users can view invites they sent` policy on the base table.
- Update `PendingInvites.tsx` (and any other inviter-facing query) to read from the new view.
- Invited-user policies on the base table stay intact (they need the token for acceptance).

### 5. `user_appeals` token exposure (ERROR)
- Create a `user_appeals_public` view (security_invoker=on) excluding `token` and `reviewer_note`.
- Replace the current user-facing SELECT policy on `user_appeals` with `USING (false)` for the appellant.
- Update `Appeal.tsx` / appeal-related queries to read from the view.
- Edge functions (`submit-appeal`, `moderation-action`) keep service-role access to the base table.

### 6. `store_offers` admin SELECT policy (WARN)
Add a SELECT policy: `is_platform_admin(auth.uid())`. Purely additive — gives admins read access they currently lack.

### 7. Function `search_path` hardening (WARN)
Add `SET search_path = public` to every function in `public` that doesn't already have it set. Pure hardening; no behavior change.

### 8. Leaked password protection (WARN)
Enable HIBP check via `configure_auth`. Only effect: new signups can't use already-breached passwords.

### 9. `capacitor-voice-recorder` vulnerability (INFO)
Bump to latest patch version. Quick smoke test on voice recording in Messages after.

## What is NOT in this wave

- **Profiles sensitive fields (#9 from earlier)** — needs careful component audit; Wave 2.
- **Realtime channel RLS (#11)** — highest breakage risk; Wave 2 with staging test.
- **SECURITY DEFINER executable warnings** — these functions (`has_role`, `is_circle_member`, etc.) must be SECURITY DEFINER for RLS to work. Will document in security memory as accepted risk.
- **Public bucket listing** — `avatars`, `post-media`, `profile-images` are intentionally public for image rendering. Will document as accepted.
- **`RLS Enabled No Policy` (info)** — same as #3, intentional service-role-only access. Document as accepted.

## Execution order

```text
1. Single migration: storage policy fixes (#1, #2)
                   + RLS lockdown (#3)
                   + views + policy swap (#4, #5)
                   + admin SELECT (#6)
                   + search_path hardening (#7)
2. configure_auth: leaked password protection (#8)
3. Code edits: PendingInvites + Appeal page to read from new views
4. bun update capacitor-voice-recorder (#9)
5. Update security memory with accepted-risk notes for SECURITY DEFINER + public buckets
6. Re-run security scan to confirm
```

## Verification checklist (post-deploy, before iOS sync)

- Upload an avatar → still works
- Create a post with media → still works
- Send a circle invite → still appears in `PendingInvites`
- File an appeal → still appears on `Appeal` page
- Admin views store offers → now visible
- Voice memo in Messages → still records/plays
- New signup with a known-leaked password → rejected with HIBP error

If all pass, this ships clean to the web bundle. iOS picks it up on next App Store build (no urgency since it's backend-side).
