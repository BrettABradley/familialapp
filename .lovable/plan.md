## Where reports go today

When a user submits the Report dialog (`ReportDialog.tsx`):

1. A row is inserted into `content_reports` (status `pending`, with `post_id` / `comment_id` / `reported_user_id`).
2. The post or comment is immediately flipped to `is_hidden = true` (so RLS hides it from everyone right away).
3. The `notify-content-report` edge function fires off an email to `support@familialmedia.com` with two action links: **Ban User** and **Dismiss**.
4. Clicking a link hits the `moderate-reported-user` edge function with an `ADMIN_MODERATE_SECRET` query param.
   - **Ban**: removes user from all circles, marks owned circles `transfer_block`, adds email to `banned_emails`, deletes the post/comment, bans the auth user for ~100 years, logs to `admin_actions`.
   - **Dismiss**: un-hides the content, sets status `dismissed`, logs.
5. There is also `/admin` (founder-only at `brettbradley007@gmail.com`) which lists reports but still requires typing the admin secret in a browser `prompt()` for each action.

### Problems with the current system
- Moderation is gated behind an emailed link + a shared secret typed into `prompt()` — not viable on iOS, and brittle (lost emails = lost queue).
- No real **queue UI**: no filtering, no bulk actions, no notes, no "warn", no temp suspension, no reviewer assignment.
- No **appeals path** for banned users (Apple 1.2 requires this).
- No **24h SLA tracking** — Apple App Review requires action within 24h on objectionable UGC reports.
- Reporter never hears back; reported user is never notified.
- Blocking and reporting are partially intertwined (`blocked_users` + a synthetic `content_reports` row with reason `blocked_user`) — pollutes the queue.
- No way to **ignore future reports from a known bad reporter** (report-spam abuse).
- No retention / export for legal.

---

## Proposed system

A single in-app **Moderation Console** at `/admin` (gated by `user_roles.role = 'platform_admin'`, not just an email check), backed by edge functions that use the caller's JWT — no more shared secret, no more email links as the primary path. Email stays as a *notification* only.

### Architecture

```text
┌─────────────┐     ┌────────────────────┐     ┌──────────────────────┐
│  Reporter   │────▶│ content_reports    │────▶│ Moderation Console   │
│ (in-app)    │     │  (queue + status)  │     │ (/admin, web + iOS)  │
└─────────────┘     └────────────────────┘     └──────────┬───────────┘
                              │                            │
                              ▼                            ▼
                    ┌────────────────────┐     ┌──────────────────────┐
                    │ Auto-hide content  │     │ moderation-action    │
                    │ (RLS is_hidden)    │     │ edge function (JWT)  │
                    └────────────────────┘     └──────────┬───────────┘
                                                          │
                              ┌───────────────────────────┼─────────────┐
                              ▼                           ▼             ▼
                       admin_actions               banned_emails   notifications
                       (audit log)                 + auth ban      (reporter +
                                                                    target)
```

### Database changes (new migration)

- Extend `content_reports`:
  - `severity text` (`low` | `med` | `high` — defaulted from `reason`)
  - `assigned_to uuid` (admin currently reviewing)
  - `resolved_at timestamptz`, `resolved_by uuid`, `resolution_note text`
  - `sla_due_at timestamptz` (default `now() + 24h`, used for the Apple SLA badge)
  - index on `(status, sla_due_at)` for the queue
- New `moderation_decisions` table — one row per action taken on a report (so we can do **dismiss → re-open → warn → ban** without losing history). Fields: `report_id`, `actor_id`, `action` (`hide`, `restore`, `delete`, `warn`, `suspend_7d`, `ban`, `dismiss`, `mark_spam_report`), `note`, `created_at`.
- New `user_strikes` table: `user_id`, `report_id`, `severity`, `expires_at`. Three active strikes → auto-suspend; admin can override.
- New `user_appeals` table: `user_id`, `original_report_id`, `message`, `status` (`pending` | `granted` | `denied`), timestamps. Banned users get a `/appeal` page (no auth required — token-based, like unsubscribe).
- Add `'platform_admin'` to the `app_role` enum and seed Brett's row in `user_roles` (`circle_id` NULL is fine for platform-wide roles — or use a separate `platform_admins` table to avoid mixing scopes; **recommend the separate table** to keep `user_roles` strictly circle-scoped as today).
- Add RLS so platform admins can `SELECT/UPDATE` `content_reports`, `moderation_decisions`, `user_strikes`, `user_appeals`, `banned_emails`, `admin_actions` via a `is_platform_admin(uid)` SECURITY DEFINER function.

### Edge functions

