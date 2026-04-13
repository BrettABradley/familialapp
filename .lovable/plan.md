

# Priority Implementation: Platform Hardening & UX Improvements

## Priority Order & Rationale
1. **Global Error Boundary** — prevents white screens (critical UX)
2. **Auth Rate Limiting** — security (brute-force protection)
3. **Admin Dashboard + Audit Logging** — operational necessity for moderation
4. **Guided Onboarding Flow** — user activation/retention
5. **Download My Data (GDPR/CCPA)** — legal compliance
6. **Accessibility Pass** — inclusivity for elderly/impaired users
7. **Offline/Poor Connection Handling** — resilience

---

## 1. Global Error Boundary

Create `src/components/shared/ErrorBoundary.tsx` — a React class component that catches runtime errors and shows a friendly fallback UI with a "Refresh" button and Familial branding. Wrap `<App />` in `main.tsx` with it.

---

## 2. Auth Rate Limiting

Add client-side throttling in `Auth.tsx`:
- Track failed login attempts in component state
- After 5 failures within 5 minutes, disable the form with a countdown timer
- Reset on successful login
- Show a warning message after 3 failures

---

## 3. Admin Dashboard + Audit Logging

**Database changes (migration):**
- Create `admin_actions` table: `id`, `admin_email`, `action_type`, `target_user_id`, `target_content_id`, `details`, `created_at`
- No RLS policies (service-role only access)
- Update `moderate-reported-user` edge function to log actions to this table

**New page: `src/pages/Admin.tsx`**
- Protected route at `/admin` — checks if user email matches `brettbradley007@gmail.com` (founder)
- Tabs: Reports (pending/resolved), Banned Users, Audit Log
- Fetches data via a new `admin-dashboard` edge function (validates founder email server-side)
- Actions: Dismiss report, Ban user directly from dashboard (reuses `moderate-reported-user` logic)

**Route:** Add `/admin` as a public route in `App.tsx` (auth checked inside the component)

---

## 4. Guided Onboarding Flow

Create `src/components/shared/OnboardingFlow.tsx`:
- A multi-step modal shown to new users (detected by: no circles, no avatar, no bio)
- Step 1: Upload profile photo
- Step 2: Set display name and bio
- Step 3: Create or join first circle
- Persists completion in a `localStorage` flag + checks profile completeness
- Rendered inside `AppLayout` after auth, before main content

---

## 5. Download My Data

**New edge function: `download-my-data`**
- Authenticated endpoint that collects all user data: profile, posts, comments, messages, events, photos, fridge pins, family tree entries
- Returns a JSON file with all data
- No media files (just URLs) to keep response manageable

**Settings page update:**
- Add a "Download My Data" button in `Settings.tsx` below the profile section
- Shows loading state while generating, then triggers file download

---

## 6. Accessibility Pass

- Add `aria-label` attributes to all icon-only buttons across layout components (`MobileNavigation`, `CircleHeader`, camera buttons, etc.)
- Add `role="navigation"` to nav elements
- Ensure all form inputs have associated labels (already mostly done)
- Add keyboard focus indicators where missing
- Add `aria-live="polite"` regions for toast/notification areas

---

## 7. Offline/Poor Connection Handling

Create `src/components/shared/OfflineBanner.tsx`:
- Listens to `navigator.onLine` and `online`/`offline` events
- Shows a dismissible banner at top of screen when offline: "You're offline. Some features may be unavailable."
- Render in `AppLayout` above the main content

---

## Files Changed Summary

| Type | File |
|------|------|
| New component | `src/components/shared/ErrorBoundary.tsx` |
| New component | `src/components/shared/OnboardingFlow.tsx` |
| New component | `src/components/shared/OfflineBanner.tsx` |
| New page | `src/pages/Admin.tsx` |
| New edge function | `supabase/functions/admin-dashboard/index.ts` |
| New edge function | `supabase/functions/download-my-data/index.ts` |
| New migration | `admin_actions` table |
| Updated | `src/main.tsx` — wrap with ErrorBoundary |
| Updated | `src/App.tsx` — add /admin route |
| Updated | `src/pages/Auth.tsx` — rate limiting |
| Updated | `src/pages/Settings.tsx` — Download My Data button |
| Updated | `src/components/layout/AppLayout.tsx` — onboarding + offline banner |
| Updated | `src/components/layout/MobileNavigation.tsx` — aria-labels |
| Updated | `src/components/layout/CircleHeader.tsx` — aria-labels |
| Updated | `supabase/functions/moderate-reported-user/index.ts` — audit logging |

