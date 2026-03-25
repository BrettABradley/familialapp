

## Plan: Unified Native Close Button Experience Across All Dialogs

### Problem
Close buttons across the app are inconsistent — some are too high (behind the notch), some are too small, and some use the default Radix close button which doesn't match the native mobile feel. The campfire close button also uses `md:hidden` which may not trigger correctly in Capacitor.

### Strategy
Two-pronged approach:
1. **Fix the global defaults** (dialog.tsx and sheet.tsx) so every dialog automatically gets a properly sized, properly positioned close button
2. **Fix media lightboxes** to use custom button rows above content (with download + close) and hide the default close button

---

### 1. `src/components/ui/dialog.tsx` — Global dialog close button
- Increase icon from `h-4 w-4` to `h-5 w-5` for better visibility
- The button already has `min-h-[44px] min-w-[44px]` touch targets, which is good
- The `pt-[max(env(safe-area-inset-top,0px),1.5rem)]` on the container already provides notch clearance — no change needed there

### 2. `src/components/ui/sheet.tsx` — Notification sheet close button
- Increase close button size to `min-h-[44px] min-w-[44px] flex items-center justify-center`
- Change position from `top-4` to `top-6` for better safe-area clearance on the notification sheet
- Increase icon from `h-4 w-4` to `h-5 w-5`

### 3. `src/components/fridge/CampfireDialog.tsx` — Campfire close button
- Remove `md:hidden` from the custom close button so it always shows (Capacitor may report desktop viewport width)

### 4. `src/components/feed/PostCard.tsx` — Circle feed image + video lightboxes
- **Image lightbox**: Hide default close button (`[&>button:last-child]:hidden`), add custom button row above image with Download + X buttons (`h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white`), center media with `max-h-[75vh]`
- **Video lightbox**: Same treatment — hide default, add custom X button above video, center media

### 5. `src/pages/Albums.tsx` — Album photo lightbox
- Hide default close button (`[&>button:last-child]:hidden`)
- Add custom button row above the photo with Download + X buttons matching the standard style
- Move existing download button from below the image to the top row

### 6. `src/pages/ProfileView.tsx` — Profile post lightbox
- Already has custom buttons and `[&>button:last-child]:hidden` — just add `pt-2` to the button row for extra safe-area breathing room on mobile

### 7. `src/pages/Fridge.tsx` — "Pin to Fridge" creation dialog
- Uses default DialogContent close button which is fine for form dialogs — the global dialog.tsx fix handles this

### 8. `src/pages/Events.tsx` — Create/Edit Event dialogs
- Already have `[&>button:last-child]:hidden` with custom close buttons — no changes needed

### Files to modify
- `src/components/ui/dialog.tsx` — enlarge default close icon
- `src/components/ui/sheet.tsx` — enlarge and reposition close button
- `src/components/fridge/CampfireDialog.tsx` — remove `md:hidden`
- `src/components/feed/PostCard.tsx` — custom close/download on both lightboxes
- `src/pages/Albums.tsx` — custom close/download row above photo
- `src/pages/ProfileView.tsx` — add top spacing to button row

