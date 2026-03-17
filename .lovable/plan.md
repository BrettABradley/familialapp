## Plan: Global keyboard-aware UX improvements

### Problem

On mobile (especially iOS), when the keyboard opens, text inputs can be hidden behind the keyboard. Users cannot see what they are typing in event forms, album creation, profile settings, etc. Additionally, the keyboard does not dismiss when scrolling content in most areas.

### Changes

#### 1. Create a global `useKeyboardDismissOnScroll` hook

- New file: `src/hooks/useKeyboardDismissOnScroll.ts`
- Attaches a `touchmove` listener to a given ref (or document) that calls `document.activeElement.blur()` when the user scrolls while an input/textarea is focused
- This will be reused across Feed, Events, Albums, Profile, Settings, and any scrollable page

#### 2. Apply keyboard-dismiss-on-scroll to all main scrollable pages

- `**src/pages/Feed.tsx**` — wrap the main `<main>` with the hook so scrolling the feed closes the keyboard
- `**src/pages/Events.tsx**` — same for the events list
- `**src/pages/Albums.tsx**` — same for the albums list
- `**src/pages/Settings.tsx**` — same for the settings form
- `**src/pages/ProfileView.tsx**` — same for the profile page
- `**src/pages/Messages.tsx**` — the conversation list page (already done for DM/group chat scroll areas, but not for the main list)

#### 3. Auto-scroll focused inputs into view (events, albums, settings, profile)

- Add a small global CSS scroll-margin or a reusable `onFocus` handler that calls `element.scrollIntoView({ behavior: 'smooth', block: 'center' })` on text inputs when focused
- Apply via a global CSS rule: `input, textarea { scroll-margin-bottom: 260px; }` combined with the native iOS `scrollIntoView` behavior
- For dialog-based forms (Events create/edit, Albums create), ensure the `DialogContent` has proper `overflow-y-auto` (already present) and add `onFocus` scroll-into-view to inputs inside them

#### 4. Messages — make member search list scrollable past keyboard

- In `src/pages/Messages.tsx` (line ~957), the member dropdown is `max-h-64 overflow-y-auto` — adjust its max-height to account for `--keyboard-height` so users can scroll through all members when the keyboard is open
- Style: `max-h-[calc(50vh-var(--keyboard-height,0px))]`

#### 5. Add confirm/back affordance to dialog forms

- Events create/edit dialogs already have "Create Event" / save buttons at the bottom
- Add a visible close/back button in the dialog header for mobile (an X or "Cancel" text button) — the DialogContent already renders an X close button from shadcn, so this is covered
- Ensure the create/save button is always visible by keeping `overflow-y-auto` on dialog content and adding `sticky bottom-0` to the action button area inside event and album create dialogs

### Files to create

- `src/hooks/useKeyboardDismissOnScroll.ts`

### Files to modify

- `src/index.css` — add `scroll-margin-bottom` for inputs/textareas
- `src/pages/Feed.tsx` — add keyboard dismiss on scroll
- `src/pages/Events.tsx` — add keyboard dismiss on scroll, sticky action buttons in dialogs
- `src/pages/Albums.tsx` — add keyboard dismiss on scroll, sticky action buttons in dialogs  
- `src/pages/Settings.tsx` — add keyboard dismiss on scroll
- `src/pages/ProfileView.tsx` — add keyboard dismiss on scroll
- `src/pages/Messages.tsx` — add keyboard dismiss on conversation list scroll, fix member dropdown height for keyboard  
  
Also fix the boxes that are in the create event section where they are overlapping, this is great. 