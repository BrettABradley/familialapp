

## Plan: Seamless posting and messaging without screen blanking

### Problem
When sending a message or creating a feed post, the entire screen blanks out because:
1. **Feed**: `onPostCreated` calls `fetchPosts(true)` which sets `isLoadingPosts = true`, unmounting all posts and showing skeleton loaders
2. **Messages**: After sending, `fetchMessages()` replaces the entire message list with a server re-fetch, causing a flash

### Changes

**File: `src/hooks/useFeedPosts.ts`**
- In `fetchPosts`, when `reset = true`, stop setting `isLoadingPosts = true`. Instead, silently fetch and replace posts in the background. Only show the loading skeleton on the very first load (when `posts.length === 0`).

**File: `src/components/feed/CreatePostForm.tsx`**
- After a successful insert, optimistically prepend the new post into the feed state before calling `onPostCreated` to do a background refresh. This makes the post appear instantly.
- Change `onPostCreated` callback to accept an optional optimistic post object, or keep the current pattern but ensure the refresh is silent.

**File: `src/pages/Messages.tsx`**
- **DM send**: After successful insert, optimistically append the new message to `messages` state immediately, then do a silent background `fetchMessages()` without clearing existing messages.
- **Group send**: Same approach — optimistically append to `groupMessages`, then silently refresh.
- Both `fetchMessages` and `fetchGroupMessages` already replace state without a loading flag, so the main fix is adding the optimistic local append before the fetch so the message appears instantly.

### Summary of approach
- Optimistic local state update first (instant UI feedback)
- Silent background refetch to sync with server (no loading spinners)
- Only show skeleton loaders on initial page load, never on subsequent refreshes

