

# Content Moderation + Admin Actions + Signup UX

## Overview

Three additions: (1) email notification to support on content reports, (2) admin moderation actions triggered from support email, and (3) improved signup UX when an account already exists.

---

## Part 1 — Notify support on content reports

**New edge function: `notify-content-report`**
- Receives report details (reason, details, post/comment/user IDs, reporter ID)
- Fetches reporter and reported user display names from `profiles`
- Sends formatted email to `support@familialmedia.com` via Resend (same pattern as `handle-block`)
- Includes an action link pointing to a new admin moderation function

**Update `ReportDialog.tsx`**
- After successful insert into `content_reports`, fire-and-forget call to `notify-content-report`

**Update `supabase/config.toml`**
- Add `[functions.notify-content-report]` with `verify_jwt = false`

---

## Part 2 — Admin moderation edge function: `moderate-reported-user`

**New database table: `banned_emails`**
- Columns: `id`, `email`, `banned_at`, `reason`, `report_id` (nullable reference)
- RLS: no public access (service-role only)

**New edge function: `moderate-reported-user`**
- Secured with a shared admin secret (not public-facing)
- Accepts: `report_id`, `action` (`ban_user`)
- On ban:
  1. Looks up the reported user from `content_reports`
  2. Fetches their email from `auth.users` (via service role)
  3. Removes the user from all `circle_memberships`
  4. For any circles they own: sets `transfer_block = true` (puts them on the trade block)
  5. Inserts their email into `banned_emails`
  6. Deletes the reported content (post or comment)
  7. Updates `content_reports.status` to `'resolved'`
  8. Optionally disables the user's auth account via `supabase.auth.admin.updateUserById(id, { ban_duration: 'forever' })`

**The report notification email** will include a one-click "Ban & Remove" link that calls this function with a pre-signed admin token.

---

## Part 3 — Block banned emails on signup

**Update `handle_new_user` trigger** (or add a new `before insert` trigger on auth)
- Before allowing signup, check if the email exists in `banned_emails`
- If found, raise an exception to block account creation

Alternatively, add a check in the Auth page's `signUp` flow that calls an edge function to verify the email isn't banned before attempting signup.

---

## Part 4 — Signup UX: "Already have an account?"

The Auth page already handles this — when `signUp` returns "User already registered", it shows a toast and auto-switches to the login form. This is already implemented at line 146-152 of `Auth.tsx`. No changes needed here.

---

## Technical details

| Change | File(s) |
|---|---|
| New edge function | `supabase/functions/notify-content-report/index.ts` |
| New edge function | `supabase/functions/moderate-reported-user/index.ts` |
| New DB table | `banned_emails` (via migration) |
| Add UPDATE RLS on `content_reports` | Migration for service-role update policy |
| Config update | `supabase/config.toml` — two new function entries |
| Component update | `src/components/shared/ReportDialog.tsx` — invoke notification |
| DB trigger update | Add banned-email check to signup flow |

No changes needed for the "already have an account" signup UX — it's already working.

