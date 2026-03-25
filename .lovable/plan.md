
Goal: fix the bell behavior, clean up the fridge pin dialog edge, upgrade campfire into a richer campsite experience, remove campfire title entry, and make aliases global per person instead of per-circle.

1. Fix the notification bell double-open/immediate-close bug
- Root cause: the same `notifBell` element is rendered in two responsive containers at once (`md/xl hidden` via CSS, but still mounted), so two controlled popovers/sheets share the same `bellOpen` state.
- Update `src/components/layout/CircleHeader.tsx` to render separate notification components per breakpoint instead of reusing one `notifBell` instance in multiple places.
- Keep one mounted bell trigger per layout:
  - mobile: top sheet
  - tablet/desktop (`md` to `xl`): popover next to hamburger
  - wide desktop (`xl+`): popover on right side
- Preserve current “no manual click toggle” approach and keep `onOpenChange` as the only open-state source.

2. Fix the left edge getting clipped in “Pin Something”
- In `src/pages/Fridge.tsx`, adjust the create dialog layout so the form content is not visually jammed against the left edge.
- Likely fix:
  - move the `ScrollArea` padding from the inner wrapper to the dialog content/viewport more evenly
  - remove the asymmetric `pr-4`-only layout
  - ensure the dialog content uses balanced horizontal padding and enough width on mobile/desktop
- Result: the create modal should look centered and clean, especially at the left border.

3. Remove campfire title input and make prompt the only authored field
- The database still needs a `title`, so keep storing a system label like `"Campfire"` behind the scenes.
- In `src/pages/Fridge.tsx`:
  - hide the Title field when `pinType === "campfire"`
  - require only the prompt for campfire creation
  - disable the submit button based on `campfirePrompt` instead of `title`
  - insert `title: "Campfire"` automatically for campfire pins
- In fridge board + campfire dialog, stop presenting the generic title prominently; the prompt becomes the visible focal content.

4. Upgrade campfire into a full campsite experience
- Replace the current minimal fire-only visual with a richer campsite scene in:
  - `src/components/fridge/PixelCampfire.tsx`
  - `src/components/fridge/CampfireDialog.tsx`
- Design direction:
  - pixelated animated fire remains central
  - add campsite environment: night sky, trees/silhouettes, ground ring, rocks/logs, glow
  - keep it CSS-driven/pixel-art styled so it stays lightweight and responsive
- On the fridge board:
  - keep the pin compact, but make the campfire card feel more like a tiny campsite rather than a plain dark square
- In the dialog:
  - make the campsite the main hero area
  - keep mobile-first sizing so the environment still looks good without pushing the story UI too far down

5. Put member avatars around the campfire and make them the story navigation
- In `src/components/fridge/CampfireDialog.tsx`, change the “one-at-a-time” navigation from generic arrows-first to people-first navigation.
- Fetch stories exactly as now, but render contributor avatar chips around/below the campfire.
- Clicking a person:
  - sets that person’s story as the active story
  - highlights their avatar/name
  - shows their story in the main card
- Keep arrows/swipe as optional secondary navigation, but the primary interaction becomes “tap a family member around the fire.”
- If no one has posted yet, show the empty-state and prompt input cleanly.

6. Make aliases global across circles for the same person
- Current issue: `member_aliases` is circle-scoped (`user_id + target_user_id + circle_id`), which conflicts with your requirement.
- Change the data model so aliases are stored per relationship pair, not per circle:
  - one alias per `user_id + target_user_id`
  - remove circle-specific uniqueness from behavior
- Migration plan:
  - deduplicate existing alias rows per pair
  - keep the newest/non-empty alias
  - replace the unique constraint with pair-level uniqueness
  - update RLS to allow managing aliases for people you share a circle with
- Update all lookups:
  - `src/pages/Circles.tsx` member editor should query/save by `user_id + target_user_id`
  - `src/hooks/useFeedPosts.ts` should stop filtering by `circle_id`
  - notification SQL functions should resolve aliases by pair, not by pair+circle
- Result: if you rename someone in one circle, that same alias is used everywhere for that person.

7. Files likely involved
- `src/components/layout/CircleHeader.tsx`
- `src/pages/Fridge.tsx`
- `src/components/fridge/FridgeBoard.tsx`
- `src/components/fridge/CampfireDialog.tsx`
- `src/components/fridge/PixelCampfire.tsx`
- `src/pages/Circles.tsx`
- `src/hooks/useFeedPosts.ts`
- new migration in `supabase/migrations/` to reshape `member_aliases` and update notification functions

8. Technical notes
- No role/auth model changes needed.
- Campfire one-story-per-person rule can stay as-is via the existing `campfire_stories` unique constraint.
- For campfire creation, the UI can remove the title field without changing the non-null `fridge_pins.title` column by auto-populating a system title.
- The bell bug is most likely a rendering/layout duplication bug, not a notification data bug.

Implementation order
1. Bell render fix
2. Fridge create dialog spacing fix
3. Campfire create flow cleanup (prompt-only)
4. Campfire campsite visual + avatar-based story navigation
5. Alias migration + app/query updates
