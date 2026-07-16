## Keep same-day events in "Upcoming" until noon local time

### The bug (all platforms)

`src/pages/Events.tsx` filters events using `new Date().toISOString().split("T")[0]`, which returns the **UTC** calendar date. Two consequences:

1. **US users after ~5pm PT / 7pm ET**: UTC has already rolled to tomorrow, so today's events disappear from Upcoming and show in Past.
2. **Every user, every day**: the moment midnight hits, that day's event moves to Past — the user reports Wednesday morning meetings vanishing from Upcoming before the meeting even happens.

### Fix — one shared "cutoff date" helper

Add a small helper that returns the date string used as the Upcoming/Past boundary, computed from **local** time:

```ts
// If local time is before noon, cutoff = today (today's events stay in Upcoming).
// If local time is at/after noon, cutoff = tomorrow (today's events move to Past).
// Returns "YYYY-MM-DD" in local timezone.
function getEventCutoffDate(): string {
  const now = new Date();
  if (now.getHours() >= 12) now.setDate(now.getDate() + 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

Place it alongside the existing local-date helpers so it's reusable if other pages need the same rule.

### Query changes in `Events.tsx`

**`fetchEvents` (Upcoming, ~line 234)** — use the cutoff and honor `end_date` for multi-day events. An event is Upcoming when EITHER `event_date >= cutoff` OR `end_date >= cutoff`:

```ts
const cutoff = getEventCutoffDate();
query = query.or(`event_date.gte.${cutoff},end_date.gte.${cutoff}`);
```

**`fetchPastEvents` (Past, ~line 259)** — an event is Past only when it has fully finished before the cutoff:

```ts
const cutoff = getEventCutoffDate();
query = query
  .lt("event_date", cutoff)
  .or(`end_date.is.null,end_date.lt.${cutoff}`);
```

Pagination cursors (`event_date` for both) stay as-is; the cutoff just tightens the boundary.

### Auto-refresh at the boundary

Add a lightweight timer that refetches at the next noon boundary so a user who leaves the app open past 12:00 sees the tab update automatically. Compute `msUntilNextBoundary` (next 12:00 or next 00:00, whichever comes first) and `setTimeout(() => { fetchEvents(); fetchPastEvents(); }, ms)`. Clear on unmount.

### Explicitly NOT changed

- No schema changes. `event_date` stays a DATE (no timezone column added).
- No changes to event creation, edit, RSVP, notifications, or reminders.
- No change to the `event_time` field — this is a date-level rule, matching the current storage model. If in the future the user wants time-aware cutoffs (e.g., "past 30 min after event_time"), we'd revisit.
- No change to the calendar view, deep-link logic, or `allEvents` merge for the calendar dots.

### Files changed

- `src/pages/Events.tsx` — add helper, update `fetchEvents`/`fetchPastEvents` queries, add noon-boundary refetch effect.

### Expected outcome

- Wednesday's 6 AM–noon meeting stays in **Upcoming** all Wednesday morning.
- At 12:00 PM local time, it moves to **Past** and the tabs auto-refresh.
- Multi-day events (with `end_date`) stay in Upcoming through their last day using the same noon rule.
- The UTC-vs-local timezone bug that hits US evening users is fixed as a side effect.
