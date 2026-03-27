

## Plan: Pull-to-Refresh on Mobile App Pages

### What
Add native-feel pull-to-refresh behavior so that scrolling to the top and pulling down triggers a data refresh. Only active on the native Capacitor app (not web browser).

### Approach
Create a reusable `usePullToRefresh` hook that listens for `touchstart`/`touchmove`/`touchend` on a scrollable container. When the user pulls down while already at `scrollTop === 0`, show a small spinner indicator and call the provided refresh callback. The hook checks `Capacitor.isNativePlatform()` so it's a no-op on web.

Create a small `PullToRefreshIndicator` component that renders the animated spinner at the top when pulling.

### Changes

#### 1. New: `src/hooks/usePullToRefresh.ts`
- Touch gesture detection: track pull distance when container is at scroll top
- Threshold of ~60px to trigger refresh
- Returns `{ isRefreshing, pullDistance, containerRef }` 
- Calls provided `onRefresh` async callback, sets `isRefreshing` during execution
- Only activates on native platform (`Capacitor.isNativePlatform()`)

#### 2. New: `src/components/shared/PullToRefreshWrapper.tsx`
- Wraps children with the pull indicator (a spinning arrow/loader that appears when pulling down)
- Shows a `Loader2` spinner during refresh
- Applies CSS transform to slide content down proportional to pull distance

#### 3. `src/pages/Feed.tsx`
- Wrap the `<main>` content in `PullToRefreshWrapper` with `onRefresh={() => fetchPosts(true)}`

#### 4. `src/pages/Events.tsx`
- Wrap content in `PullToRefreshWrapper` with `onRefresh` calling `fetchEvents()` and `fetchPastEvents()`

#### 5. `src/pages/Albums.tsx`
- Wrap content in `PullToRefreshWrapper` with `onRefresh={() => fetchAlbums()}`

#### 6. `src/pages/Messages.tsx`
- Wrap content in `PullToRefreshWrapper` with `onRefresh={() => fetchConversations()}`

#### 7. `src/pages/Fridge.tsx`
- Wrap content in `PullToRefreshWrapper` with `onRefresh={() => fetchPins()}`

### Files to create
- `src/hooks/usePullToRefresh.ts`
- `src/components/shared/PullToRefreshWrapper.tsx`

### Files to modify
- `src/pages/Feed.tsx`
- `src/pages/Events.tsx`
- `src/pages/Albums.tsx`
- `src/pages/Messages.tsx`
- `src/pages/Fridge.tsx`

