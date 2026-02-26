

## Plan: Drag-and-drop album uploads + fix HEIC conversion

### Changes

#### 1. Fix HEIC conversion failure (`src/lib/heicConverter.ts`)
The `heic2any` library can fail silently or throw on certain HEIC variants. Fix by:
- Converting files sequentially instead of `Promise.all` (avoids memory pressure with multiple large HEIC files)
- Adding a per-file try/catch that skips failed conversions gracefully instead of aborting the entire batch
- Reading the file as an ArrayBuffer first and creating a fresh Blob before passing to `heic2any` (some browsers pass File objects that `heic2any` can't read directly)

#### 2. Add drag-and-drop to album detail view (`src/pages/Albums.tsx`)
- Add `isDragging` state
- Add `onDragOver`, `onDragLeave`, `onDrop` handlers to the album detail `<main>` wrapper
- On drop, extract files from `event.dataTransfer.files`, run through the same HEIC conversion + upload pipeline as `handleFileUpload`
- Extract shared upload logic into a `processAndUploadFiles(files: File[])` function used by both the file input handler and the drop handler
- Show a visual drop zone overlay (dashed border + "Drop photos here" text) when `isDragging` is true

### Files to modify
- `src/lib/heicConverter.ts` — make conversion more robust
- `src/pages/Albums.tsx` — add drag-and-drop + refactor upload logic

