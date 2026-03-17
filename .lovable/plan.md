
Fix the last mobile launch blockers with a targeted pass on the two create dialogs plus the mobile notifications sheet, without touching Messages behavior.

1. Fix the album/event header “bleed” and blocked top content
- The current sticky headers use negative top offsets inside `DialogContent`, which is likely causing the white panel to overlap the first field.
- Update the create-dialog structure in `src/pages/Albums.tsx` and `src/pages/Events.tsx` so the header stays sticky inside a dedicated inner scroll area instead of using the full dialog body as the scroller.
- Keep the dialog shell safe-area aware, but remove the layout pattern that lets the white header/background slide down into the first input.

2. Make both dialog titles centered and move the trash icon farther right
- In both create dialogs, use a centered header layout with:
  - title + subtitle centered
  - trash button positioned independently on the far right
- This avoids the title shifting left because of the trash button and matches the launch-ready polish you want.

3. Make every create field rise above the keyboard reliably
- In `src/pages/Events.tsx` and `src/pages/Albums.tsx`, stop relying only on `input.scrollIntoView()`.
- Add dedicated scroll-container refs for each dialog body and scroll the container itself when a field is focused.
- Apply this to all create fields, especially:
  - Event: Description, Time, Place/Location
  - Album: Album Name, Description
- Add stronger bottom clearance so the Place field can move fully above the keyboard even with the calendar above it.

4. Keep sticky action buttons reachable without hiding content
- Keep the bottom CTA sticky, but add proper bottom spacing inside the scrollable form body so the last focused field is not trapped behind the keyboard or the sticky action area.

5. Fix the mobile notifications close button
- The close button for the top notifications sheet is currently too close to the safe-area/top nav.
- Update the mobile notification sheet in `src/components/layout/CircleHeader.tsx` (preferred local fix) so its close button is pushed lower and remains tappable below the notch/top bar.
- Avoid changing sheet behavior globally unless necessary, so the side menu and other sheets stay stable.

Files to update
- `src/pages/Events.tsx`
- `src/pages/Albums.tsx`
- `src/components/layout/CircleHeader.tsx`
- Possibly `src/components/ui/dialog.tsx` only if the shared mobile dialog shell still needs a small spacing adjustment after the page-level fixes

What I’ll preserve
- Messages page architecture and behavior
- Desktop dialog layout
- Existing create/edit logic and sticky mobile actions

What I’ll verify in implementation
- No white header/background bleeding into the first album/event field
- Create Event and Create Album titles are centered
- Trash can sits farther right and remains easy to tap
- Focusing Place in Create Event moves it fully above the keyboard
- Focusing album fields also keeps them visible above the keyboard
- Notifications “X” sits lower and is clickable on mobile
