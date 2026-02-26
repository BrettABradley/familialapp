

## Plan: Make text-only pins clickable + add download button to enlarged view

### 1. Make text-only pins clickable (lines 202-205)
- Add `cursor-pointer` and `onClick={() => setEnlargedPin(pin)}` to the text-only placeholder div so it behaves like image pins.

### 2. Update enlarged dialog to handle text-only pins (lines 287-343)
- Change the condition from `enlargedPin?.image_url && (...)` to always render content when `enlargedPin` exists.
- When there's no `image_url`, show a large styled text card with the title and description instead of an image.
- When there is media, keep existing image/video rendering.

### 3. Add download button to enlarged dialog
- Import `Download` from lucide-react.
- For image/video pins: add a download button that fetches the file and triggers a browser download via `URL.createObjectURL`.
- For text-only pins: add a download button that generates a `.txt` file from the title + content and downloads it.
- Place the download button next to the close button in the top-right corner.

### Files to modify
- `src/components/fridge/FridgeBoard.tsx`

