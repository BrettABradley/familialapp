
Fix the last mobile launch blockers with a narrow, low-risk pass focused only on shared dialog mobile spacing plus the Events/Albums create forms.

1. Fix the top content being blocked on iPhone
- Update `src/components/ui/dialog.tsx` mobile styling so dialogs add safe-area-aware top padding and bottom padding:
  - add top padding using `max(env(safe-area-inset-top), 0.75rem)` behavior
  - add bottom padding for the home indicator / sticky footer
- Keep desktop dialog behavior unchanged
- Keep the Messages page untouched functionally; this is only a spacing/safe-area improvement on the shared dialog shell

2. Make the dialog header stay visible and readable
- In both create dialogs (`Events.tsx`, `Albums.tsx`), make the header area sticky on mobile with a solid background
- This prevents the title/subtitle and red trash button from sliding under the notch/camera area or being visually crowded by the form beneath

3. Stop the keyboard from covering the Event “Place” field
- In `src/pages/Events.tsx`, stop relying only on `input.scrollIntoView()`
- Wrap the create form body in a dedicated scroll container ref and, on focus for Description/Time/Location, scroll the container so the whole field block sits above the keyboard
- Give the Location field extra bottom clearance so there is enough scrollable room even with the calendar above it
- Apply the same stronger focus-scroll pattern to the edit dialog for consistency

4. Make sure important info is not blocked by the camera/notch in Albums
- In `src/pages/Albums.tsx`, keep the red trash button but move the create dialog content closer to the top in a safe-area-aware way
- Ensure the title/description are fully visible on first open and the form starts directly below them without the oversized empty gap shown in the screenshot

5. Preserve Messages behavior
- Do not change `src/pages/Messages.tsx`
- Avoid changing dialog APIs or portal behavior
- Only add mobile-safe spacing to the shared dialog shell, which should improve Messages visually without altering its working interaction pattern

Files to modify
- `src/components/ui/dialog.tsx`
- `src/pages/Events.tsx`
- `src/pages/Albums.tsx`

What I’ll verify during implementation
- Event create title/subtitle + trash button are fully visible below the notch
- Album create title/subtitle + trash button are fully visible below the notch
- Tapping the Event “Place” field scrolls it above the keyboard and keeps it editable
- Sticky create buttons remain reachable and not covered
- Messages dialogs still open and behave the same
