

## Make Event Addresses Clickable with Maps Links

### What Changes

When an event has a location/address, it will become a tappable link. Tapping it opens a small menu letting the user choose between **Apple Maps** or **Google Maps**, which then opens the selected maps app/website with the address pre-filled.

### How It Works

- The location text in each event card becomes a clickable button styled as a link
- Clicking it opens a small popover with two options:
  - **Apple Maps** -- opens `https://maps.apple.com/?q={address}`
  - **Google Maps** -- opens `https://www.google.com/maps/search/?api=1&query={address}`
- Both open in a new tab; on mobile devices, they'll automatically open the respective maps app if installed
- No user preference is stored -- the user simply picks each time they tap (keeps it simple and avoids needing database changes)

### Changes

**`src/pages/Events.tsx`**

In the `renderEventCard` function (lines 501-505), replace the plain location text with a `Popover` component:
- The trigger is the location text styled as a clickable link (underline, pointer cursor)
- The popover content shows two buttons: "Open in Apple Maps" and "Open in Google Maps"
- Each button opens the appropriate URL with the address URI-encoded

The same treatment applies to the edit dialog preview -- but since the edit dialog doesn't show a rendered card, no changes needed there.

### Technical Details

The URL formats:
- Apple Maps: `https://maps.apple.com/?q=${encodeURIComponent(location)}`
- Google Maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`

Uses the existing `Popover`, `PopoverTrigger`, `PopoverContent` components already imported in the file. No new dependencies needed.

