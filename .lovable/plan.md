

## Plan: Campfire Pins, Relationship Aliases, Video Thumbnails, and Notification Bell Fix

This is a large feature set spanning 5 distinct areas. Here is the plan broken into phases.

---

### 1. Campfire Environment on the Fridge

**Concept**: A new pin type "campfire" that opens an interactive environment where each circle member can contribute one story, prompted by a question set by the creator. The campfire displays as an animated pixelated campfire on the fridge board, and opens to a "talking stick" one-at-a-time story viewer.

**Database changes**:
- New table `campfire_stories` with columns: `id`, `fridge_pin_id` (FK to fridge_pins), `author_id`, `content` (text, max 500 chars), `created_at`. Unique constraint on `(fridge_pin_id, author_id)` to enforce one story per person.
- Add `campfire_prompt` column to `fridge_pins` (nullable text, max 200 chars) — stores the creator's custom prompt/question.
- RLS: circle members can view/insert stories for pins in their circle; one per author enforced by unique constraint.

**UI changes**:
- **Fridge pin creation dialog** (`src/pages/Fridge.tsx`): When pin type is "campfire", show a "Campfire Prompt" input instead of description (e.g., "What's your favorite family road trip?"). No image upload for campfire type.
- **FridgeBoard** (`src/components/fridge/FridgeBoard.tsx`): Campfire pins render with an animated pixelated campfire (CSS keyframe animation of flame sprites using layered divs with pixel-art styling) instead of a photo. Clicking opens a campfire dialog.
- **New component** `src/components/fridge/CampfireDialog.tsx`: Full-screen-ish dialog showing the animated campfire at top, the prompt, and a one-at-a-time story carousel. Users swipe/tap through stories. If the current user hasn't submitted, show a text input to add their story. Shows author avatar + name per story.
- Animated campfire: 3-4 layered colored divs (orange, red, yellow) with CSS `@keyframes` for a flickering pixel-art fire effect. No external assets needed.

**Mobile**: Dialog uses full-width sheet. Touch-friendly story navigation with swipe or arrow buttons.

---

### 2. Relationship Aliases for Personalized Notifications

**Concept**: Each user can assign a personal alias (e.g., "Aunt Sarah", "Dad") to every other member in their circles. Notifications use the alias instead of the display name. When @mentioning, the autocomplete shows display names but the notification says "Your [alias] posted a photo."

**Database changes**:
- New table `member_aliases` with columns: `id`, `user_id` (who sets the alias), `target_user_id` (who the alias is for), `circle_id`, `alias` (text, max 50 chars), `created_at`. Unique constraint on `(user_id, target_user_id, circle_id)`.
- RLS: Users can CRUD their own aliases (where `user_id = auth.uid()`). Users can view aliases where they are the target or setter within shared circles.

**UI changes**:
- **Members dialog** (`src/pages/Circles.tsx`): Add a small edit icon next to each member's name. Tapping reveals an inline input field to set/edit the alias (e.g., placeholder "e.g., Aunt Sarah"). Saves on blur or enter. Shows current alias as a subtle badge below the display name.
- **Notification generation** (`src/hooks/useFeedPosts.ts` and DB functions): When creating notifications (comments, mentions, fridge pins, events, DMs), look up the alias the recipient has set for the actor. Use alias if set, fall back to display name.
  - Client-side notifications (comments in `useFeedPosts.ts`): Fetch alias before inserting notification.
  - DB trigger notifications (`notify_on_fridge_pin`, `notify_on_event_created`, `notify_on_dm`, `create_mention_notifications`): Update these SECURITY DEFINER functions to look up alias from `member_aliases` table.
- **@mention display**: MentionInput autocomplete continues showing display names. The notification message uses the recipient's alias for the actor.

---

### 3. Video Thumbnails in Feed (Image-Sized Preview → Fullscreen Lightbox)

**Current problem**: Videos display at their native aspect ratio (often wide 16:9 or tall 9:16), looking inconsistent next to the square image grid.

**Fix in `src/components/feed/PostCard.tsx`**:
- Videos in mixed-media posts render as square thumbnails (same `aspect-square` + `object-cover` as images) within the same grid. Show a play button overlay on the thumbnail.
- The `VideoPlayer` component gets a "thumbnail mode": renders a square-cropped poster frame with a centered play icon overlay.
- On click/tap, opens a fullscreen `Dialog` lightbox with the video at its native aspect ratio and full controls.
- Single-video posts also use the thumbnail preview (but can be full-width square, not in grid) with the same click-to-lightbox behavior.
- Thumbnail generation already exists (canvas first-frame capture) — reuse that.

---

### 4. Notification Bell Fix (Doesn't Stay Open + Double Popup)

**Current problem**: The bell uses `onClick` to toggle `bellOpen` state AND is wrapped in a `Popover`/`Sheet` that also manages open state via `onOpenChange`. This causes conflicts — clicking the bell toggles state while the popover also tries to manage it, leading to double-open or instant-close.

**Fix in `src/components/layout/CircleHeader.tsx`**:
- Remove the manual `onClick={() => setBellOpen(!bellOpen)}` from the bell button. Let the `Popover`/`Sheet` component handle open state entirely through its `onOpenChange` prop and trigger.
- For desktop: Use `PopoverTrigger` as the bell button (already done) but remove the conflicting onClick.
- For mobile: Same — let `SheetTrigger` handle it.
- This eliminates the race condition between manual state toggle and component-managed state.

---

### Files to create
- `src/components/fridge/CampfireDialog.tsx` — Campfire story viewer + submission
- `src/components/fridge/PixelCampfire.tsx` — Animated pixel-art campfire component

### Files to modify
- `src/pages/Fridge.tsx` — Add campfire pin type with prompt input
- `src/components/fridge/FridgeBoard.tsx` — Render campfire pins with animation, open CampfireDialog on click
- `src/components/feed/PostCard.tsx` — Video thumbnail mode + lightbox
- `src/components/layout/CircleHeader.tsx` — Fix bell onClick conflict
- `src/pages/Circles.tsx` — Add inline alias editor in Members dialog
- `src/hooks/useFeedPosts.ts` — Look up alias when creating comment notifications

### Database migrations
1. Add `campfire_prompt` column to `fridge_pins`
2. Create `campfire_stories` table with RLS
3. Create `member_aliases` table with RLS
4. Update notification DB functions to use aliases

### Summary of scope
- Campfire environment (new pin type + interactive story experience)
- Relationship aliases (personalized notification names)
- Video thumbnails (square preview → fullscreen lightbox)
- Notification bell fix (remove conflicting onClick)

