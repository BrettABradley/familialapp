

# Two Changes: Pricing Layout Polish + Link Preview Cards in Feed

## 1. Pricing Page - Move "All Plans Include" Above Tiers

Restructure the pricing section so the shared features appear **above** the pricing cards, reinforcing that every feature is available on every plan before users even look at prices.

### Layout order (top to bottom):
1. Title: "Simple, Transparent Pricing"
2. Subtitle
3. **"All plans include"** section with the feature grid (moved up)
4. A subtle label like "Choose your circle size" to transition into tiers
5. The three pricing cards
6. Custom plan card

### Styling improvements:
- Wrap the shared features in a subtle card/background (e.g., `bg-secondary/30 rounded-2xl p-8`) to visually group them
- Add a small transition heading between the features and the pricing cards

### File changed: `src/components/landing/Pricing.tsx`

---

## 2. Link Preview Cards in Feed (Open Graph Previews)

When a user posts a URL, show a rich link preview card below the post text -- similar to how X/Twitter displays them (image, title, description, domain).

### Approach:
- **New Edge Function** (`fetch-link-preview`): Takes a URL, fetches the page HTML server-side, parses Open Graph meta tags (`og:title`, `og:description`, `og:image`, `og:url`), and returns the metadata as JSON. This avoids CORS issues from client-side fetching.
- **New Component** (`LinkPreviewCard`): A card that displays the OG image, title, description, and domain in a clean, X-style layout (image on top, text below, rounded corners, clickable).
- **Integration into PostCard**: After rendering the post content text, extract the first URL from the post content. If found, render `LinkPreviewCard` which calls the edge function to get preview data, caches the result, and displays it.

### Edge Function: `supabase/functions/fetch-link-preview/index.ts`
- Accepts `{ url: string }` in the request body
- Fetches the URL with a timeout (5 seconds)
- Parses `<meta property="og:...">` and `<meta name="twitter:...">` tags from the HTML
- Returns `{ title, description, image, url, domain }`
- Handles errors gracefully (returns empty object if fetch fails)

### New Component: `src/components/feed/LinkPreviewCard.tsx`
- Takes a `url` prop
- On mount, calls the `fetch-link-preview` edge function
- Displays a card with:
  - OG image (if available) at the top, aspect-ratio constrained
  - Title (bold, truncated to 2 lines)
  - Description (muted, truncated to 2 lines)
  - Domain name at the bottom
- Entire card is clickable, opens URL in new tab
- Shows a subtle skeleton while loading
- Renders nothing if no OG data is found

### PostCard Integration: `src/components/feed/PostCard.tsx`
- Extract the first URL from `post.content` using the same URL regex pattern
- Render `<LinkPreviewCard url={firstUrl} />` below the text content and above the media grid

### Files changed/created:
| File | Change |
|------|--------|
| `src/components/landing/Pricing.tsx` | Move shared features above pricing cards, add polish |
| `supabase/functions/fetch-link-preview/index.ts` | New edge function to fetch OG metadata |
| `src/components/feed/LinkPreviewCard.tsx` | New component for rich link preview display |
| `src/components/feed/PostCard.tsx` | Add link preview rendering below post text |

