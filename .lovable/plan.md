

# Plan: Media Attachments in Private & Group Messages

## Overview

Add the ability to attach images, videos, and audio files to both DM and group chat messages, reusing the same patterns already established in the feed's `CreatePostForm`.

## Database Changes

### 1. Add `media_urls` column to both message tables

```sql
ALTER TABLE private_messages ADD COLUMN media_urls text[] DEFAULT '{}';
ALTER TABLE group_chat_messages ADD COLUMN media_urls text[] DEFAULT '{}';
```

No RLS changes needed — existing policies already cover INSERT/SELECT on these tables.

## Code Changes

### 2. `src/pages/Messages.tsx` — Major updates

**State additions:**
- `selectedFiles: File[]`, `previewUrls: string[]`, `uploadProgress: number | null` — same pattern as `CreatePostForm`

**New imports:**
- `Paperclip`, `X` from lucide-react
- `validateFileSize`, `getFileMediaType` from `@/lib/mediaUtils`
- `VoiceRecorder` from `@/components/shared/VoiceRecorder`

**File handling functions (copy from CreatePostForm pattern):**
- `handleFileSelect` — validate size, limit to 4 files, generate preview URLs
- `handleVoiceRecording` — convert blob to File, add to selectedFiles
- `removeFile` — cleanup preview URL, remove from arrays
- `uploadFiles` — upload to `post-media` bucket, return public URLs

**Update `handleSendMessage`:**
- Allow sending when `newMessage.trim() || selectedFiles.length > 0` (not just text)
- Upload files first, then insert message with `media_urls` array
- Clear file state after send

**Update `Message` and `GroupMessage` interfaces:**
- Add `media_urls?: string[]` to both

**Update message rendering (both DM and group views):**
- After the text `<p>` tag, render media attachments if `msg.media_urls?.length > 0`
- Images: thumbnail with click-to-enlarge potential
- Videos: small `<video>` element with controls
- Audio: `<audio>` element with controls
- Use `getMediaType` from `@/lib/mediaUtils` to determine rendering

**Update input area (both DM and group views):**
- Replace the single `<Input>` + `<Button>` row with a slightly richer layout:
  - Row of file previews above the input (if any files selected)
  - Hidden `<input type="file">` triggered by a Paperclip button
  - `VoiceRecorder` component
  - Text input
  - Send button — enabled when text OR files present
- Upload progress bar shown during send

### 3. Update send button disabled logic

Currently: `disabled={!newMessage.trim() || isSending}`
New: `disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending}`

## Files to modify
- `src/pages/Messages.tsx` — all UI and logic changes
- Database migration — add `media_urls` column to `private_messages` and `group_chat_messages`

## What stays the same
- Storage bucket: reuses existing `post-media` bucket (already public)
- File validation: reuses `validateFileSize` and `getFileMediaType` from `@/lib/mediaUtils`
- Voice recording: reuses existing `VoiceRecorder` component
- Max 4 files per message, same size limits as feed posts

