

## Plan: Campfire Dialog UX Improvements

### 1. Bigger, more visible close button on mobile
- In `CampfireDialog.tsx`, add a custom close button (an `X` icon from lucide) positioned top-right inside the campsite hero area, sized at 40x40px with a semi-transparent dark background circle for contrast against the night sky. Style it with `md:hidden` so it only appears on mobile (the default dialog close button is small and hard to see on dark backgrounds).
- Keep the existing `[&>button]` styling but supplement it with this explicit mobile close button that calls `onOpenChange(false)`.

### 2. Show story as a chat bubble only when avatar is tapped (hide the always-visible story card)
- Remove the always-visible story content area at the bottom. Instead, when a user taps an avatar, show their story as an inline speech/chat bubble that appears near or below their avatar within the campsite hero section.
- Use a styled card with a small triangle/caret pointing toward the selected avatar, overlaid on the campsite environment.
- When no avatar is selected (or tapped again to deselect), the bubble disappears — only the campfire scene and avatars are visible.
- The submit form for the current user's story remains at the bottom but only shows if they haven't submitted yet.

### 3. Fire scales with number of stories + scrollable avatar area
- Pass `storyCount` to `PixelCampfire` component. Scale the fire size layers based on story count:
  - Base size at 0-1 stories
  - Each additional story increases fire width/height by ~10-15% (capped at ~2x)
  - More stories = bigger, more impressive fire
- Wrap the avatar row in a horizontal `ScrollArea` so when there are many contributors, users can scroll left/right through the avatars without breaking the layout.
- On mobile, the scroll area should be touch-scrollable with `overflow-x-auto`.

### Files to modify
- `src/components/fridge/CampfireDialog.tsx` — custom mobile close button, chat bubble story display, scrollable avatars
- `src/components/fridge/PixelCampfire.tsx` — accept `storyCount` prop, scale fire dimensions dynamically

