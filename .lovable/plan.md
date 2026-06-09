# Plan: Fix Comped Circle Limits + Add Reminder Events

## Problem 1: Comped Family/Extended users can't create a second circle

**Root cause:** `supabase/functions/admin-manage-users/index.ts` defines:
```
family:   { max_circles: 1, max_members_per_circle: 20 }
extended: { max_circles: 1, max_members_per_circle: 35 }
```
But the real Stripe pricing in `check-subscription/index.ts` uses:
- family → max_circles **2**
- extended → max_circles **3**

So any user comped to Family/Extended is stuck at `max_circles=1`. The "+ Create Circle" button is gated by the `get_circle_count` / `get_circle_limit` RPCs and stays disabled, which matches the user's complaint.

### Fix
1. Update `PLAN_LIMITS` in `admin-manage-users/index.ts`:
   - family → `max_circles: 2`
   - extended → `max_circles: 3`
2. One-time data backfill (via insert tool) for already-comped users to bring them in line:
   ```sql
   UPDATE public.user_plans SET max_circles = 2
     WHERE source = 'admin_comp' AND plan = 'family' AND max_circles < 2;
   UPDATE public.user_plans SET max_circles = 3
     WHERE source = 'admin_comp' AND plan = 'extended' AND max_circles < 3;
   ```
   (This includes the complaining user.)

No change to Stripe/IAP paths — they already set the right values.

## Problem 2: "Just a reminder" calendar items (no RSVP)

Add an opt-in flag so an event can be a simple reminder (birthday, anniversary, appointment) with no Going / Not Going UI.

### Schema (migration)
- Add `is_reminder boolean not null default false` to `public.events`.

### UI changes (`src/pages/Events.tsx` and create/edit dialog)
- Add a Checkbox **"Just a reminder (no RSVP)"** in the create + edit event dialogs.
- Persist `is_reminder` on insert/update.
- When rendering an event card where `is_reminder = true`:
  - Hide the Going / Not Going buttons and the "RSVPs" list.
  - Show a small "Reminder" badge next to the title.
- Skip the RSVP fetch/aggregation for reminder events (minor — they just won't have any).
- Notification copy: keep existing "New Event" notification but drop the "— RSVP now!" suffix when `is_reminder` is true.

### Notification trigger
Update `notify_on_event_created` to omit "— RSVP now!" when `NEW.is_reminder = true`.

## Files touched
- `supabase/functions/admin-manage-users/index.ts` — PLAN_LIMITS fix
- Migration: add `events.is_reminder`, update `notify_on_event_created`
- Data update: backfill comped Family/Extended `max_circles`
- `src/pages/Events.tsx` — checkbox in dialog, conditional RSVP UI, badge
- (Types regenerate automatically)

## Out of scope
- No changes to Stripe/Apple/Google plan sync paths.
- No changes to free/founder/enterprise limits.
