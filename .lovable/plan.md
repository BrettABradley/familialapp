## Add paying customers list to Admin → Subscriptions

Surface the emails of users actively paying (Stripe or Apple, plan ≠ free), excluding gifted/comped accounts, in the existing admin Subscriptions tab.

### Backend (`supabase/functions/admin-dashboard/index.ts`, `tab=subscriptions`)
- After computing the paid aggregate metrics, hydrate the existing `paid` rows with email + display name:
  - Collect `user_id`s from `user_plans` rows where `source IN ('stripe','apple')` and `plan != 'free'`.
  - Look up emails via `supabaseAdmin.auth.admin.listUsers` (paginate if >200), and display names from `profiles`.
- Return a new `paid.customers` array with: `user_id`, `email`, `display_name`, `plan`, `source` (Stripe/Apple), `extra_members`, `cancel_at_period_end`, `current_period_end`, `subscription_started_at`.
- Sort by `subscription_started_at` desc.

### Frontend (Admin Subscriptions tab component)
- Add a "Paying customers" table below the existing metric cards in the Subscriptions tab.
- Columns: Email, Name, Plan, Platform (Stripe/Apple badge), Extra seats, Started, Status (Active / Canceling on <date>).
- Simple client-side search box (filter by email/name) and CSV export button (optional, nice-to-have).
- Gifted (`admin_comp`) users remain in their existing separate "Recent comps" section — not mixed in.

### Notes
- Admin-only: protected by the existing `requireAdmin` / `platform_admins` check in the edge function.
- No new tables, no schema migration. Pure read-only enrichment of the existing `subscriptions` tab response.
