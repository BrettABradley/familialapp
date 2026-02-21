

## Plan: Voice Notes, Video Uploads, and Clickable Links

### 1. Feed: Support Video and Voice Note Uploads

**CreatePostForm.tsx** changes:
- Update the file input `accept` attribute to include audio: `accept="image/*,video/*,audio/*"`
- Add a separate "Record Voice Note" button using the browser's `MediaRecorder` API for quick in-app voice recording
- Add file size validation: reject files over 100MB for videos, 10MB for audio, 20MB for images
- Update the preview grid to show video thumbnails (using `<video>` element) and audio players (using `<audio>` element) instead of only `<img>`
- Change the "Add Photos" button label to "Add Media"

**PostCard.tsx** changes:
- Detect media type from URL file extension (image vs video vs audio)
- Render `<video controls>` for video files (.mp4, .mov, .webm, .avi)
- Render `<audio controls>` for audio files (.mp3, .wav, .ogg, .webm, .m4a)
- Keep `<img>` for image files
- Add clickable link detection in post content: parse URLs in text and render them as `<a href="..." target="_blank" rel="noopener noreferrer">` tags so links open properly in new tabs

### 2. Fridge: Voice Note Pin Type

**Fridge.tsx** changes:
- Add "Voice Note" as a new pin type option in the type dropdown
- When "Voice Note" is selected, show a file picker for audio files OR a "Record" button using `MediaRecorder`
- Upload audio to the existing `post-media` storage bucket
- Store the audio URL in the `image_url` column (reusing the existing field for media)

**FridgeBoard.tsx** changes:
- When a pin has an audio URL (detected by file extension), render a small audio player instead of an image inside the polaroid frame
- Show a speaker/microphone icon for voice note pins without a visual

### 3. New Component: VoiceRecorder

Create **src/components/shared/VoiceRecorder.tsx**:
- A reusable record button component using `navigator.mediaDevices.getUserMedia` and `MediaRecorder`
- Shows record/stop controls and a waveform-style visual indicator
- Returns a `Blob` when recording finishes
- Max recording duration: 2 minutes
- Used by both the Feed CreatePostForm and the Fridge pin dialog

### 4. New Utility: LinkifiedText

Create **src/components/shared/LinkifiedText.tsx**:
- A component that takes a string and renders it with URLs automatically converted to clickable `<a>` tags
- Uses a regex to detect URLs (http/https/www patterns)
- Links open in a new tab with `target="_blank" rel="noopener noreferrer"`
- Styled with underline and primary color to be clearly clickable

### 5. Storage Bucket Update

**Database migration** to increase the file size limit on the `post-media` bucket:
- Update the storage bucket to allow files up to 100MB (for video uploads)
- Add an RLS policy if not already present for authenticated uploads

---

### Technical Details

**File type detection helper** (used in PostCard and FridgeBoard):
```typescript
function getMediaType(url: string): 'image' | 'video' | 'audio' {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
  if (['mp4','mov','webm','avi','mkv'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','m4a','aac','webm'].includes(ext)) return 'audio';
  return 'image';
}
```

**VoiceRecorder** uses standard browser APIs:
- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder` with `audio/webm` mime type
- Returns recorded blob for upload

**LinkifiedText** regex pattern:
```typescript
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
```

**Files to create:**
- `src/components/shared/VoiceRecorder.tsx`
- `src/components/shared/LinkifiedText.tsx`
- `src/lib/mediaUtils.ts` (getMediaType helper)

**Files to modify:**
- `src/components/feed/CreatePostForm.tsx`
- `src/components/feed/PostCard.tsx`
- `src/pages/Fridge.tsx`
- `src/components/fridge/FridgeBoard.tsx`

**Database migration:**
- Update `post-media` bucket file size limit to 100MB

