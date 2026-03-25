

## Plan: Add Voice Memos to Campfire Stories

### Problem
Campfire stories currently only support text. Users want to record and share 2-minute voice memos as campfire responses.

### Changes

#### 1. Database Migration
- Add `audio_url text` nullable column to `campfire_stories` table
- Update the validation trigger to allow stories with audio but no text content (currently `content` is NOT NULL)

#### 2. `src/components/fridge/CampfireDialog.tsx`
- Import `VoiceRecorder` component (already exists, supports 2-min max)
- Add state for recorded audio blob/file and preview URL
- In the submit form area, add a VoiceRecorder below the textarea
- When a voice memo is recorded, show an audio player preview with a Remove button
- On submit: if audio exists, upload to `post-media` storage bucket, get public URL, and include `audio_url` in the insert
- Allow submission with text-only, audio-only, or both
- In the chat bubble display area, render an `<audio>` player when `currentStory.audio_url` exists (alongside any text)
- Update the `CampfireStory` interface to include `audio_url`

#### 3. Content length adjustment
- Make `content` column nullable or allow empty string when audio is provided — handled via migration changing `content` to nullable with a check that at least one of content/audio_url is present

### Files to modify
- New migration SQL — add `audio_url` column, make `content` nullable, add validation
- `src/components/fridge/CampfireDialog.tsx` — voice recording UI + audio playback in stories

