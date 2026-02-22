
# Content Moderation for Familial

## Overview

This plan adds an AI-powered content moderation layer that scans text and images before they are published -- on both the circle feed and personal profile uploads. The AI does not store, harvest, or log any user content. It simply evaluates and returns an allow/deny decision in real time.

## How It Works

1. **User creates a post or uploads a profile image** -- before the content is saved to the database, it is sent to a backend function for moderation.
2. **The backend function sends the content to Lovable AI** (Gemini Flash) with a strict system prompt that instructs it to evaluate content safety only -- no data is retained.
3. **The AI returns a verdict**: `allowed` or `denied` with a reason.
4. **If denied**, the user sees a toast message saying the content violates the community guidelines. The post/upload is not saved.
5. **If allowed**, the normal post/upload flow continues.

## What Gets Scanned

| Content Type | Scan Method |
|---|---|
| Post text | Text analysis for explicit/violent/substance content |
| Post images | Image URL analysis via multimodal AI (after upload to storage, before DB insert) |
| Profile image uploads | Same image URL analysis before DB insert |
| Post videos | Thumbnail frame analysis (best-effort with `#t=0.5` frame) |

## Technical Details

### 1. New Edge Function: `moderate-content`

**File:** `supabase/functions/moderate-content/index.ts`

- Accepts `{ text?: string, imageUrls?: string[] }` in the request body
- Uses `LOVABLE_API_KEY` (already configured) to call Lovable AI gateway
- Uses `google/gemini-2.5-flash` for fast, cost-effective multimodal analysis (supports both text and images)
- System prompt instructs the model to act as a content safety classifier only, focusing on:
  - Pornography / nudity / sexually explicit content (primary concern)
  - Graphic violence
  - Substance abuse imagery
- Returns `{ allowed: boolean, reason?: string }`
- No content is logged, stored, or retained -- the AI processes and discards
- Includes CORS headers and proper error handling (429/402 rate limits)

### 2. Update `CreatePostForm.tsx` (Feed Posts)

- After files are uploaded to storage (getting public URLs) but **before** inserting the post into the `posts` table:
  - Call `moderate-content` with the post text and any media URLs
  - If denied: show a toast with the reason, delete the uploaded files from storage (cleanup), and abort the post
  - If allowed: continue with the normal insert flow
- The "Share" button text changes to "Checking..." briefly during moderation

### 3. Update `ProfileView.tsx` (Profile Image Uploads)

- After the image is uploaded to storage but **before** inserting into `profile_images` table:
  - Call `moderate-content` with the image URL
  - If denied: show a toast, delete the uploaded file from storage, and abort
  - If allowed: continue with the DB insert

### 4. Privacy Safeguards

- The system prompt explicitly instructs the AI: "Do not store, log, or retain any content. You are a stateless classifier."
- No user data, IDs, or metadata are sent -- only the raw text and/or image URLs
- The edge function does not log request bodies
- Uses `verify_jwt = false` in config but validates the auth token in code to ensure only authenticated users can call it

### 5. User Experience

- Moderation adds approximately 1-2 seconds to the posting flow
- Users see a brief "Checking content..." state on the button
- If content is denied, they get a clear, non-aggressive message: "This content may violate our community guidelines. Please review and try again."
- The denial reason from AI is kept generic to avoid giving users a "roadmap" to bypass moderation
