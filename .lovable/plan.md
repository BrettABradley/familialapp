
# Persistent Layout with Skeleton Loaders

## What You'll Get

When you navigate between pages (Feed, Events, Albums, etc.), the header will stay in place without flickering. While data is loading on a new page, you'll see smooth skeleton placeholders instead of a blank screen or the loading text.

## Architecture Changes

### 1. Create a New Shared Layout Component
A wrapper component that:
- Renders the header once and keeps it mounted
- Shares circle and profile data across all child pages
- Shows skeleton loaders while the initial data loads

### 2. Create Header Skeleton Component
A visual placeholder that mimics the header structure:
- Logo placeholder
- Circle selector skeleton
- Navigation button skeletons

### 3. Provide Shared Data via Context
Create a context provider that:
- Fetches circles and profile data once
- Makes this data available to all pages
- Prevents redundant API calls when navigating

### 4. Update App Router
Wrap authenticated routes in the new layout so they share the persistent header.

---

## Technical Details

### New Files to Create

**`src/components/layout/AppLayout.tsx`**
- Main layout wrapper for authenticated pages
- Contains the persistent `CircleHeader`
- Uses React Router's `<Outlet />` for child routes
- Manages redirect to `/auth` if not logged in

**`src/components/layout/CircleHeaderSkeleton.tsx`**
- Skeleton version of the header
- Shows while circles data is loading
- Matches the header dimensions to prevent layout shift

**`src/contexts/CircleContext.tsx`**
- Context provider for shared circle/profile state
- Fetches circles and profile on mount
- Exposes `circles`, `selectedCircle`, `setSelectedCircle`, `profile`, and `isLoading`

### Files to Modify

**`src/App.tsx`**
- Add nested routes under a parent `<Route>` using `AppLayout`
- Landing page and auth page remain outside the layout

**`src/components/layout/CircleHeader.tsx`**
- Accept optional `isLoading` prop
- When loading, render skeleton instead of actual content

**Individual Pages (Feed, Events, Albums, Messages, etc.)**
- Remove local circle/profile fetching logic
- Import data from `CircleContext` instead
- Remove their own header rendering (layout handles it)

---

## Route Structure After Changes

```text
/            -> Index (landing page, no layout)
/auth        -> Auth (login/signup, no layout)

<AppLayout>  -> Persistent header + mobile nav
  /feed      -> Feed content only
  /events    -> Events content only
  /albums    -> Albums content only
  /circles   -> Circles content only
  /profile   -> Profile content only
  /messages  -> Messages content only
  /fridge    -> Fridge content only
  /family-tree -> FamilyTree content only
  /notifications -> Notifications content only
</AppLayout>
```

---

## Skeleton Loader Design

The header skeleton will show:
- A pulsing rectangle for the logo
- A pulsing rectangle for the circle selector
- Pulsing circles/rectangles for navigation buttons

This matches the existing skeleton style in your codebase (`animate-pulse rounded-md bg-muted`).

---

## Benefits

1. **No header flash on navigation** - Header stays mounted, only page content changes
2. **Faster perceived navigation** - Circle data is already loaded
3. **Reduced API calls** - Circles and profile fetched once, not per-page
4. **Consistent loading experience** - Skeleton matches final layout, no layout shift
5. **Cleaner page components** - Pages focus on their own content, not shared data

---

## Implementation Order

1. Create `CircleContext` with shared data fetching
2. Create `CircleHeaderSkeleton` component
3. Update `CircleHeader` to support loading state
4. Create `AppLayout` with persistent header and outlet
5. Update `App.tsx` router with nested routes
6. Refactor each page to use context instead of local fetching
7. Test navigation between pages to verify no header re-render
