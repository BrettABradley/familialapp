

# Fix Campfire Safe Area & Notification Button Overlap

## 2 issues, 2 files

### 1. Campfire dialog content sits behind the camera island
**File:** `src/components/fridge/CampfireDialog.tsx`

The campfire hero section starts at `pt-6` (line 159) with no safe-area padding. The close button uses `top-[max(env(safe-area-inset-top,0px),0.75rem)]` but the content itself (fire, stars) doesn't account for the notch.

**Fix:** Add `pt-[max(env(safe-area-inset-top,0px),1.5rem)]` to the hero `div` (line 159) so the entire campfire scene shifts below the Dynamic Island. Also adjust the stars' `top` positions to be relative to the new padding.

### 2. Notification sheet: "Clear all" button overlaps with the Sheet's built-in X button
**File:** `src/components/layout/CircleHeader.tsx`

The mobile notification Sheet (line 173) renders a `SheetHeader` with action buttons (Mark read, Clear all) in a row. The Sheet component automatically appends an X close button at `right-4 top-[max(env(safe-area-inset-top,0px),1.5rem)]`. Since the action buttons sit at the right side of the header, they collide with this X.

**Fix:** Add `pr-12` (right padding) to the `SheetHeader` (line 174) to reserve space for the close button, preventing the overlap.

## Files to modify

| File | Change |
|------|--------|
| `src/components/fridge/CampfireDialog.tsx` | Add safe-area top padding to campfire hero div |
| `src/components/layout/CircleHeader.tsx` | Add `pr-12` to notification SheetHeader |