- **`moderation-action`** (new, JWT-verified, platform-admin only): single endpoint that takes `{ report_id, action, note? }` and performs the corresponding side effects (hide/restore/delete/warn/suspend/ban/dismiss). Replaces the GET-link flow in `moderate-reported-user`. Always writes to `moderation_decisions` + `admin_actions`. Emits push + in-app notification to both reporter ("Thanks — we reviewed your report") and target ("Your content was removed for X" / "Your account is suspended for 7 days").
- **`submit-appeal`** (new, public, token-based): banned user enters email + appeal text; rate-limited; creates `user_appeals` row + notifies support.
- **`moderation-stats`** (new, admin-only): counts by status, overdue-SLA count, top reporters, top reported users — powers the dashboard header.
- Keep `notify-content-report` but make it a *notification* only, not an action link. Add a deep link `familial://admin/reports/<id>` so iOS notifications open the queue directly.
- Deprecate the GET branch of `moderate-reported-user` (leave the POST branch for one release, then remove).

### iOS specifics (Apple Guideline 1.2)

Apple requires four things for any UGC app; we will check all four boxes:

1. **Method for filtering objectionable material** — already via auto-hide on report + AI `moderate-content` function. Keep, plus add a profanity/word-list pre-filter on post creation.
2. **Mechanism for users to flag objectionable content** — already via Report dialog. Make sure it's reachable on every post/comment/DM/group message/album photo/fridge pin (audit pass — DMs and album photos currently don't have it).
3. **Mechanism for users to block abusive users** — `blocked_users` exists. Surface a Blocked Users list in Settings so users can unblock (currently only `useBlockedUsers` hook exists, no UI).
4. **Developer must act on objectionable content and users within 24 hours of report** — this is the big new piece. Implement:
   - `sla_due_at` countdown badge in the console.
   - Daily cron (`pg_cron` calling an edge function) that emails Brett if any report is past SLA.
   - Auto-hide already happens on report (so the content is invisible while the 24h clock runs — this is what Apple actually cares about).

### Moderation Console UI (`/admin`)

Replace the current tabbed page with:

- **Queue** (default): pending reports sorted by `sla_due_at`, with a red dot when overdue. Each row expandable inline — shows the actual reported content, reporter, target, reason, prior strikes on the target, prior reports filed by the reporter (so admin can spot abuse).
- **Action bar** per report: Dismiss / Restore / Delete content / Warn / Suspend 7d / Ban / Mark reporter as spammer. Each action prompts for a short note, then calls `moderation-action`. No secret prompts.
- **Targets** tab: search users, see their report history, strike count, current status, manual ban/unban.
- **Appeals** tab: pending appeals with Grant / Deny.
- **Audit** tab: `moderation_decisions` + `admin_actions` joined view, filterable.
- **Metrics** tab: keep existing, add "Open reports", "Overdue (SLA)", "Avg time-to-resolution last 7d".

Mobile (iOS native): the console is a regular route so it works in the Capacitor shell; iOS push notifications route admin alerts to the same page.

### Reporter abuse handling

`Mark reporter as spammer` sets a `spam_reporter` flag on the reporter's profile (new boolean). RLS on `content_reports` INSERT checks the flag and silently no-ops their future reports (we keep recording them in a `shadow_reports` table for review but they don't enter the queue or hide content). This is how you "ignore certain reports" cleanly.

### Email / notification flow (after the change)

- Reporter submits → reporter gets in-app toast (today) + later, when resolved, an in-app notification "We reviewed your report".
- Target user → on warn/suspend/ban, gets an in-app notification + email explaining what happened and how to appeal.
- Admin → push + email per new report; daily digest of overdue items.

---

## Rollout

1. **Migration 1** — new tables/columns, RLS, `is_platform_admin()` function, seed Brett.
2. **Migration 2** — `pg_cron` job for SLA reminder + cleanup of resolved >90d.
3. **Edge functions** — `moderation-action`, `submit-appeal`, `moderation-stats`; update `notify-content-report` to drop action links.
4. **Frontend** — rebuild `/admin` (Queue/Targets/Appeals/Audit/Metrics), add Settings → Blocked Users screen, add Report buttons missing on DMs/album photos/fridge pins, add public `/appeal/:token` page.
5. **Cleanup** — remove email-secret moderation links after one release.

## Open decisions for you

1. Platform-admin model: separate `platform_admins` table (cleaner) **or** extend `app_role` enum + nullable `circle_id` in `user_roles`? I recommend the separate table.
2. Strike thresholds: default proposal is **3 active strikes (90-day window) → 7-day suspension; 5 → permanent ban**. OK?
3. Appeals: token in the ban email (no login needed) **or** require sign-in to a read-only "your account is suspended" screen? Apple prefers token, easier on the user.
4. Do you want a second admin seat now (e.g. a co-moderator email), or stay solo until needed?
