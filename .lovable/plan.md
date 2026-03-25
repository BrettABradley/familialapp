

## Plan: Enlarge X and Download Buttons on All Post-It Dialogs

### Problem
In `FridgeBoard.tsx`, the enlarged pin dialog's X (close) and Download buttons are `h-7 w-7` with `h-4 w-4` icons — much smaller than the campfire dialog's custom close button (`w-10 h-10` with `w-5 h-5` icon). This creates an inconsistency and makes them hard to tap on mobile.

### Changes in `src/components/fridge/FridgeBoard.tsx`

1. **Increase X button size** from `h-7 w-7` to `h-10 w-10`, and its icon from `h-4 w-4` to `h-5 w-5`
2. **Increase Download button size** from `h-7 w-7` to `h-10 w-10`, and its icon from `h-4 w-4` to `h-5 w-5`
3. Add a semi-transparent background (`bg-black/40 backdrop-blur-sm`) and white text color to match the campfire close button style, ensuring visibility over photos

### Files to modify
- `src/components/fridge/FridgeBoard.tsx` — lines 363-398, button sizes and icon sizes

