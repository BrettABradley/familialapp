

# Plan: Notification Deep Links + Desktop Nav Spacing Fix

## 1. Update event notification trigger to include event ID in link

**Database migration**: Update the `notify_on_event_created` function to set `link` to `'/events?eventId=' || NEW.id` instead of just `'/events'`. This enables deep linking to a specific event.

## 2. Events page: auto-scroll to deep-linked event

**`src/pages/Events.tsx`**:
- Read `eventId` from URL search params via `useSearchParams`
- After events load, find the matching event card and scroll it into view with a highlight animation
- Add `id` attributes to event cards (`id={event.id}`) so we can target them
- If the event is in the "Past" tab, auto-switch to that tab
- Clear the search param after scrolling to avoid re-triggering

## 3. Notification click uses React Router navigation (already working)

The header bell and Notifications page already use `<Link to={n.link}>` which goes through React Router. No changes needed here — the deep link param just needs to be present in the `link` field.

## 4. Fix desktop nav whitespace

**`src/components/layout/CircleHeader.tsx`**:
- Change desktop nav gap from `gap-1` to `gap-0` to tighten spacing between nav items
- Reduce button padding on nav items with smaller horizontal padding class

## Files to change

| File | Change |
|------|--------|
| DB migration | Update `notify_on_event_created` link to include event ID |
| `src/pages/Events.tsx` | Add `useSearchParams`, scroll-to-event logic, card IDs |
| `src/components/layout/CircleHeader.tsx` | Tighten desktop nav spacing |

