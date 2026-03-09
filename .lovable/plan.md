

# Security Audit Results

## 1. Are API keys or secrets exposed in frontend code?

**PASS.** No secret keys (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) appear anywhere in frontend code. They are only used inside backend functions. The only keys in the frontend are the publishable Supabase URL and anon key, which are designed to be public.

## 2. What happens with malicious form input (XSS, empty fields, unexpected data)?

**PASS (mostly).** The one `dangerouslySetInnerHTML` usage is in the shadcn chart component for injecting CSS theme variables — not user content, so no XSS risk. Database triggers enforce length limits on all user-facing text fields (posts: 5000 chars, comments: 2000 chars, circle names: 100 chars, etc.). The content moderation edge function scans text and images via AI before posts are published.

**Minor note:** Client-side validation could be tighter on some forms, but the server-side triggers act as a reliable safety net.

## 3. Can I access private pages without being logged in?

**PASS.** `AppLayout` checks auth state and redirects unauthenticated users to `/auth`. All app routes are wrapped in this layout. Public pages (landing, privacy policy, etc.) are intentionally public and contain no sensitive data.

## 4. Can a logged-in user access another user's data by changing a URL ID?

**PASS.** Profile views (`/profile/:userId`) are protected by RLS — the `profiles` SELECT policy only allows viewing profiles of users who share a circle with you. Profile images have the same restriction. Private messages are only visible to sender/recipient. All data access goes through Supabase with RLS enforced.

## 5. Can others scan for invite codes and join circles uninvited?

**FAIL — CRITICAL.** The security scan found two serious issues:

1. **All circle invite codes are readable by every authenticated user.** The RLS policy "Users can look up circles by invite code" uses `auth.uid() IS NOT NULL`, meaning any logged-in user can query ALL circles and see every invite code.

2. **Any authenticated user can join any circle without an invite.** The INSERT policy "Users can join via invite code" only checks that the circle exists — it doesn't verify the user actually provided the correct invite code.

Together, these mean any authenticated user can enumerate all circles, read their invite codes, and self-join any circle.

## 6. Is the app vulnerable to SQL injection?

**PASS.** All database queries use the Supabase JS client with parameterized methods (`.eq()`, `.in()`, `.insert()`, etc.). No raw SQL string concatenation exists in the frontend. Edge functions that use SQL also use parameterized queries.

## 7. Are dependencies up-to-date with known vulnerabilities?

**PASS (reasonable).** Core dependencies are on recent versions. No known critical CVEs in the current dependency set. Recommend running `npm audit` locally before store submission.

## 8. Additional findings from security scan

- **Notifications table allows spoofing.** Any authenticated user can insert a notification targeting any other user (the INSERT policy only checks `auth.uid() IS NOT NULL`, not `auth.uid() = user_id`).
- **Reactions and comments lack circle membership checks on INSERT.** A user who knows a post ID could react to or comment on posts in circles they don't belong to.

---

## Fix Plan

### Database migrations needed (3 fixes):

**Fix 1 — Lock down circle invite code lookup:**
Replace the overly broad "Users can look up circles by invite code" SELECT policy. Create a secure RPC function that accepts an invite code and returns only the matching circle (if any), rather than exposing all circles.

**Fix 2 — Require actual invite code validation on join:**
Replace the "Users can join via invite code" INSERT policy on `circle_memberships` to verify the user-supplied invite code matches the target circle's code. This can be done via a secure RPC or by tightening the policy's WITH CHECK.

**Fix 3 — Fix notification spoofing:**
Change the notifications INSERT policy from `auth.uid() IS NOT NULL` to `auth.uid() = user_id`, and use a `SECURITY DEFINER` function for system-generated notifications (like circle invite notifications, which already use one).

**Fix 4 — Add circle membership checks to reactions and comments INSERT:**
Add WITH CHECK subqueries to verify the target post's circle includes the inserting user.

### No code changes needed for:
- API key exposure (already secure)
- XSS protection (no user-content HTML rendering)
- SQL injection (parameterized queries throughout)
- Auth-guarded routes (already enforced)
- Profile data isolation (RLS already correct)

### Files affected
- Database migrations only (4 RLS policy updates + 1 new RPC function)
- Circles.tsx — update join-by-code flow to use the new secure RPC instead of direct query

