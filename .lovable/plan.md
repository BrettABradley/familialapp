

# Implementation Plan: 10 Platform Gaps

## Priority Order
1. Age Gate (COPPA compliance — legal risk)
2. Terms of Service Versioning (legal compliance)
3. Image/Media Moderation (safety)
4. Notification Preferences (UX)
5. Invite Expiry Visibility (UX)
6. Content Soft-Delete/Recovery (data safety)
7. Admin Metrics/Analytics Tab (operational)
8. Session Management UI (security)
9. Message Encryption Indicator (transparency)
10. 2FA/MFA (security hardening)

---

## 1. Age Gate at Signup

**Database migration:**
- Add `date_of_birth date` column to `profiles` table (nullable)

**Auth.tsx changes:**
- Add a date-of-birth field on the signup form
- Block signup if age < 13 with message: "You must be 13 or older to use Familial"
- Store DOB in profile after successful signup
- Save DOB via profile update immediately after account creation

---

## 2. Terms of Service Versioning

**Database migration:**
- Add `accepted_terms_version text` column to `profiles` table (nullable)

**TermsAcceptanceGate.tsx changes:**
- Define a `CURRENT_TERMS_VERSION` constant (e.g., `"2026-04-13"`)
- Check both `accepted_terms_at` AND `accepted_terms_version !== CURRENT_TERMS_VERSION`
- When user accepts, write both `accepted_terms_at` and `accepted_terms_version`
- This triggers re-acceptance when you bump the version string

---

## 3. Image/Media Moderation

The `moderate-content` edge function already supports `imageUrls`. Need to wire it up.

**CreatePostForm.tsx changes:**
- After uploading media to storage but before inserting the post, call `moderate-content` with both text and the public URLs of uploaded images
- If `allowed: false`, delete the uploaded files and show the rejection toast
- Same pattern for profile photo uploads and album photo uploads

**Settings.tsx (avatar upload) and Albums.tsx** — add same moderation check after upload, before saving URL to database.

---

## 4. Notification Preferences

**Database migration:**
- Create `notification_preferences` table: `user_id uuid PK references-style`, `email_enabled boolean default true`, `push_enabled boolean default true`, `muted_types text[] default '{}'`, `updated_at timestamptz default now()`
- RLS: users can SELECT/INSERT/UPDATE/DELETE own rows only

**Settings.tsx changes:**
- Add "Notification Preferences" section with toggles for:
  - Email notifications (on/off)
  - Push notifications (on/off)
  - Mute specific types: comments, mentions, events, fridge pins, DMs, campfire stories
- Fetch/upsert from `notification_preferences` table

**Edge function changes (send-push-notification):**
- Before sending, check `notification_preferences` for the target user
- Skip push if `push_enabled = false` or notification type is in `muted_types`

---

## 5. Invite Expiry Visibility

**PendingInvites.tsx changes:**
- Calculate and display remaining time until `expires_at`
- Show as badge: "Expires in 3 days" / "Expires in 12 hours" / "Expires soon"
- Use red badge when < 24 hours remain

---

## 6. Content Soft-Delete/Recovery

**Database migration:**
- Add `deleted_at timestamptz` column to `posts` table (nullable)
- Update RLS SELECT policy to exclude `deleted_at IS NOT NULL`
- Add `deleted_at timestamptz` to `comments` table similarly

**Feed/PostCard changes:**
- On delete, set `deleted_at = now()` instead of hard delete
- For post authors: show "Undo" toast with 10-second window to restore (set `deleted_at = null`)

**Admin dashboard:**
- Add "Deleted Posts" sub-tab showing recently soft-deleted content with a "Restore" button
- Hard-delete cron: add note that posts with `deleted_at` older than 30 days should eventually be purged (future enhancement)

---

## 7. Admin Metrics/Analytics Tab

**admin-dashboard edge function update:**
- Add `tab=metrics` handler that queries:
  - Total users (count of profiles)
  - New signups last 7 days
  - Active users last 7 days (users who posted/commented/messaged)
  - Total posts, posts today, posts this week
  - Pending reports count
  - Banned users count

**Admin.tsx changes:**
- Add "Metrics" tab with stat cards showing the above numbers
- Simple grid layout with Card components, no charting library needed

---

## 8. Session Management UI

**Settings.tsx changes:**
- Add "Active Sessions" section
- "Sign Out All Other Devices" button that calls `supabase.auth.signOut({ scope: 'others' })`
- Show confirmation dialog before executing
- Show current session info (last sign-in time from `user.last_sign_in_at`)

---

## 9. Message Encryption Indicator

**Messages.tsx changes:**
- Add a small info banner at top of message threads:
  - Icon: Shield/Lock icon
  - Text: "Messages are encrypted in transit and at rest. Learn more"
  - "Learn more" links to Privacy Policy page
- Same banner in group chat view

---

## 10. Two-Factor Authentication (2FA/MFA)

**Settings.tsx changes:**
- Add "Two-Factor Authentication" card in settings
- "Enable 2FA" button that calls `supabase.auth.mfa.enroll({ factorType: 'totp' })`
- Display QR code from the enrollment response
- Verify with OTP input calling `supabase.auth.mfa.challengeAndVerify()`
- "Disable 2FA" with `supabase.auth.mfa.unenroll()`
- Show MFA status badge (enabled/disabled)

**Auth.tsx changes:**
- After `signInWithPassword`, check if MFA is required via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
- If `currentLevel === 'aal1'` and `nextLevel === 'aal2'`, show TOTP input dialog
- Complete sign-in with `supabase.auth.mfa.challengeAndVerify()`

---

## Files Summary

| Type | File |
|------|------|
| Migration | Add `date_of_birth`, `accepted_terms_version` to profiles; create `notification_preferences`; add `deleted_at` to posts & comments |
| Updated | `src/pages/Auth.tsx` — age gate, MFA challenge |
| Updated | `src/components/shared/TermsAcceptanceGate.tsx` — version check |
| Updated | `src/components/feed/CreatePostForm.tsx` — image moderation |
| Updated | `src/pages/Settings.tsx` — notification prefs, session mgmt, 2FA |
| Updated | `src/components/circles/PendingInvites.tsx` — expiry display |
| Updated | `src/components/feed/PostCard.tsx` — soft delete |
| Updated | `src/pages/Admin.tsx` — metrics tab, deleted posts |
| Updated | `src/pages/Messages.tsx` — encryption indicator |
| Updated | `supabase/functions/admin-dashboard/index.ts` — metrics query |
| Updated | `supabase/functions/send-push-notification/index.ts` — preference check |
| Updated | RLS policies for posts/comments SELECT (exclude deleted_at) |

