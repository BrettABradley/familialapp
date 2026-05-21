## Admin Console — Manage Admins, User Lookup, Comp & Enterprise Plans

Add an **Admins & Users** tab to `/admin` for the two platform admins (Brett + support@familialmedia.com). Moderators still use the app normally — this is just one extra tab in the existing console, no impact on their regular Familial experience.

### Guardrails baked in
- **Comp is free-tier-only.** You can only upgrade someone whose current `user_plans.plan = 'free'` AND who has no active Stripe subscription. If they're already paying (Family/Extended) or have a pending Stripe sub, the UI shows their Stripe status and refuses the comp with a clear message. No downgrades. No overwriting of paying customers ever.
- **Enterprise is its own opt-in.** Upgrading to Enterprise goes through a separate "Add Enterprise account" flow with the same free-tier guard.
- **Removing a comp** is allowed (drops them back to free), but only on users still on a comp'd plan — never touches paying subs.
- **Self-removal blocked** for moderators (prevents lockout).

### Enterprise (refined)
Stripe keeps handling normal billing; Enterprise is the off-platform escape hatch. Each Enterprise record has fully-editable limits — you can dial it from a 100-circle org down to a single circle with 10,000 members, or any combination. Inputs accept 1–10,000 for both `max_circles` and `max_members_per_circle`.

---

### New tab: "Admins & Users"

Visible only when `is_platform_admin(auth.uid())` returns true. For moderators, this is the 5th tab on `/admin` alongside Queue, Appeals, Audit, Metrics — they never see it elsewhere in the app and nothing about their normal account changes.

**Section 1 — Manage Moderators**
- Table: email, display name, granted_at, granted_by.
- "Add Admin" dialog → email lookup → confirm → insert into `platform_admins`.
- "Remove" per row with confirm dialog. Self-removal blocked.

**Section 2 — User Lookup & Plan Comp (free users only)**
- Search box (email or display_name partial match).
- Result card shows: email, name, current plan, Stripe subscription status (active/none/pending), circles owned, joined date, account_status.
- If `plan = 'free'` AND no active Stripe sub → "Comp Plan" dropdown enabled (Family / Extended). Free-text "Gift note" field (e.g. "Friend gift — Founder").
- If they're already paying → dropdown disabled with tooltip: "User has an active subscription. Comp not available."
- On Apply:
  - Updates `user_plans` (plan + max_circles + max_members_per_circle).
  - Logs to `admin_actions`.
  - Fires **gift email** ("A small thank-you from Familial" template, same vibe as the Haley Liming / Bryce send) via Resend.
  - In-app notification to the recipient.
- "Revoke comp" button on previously-comp'd accounts → drops them to free.

**Section 2b — Active Comps (quick-glance list)** *(added per discussion)*
- Sub-list under the search box showing every user currently on a comped plan.
- Columns: name/email, plan, comp date, gift note, who comped them.
- Per-row "Revoke" button (same guardrail — only touches comped plans, never paying subs).
- Sortable by comp date. Lets either moderator answer "who did I gift last month?" without digging the audit log.

**Section 3 — Enterprise Accounts**
- List of users on the `enterprise` plan with billing metadata.
- "Add Enterprise Account" dialog (free-tier guard applies):
  - Email lookup
  - **Max circles** input (1–10,000)
  - **Max members per circle** input (1–10,000)
  - Contact email
  - Agreed price (USD, cents)
  - Billing cadence: monthly / annual / custom
  - Next invoice due date
  - Notes
- Per-row actions:
  - Edit limits / price / cadence / next-invoice-date (all fields editable any time).
  - "Mark invoice sent" → advances `next_invoice_due_at` based on cadence and logs to `admin_actions`.
  - Remove Enterprise → drops back to free, requires confirm.
- Optional gift email toggle on creation (same template).

### Backend changes

**Schema:**
- Relax `platform_admins` RLS: add `INSERT` and `DELETE` policies gated by `is_platform_admin()`.
- New `enterprise_accounts` table:
  - `user_id` (unique), `contact_email`, `agreed_price_cents int`, `currency text default 'USD'`, `billing_cadence text` ('monthly'|'annual'|'custom'), `next_invoice_due_at timestamptz`, `notes text`, `created_by uuid`, timestamps.
  - Validation trigger: `max_circles BETWEEN 1 AND 10000`, `max_members_per_circle BETWEEN 1 AND 10000`.
  - RLS: platform admins only.
- Add `comped_by_admin_at timestamptz` + `comp_note text` to `user_plans` so the Active Comps list can filter cleanly and revokes never touch paying subs.
- `'enterprise'` plan is just a `user_plans.plan` text value — no enum change needed.

**Edge functions (JWT-verified, admin-only, all log to `admin_actions`):**
- `admin-add-moderator` — `{ email }`.
- `admin-remove-moderator` — `{ user_id }`. Refuses self.
- `admin-lookup-user` — `{ query }` → returns user + plan + live Stripe subscription status (via STRIPE_SECRET_KEY).
- `admin-list-comps` — returns all users with `comped_by_admin_at IS NOT NULL`.
- `admin-comp-plan` — `{ user_id, plan, note?, send_gift_email }`. **Refuses if not on free OR has active Stripe sub.** Triggers gift email.
- `admin-revoke-comp` — `{ user_id }`. Only allowed if `comped_by_admin_at IS NOT NULL`.
- `admin-upsert-enterprise` — `{ user_id, contact_email, agreed_price_cents, billing_cadence, max_circles, max_members_per_circle, next_invoice_due_at?, notes?, send_gift_email }`. Same free-tier guard on creation; updates are unrestricted once the account exists.
- `admin-mark-invoice-sent` — `{ enterprise_account_id }`. Advances next-invoice-due by cadence.
- `admin-remove-enterprise` — `{ user_id }`. Drops to free.

**Gift email:**
- Reuse existing `founder-gift` template (already created, modeled on the Haley/Bryce send).
- Sent from `support@familialmedia.com` via existing `send-transactional-email` function.

### Frontend

- New `<AdminsUsersTab />` component, added as a 5th tab to `src/pages/Admin.tsx`.
- Reuses shadcn `Table`, `Dialog`, `Input`, `Select`, `Tooltip`, `Badge`.
- All actions via `supabase.functions.invoke()` — no client-side privileged inserts.
- Toast feedback + section-scoped refresh after each action.

### Out of scope
- No Stripe automation for Enterprise (manual invoicing is the point).
- No multi-currency (USD only).
- No bulk CSV — one-off bulk gifts stay a "ping Brett" task.
- Refunds/disputes stay in Stripe dashboard.
- Moderator's normal app experience is untouched — no banners, no different nav, just the extra `/admin` tab.

Ready to build on approval.
