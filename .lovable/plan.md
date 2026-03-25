
Goal: ensure the campfire dialog shows only one close button on mobile, keeping the larger custom mobile X and removing the duplicate built-in one.

Plan
1. Update `src/components/fridge/CampfireDialog.tsx`
- The duplicate X is coming from `DialogContent`’s built-in close button plus the custom mobile close button already added in the campfire hero.
- Keep the custom large mobile close button.
- Hide the default `DialogContent` close button only for this dialog by adding a scoped class override on `DialogContent` (mobile-only), instead of changing the shared dialog component globally.

2. Preserve desktop behavior
- Make the override mobile-specific so desktop/tablet can still use the standard close button if desired.
- Keep existing z-index/color styling for the campfire dialog so the custom mobile X remains highly visible over the dark background.

3. Verify no other dialogs are affected
- Since the fix will be scoped to `CampfireDialog` only, other dialogs across the app will continue using the shared default close behavior unchanged.

Technical detail
- Best approach: apply a class on `CampfireDialog`’s `DialogContent` like a child selector that hides the Radix close button on small screens only, while leaving the custom `<button>` inside the hero visible.
- Avoid editing `src/components/ui/dialog.tsx` unless absolutely necessary, because that would affect all dialogs in the app.

Files to modify
- `src/components/fridge/CampfireDialog.tsx`
