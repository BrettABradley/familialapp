

## Plan: Filter Content by Selected Circle

When you switch between circles using the dropdown in the header, the Feed currently shows posts from **all** your circles combined. It needs to filter to only show posts from the selected circle. Events, Fridge, and Albums already handle this correctly -- only the Feed needs fixing.

### Changes

**1. `src/hooks/useFeedPosts.ts`** (Feed data hook)
- Change the query on line 67 from using all circle IDs (`circles.map(c => c.id)`) to use only `[selectedCircle]` when a circle is selected
- Add `selectedCircle` to the `useEffect` dependency array (line 61) so posts re-fetch when you switch circles
- Reset posts when switching circles so stale data from the previous circle isn't shown

**2. `src/pages/Feed.tsx`** (Feed page)
- No changes needed -- it already consumes the hook correctly

### How It Works After the Fix

- When you select "Bradley Family" in the header dropdown, only Bradley Family posts appear in the feed
- When you switch to "Hopkins Family," the feed refreshes and shows only Hopkins Family posts
- Creating a new post still targets the currently selected circle (this already works)
- Events, Fridge, Albums, and Messages are already scoped correctly

