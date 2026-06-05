# Triage the four flagged warnings — none are real vulnerabilities

After reading the actual policies and write paths, every one of these four findings is either already mitigated or describes the system working as intended. No code or migration changes needed; we'll close them out in the scanner and update security memory so future scans don't keep re-flagging the same things.

## 1. Circle invite tokens readable by inviter and circle admins — intentional

`circle_invites.token` is the unguessable identifier embedded in the invite link the inviter sends. The SELECT policy allows: the inviter, circle admins managing pending invites, and the invited email's owner. Each of those needs the token:
- **Inviter:** to copy or resend the invite link from the UI.
- **Circle admins:** the admin UI shows pending invites and offers a "resend" action.
- **Invitee:** to accept the invite when signed in with that email.

Stripping the token from admin reads would break the existing admin invite-management UI. The token is also rotated when a new invite is generated and invites expire in 7 days. Treat as intentional, not a vulnerability.

## 2. post-media upload policy — already correct (scanner self-resolved)

The scanner text itself ends with: "On re-read, the uid folder check is present — this finding is not applicable." The INSERT policy already requires `(storage.foldername(name))[1] = auth.uid()::text`, so users can only upload into their own UID folder. No change needed.

## 3. `shadow_reports` has no INSERT policy — intentional

Inserts happen exclusively through the `redirect_spam_reporter` SECURITY DEFINER trigger on `content_reports`. When a flagged "spam reporter" submits a content report, the trigger silently writes the row into `shadow_reports` instead. Granting a client-side INSERT policy would defeat the shadow-banning mechanism by letting suspected spammers know they're shadow-banned. The current setup is correct.

## 4. `user_appeals` tokens visible to platform admins — intended audience

`user_appeals.token` is consumed by tokenized admin action links in moderation emails (the same one-time token pattern documented in security memory). Platform admins are the legitimate audience for those tokens. Submitters intentionally do not have a SELECT policy because appeal status is communicated back to them by email, not by polling the table. Token reuse is bounded by `moderation_action_tokens.used_at` and `expires_at`. No change needed.

## Actions

1. Mark all four findings as not applicable in the security scanner with the explanations above.
2. Update `@security-memory` so future scans understand:
   - `circle_invites.token` is intentionally readable by inviter, circle admins, and the invitee.
   - `shadow_reports` writes flow only through the `redirect_spam_reporter` SECURITY DEFINER trigger.
   - `user_appeals.token` is only for platform admins (used by admin email links).

No file edits, no migrations, no frontend changes.
