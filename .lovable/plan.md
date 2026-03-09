

# Notification System Gaps & Enhancement Plan

## Current State

What currently generates notifications:
- **Comments** on your posts (and replies to your comments)
- **Circle invites** (via email invite system)
- **Transfer block / rescue** events
- **Upgrade requests** from circle members
- **Group chat creation** (notifies added members)
- **Subscription changes** (downgrade warnings to circle members)

What does NOT generate notifications:
- Reactions (hearts) on your posts
- New events created in your circle
- Fridge pins
- Direct messages when you're not on the platform
- @mentions in posts or comments
- New members joining your circle
- Event reminders (day-of)
- Album additions (new photos added to shared albums)

There is also no **notification preferences** system — users can't control what they receive.

## Recommended Enhancements (prioritized)

### Tier 1 — Essential for mobile launch

**1. Direct message notifications**
When someone sends you a DM or group chat message and you haven't read it within ~30 seconds, you should get an in-app notification. This is table stakes for a messaging app. Currently zero message notifications exist for DMs.

**2. @mention tagging in feed posts and comments**
- Parse `@DisplayName` in post content and comments
- Show an autocomplete dropdown when typing `@` in the post/comment input
- Create a notification for the tagged user with a deep link to the post
- New notification type: `mention`

**3. Event created notifications**
When a new event is added to a circle, notify all members: "📅 [Name] added '[Event Title]' on [Date] — RSVP now!" with a link to `/events`.

**4. Fridge pin notifications**
When someone pins something to the fridge, notify circle members: "🧲 [Name] pinned '[Title]' to the Family Fridge" — keeps it warm and personal.

**5. Reaction notifications**
When someone hearts your post, notify: "[Name] loved your post." Batch these if multiple reactions come in quickly (e.g., "3 people loved your post").

### Tier 2 — Important for engagement without spam

**6. Notification preferences table**
Create a `notification_preferences` table so users can toggle categories on/off:
- Post reactions (on/off)
- Comments & replies (on/off)
- Messages (on/off, but default ON — this should probably be non-optional)
- Events (on/off)
- Fridge pins (on/off)
- Mentions (on/off, default ON)
- "Follow" specific people — get notified when they post

A settings page section where users control these per-category. This aligns with your anti-spam mission — users opt into what matters to them.

**7. "Follow posts from" specific members**
Let users select specific circle members whose new posts trigger a notification. This is the "post notifications for specific people" feature you mentioned. Stored in a `followed_users` or similar table, scoped per circle.

### Tier 3 — Polish

**8. New member joined notification**
"[Name] just joined [Circle Name]!" — a warm welcome moment.

**9. Event day-of reminder**
A scheduled function that runs daily and sends "Reminder: [Event Title] is today!" to all RSVP'd users (or all circle members).

**10. Album activity notifications**
"[Name] added 5 photos to [Album Name]" — batched, not per-photo.

## What I'd suggest you DON'T do (anti-spam alignment)

- No "someone viewed your profile" notifications
- No digest/summary emails (unless users explicitly opt in later)
- No "you haven't posted in a while" nudges
- No notification sounds/badges for low-priority items by default

## Technical approach

### Database changes
- New `notification_preferences` table (user_id, category, enabled, created_at)
- New `user_follows` table (follower_id, followed_id, circle_id) for per-person post notifications
- Add @mention parsing logic

### Code changes
- `CreatePostForm` and comment input: add @mention autocomplete + parsing
- `Events.tsx`: fire notification on event creation
- `FridgeBoard.tsx`: fire notification on pin creation
- `useFeedPosts.ts`: fire notification on reaction (with dedup logic)
- `Messages.tsx`: fire notification on DM send (if recipient not recently active)
- New Settings section for notification preferences
- Check preferences before inserting notifications

### Edge function (for Tier 3)
- `event-reminders`: scheduled daily cron to send day-of event reminders

## Recommendation

Start with **Tier 1 items (1–5)** — these are the missing basics that every user will expect on mobile. Then add **Tier 2 (preferences + follow)** so users can tune their experience. Tier 3 can come post-launch.

