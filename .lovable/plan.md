

# Expand "Every Plan Includes" Into a Full Feature Showcase Section

## Goal
Transform the small "Every plan includes" feature grid into a larger, more informative section that feels like a proper part of the page rather than a footnote you have to scroll to.

## Changes to `src/components/landing/Pricing.tsx`

### 1. Expand the shared features data
Add more features and organize them into categories with icons and short descriptions instead of just plain text labels. The categories:

- **Sharing**: Unlimited posts and photos, Video sharing
- **Planning**: Event planning and calendars, Photo albums
- **Connection**: Private messaging, Family tree features
- **Access**: Mobile and web access, Circle management tools, Notifications, Content moderation

This brings the count from 8 items to ~12, filling out the grid.

### 2. Redesign the layout
- Make it full-width (`max-w-6xl` to match the pricing cards)
- Use a 2-column grid on mobile, 3 columns on tablet, 4 columns on desktop
- Each feature gets a larger icon (from lucide), a bold title, and a one-line description beneath it
- Add a subtitle below the heading: "No matter which plan you choose, you get the full Familial experience."

### 3. Visual treatment
- Keep the `bg-secondary/30 rounded-2xl` background but increase padding
- Each feature item becomes a mini-card with an icon, title, and description stacked vertically
- More vertical spacing between items for breathing room

### 4. Import additional icons
Add imports for relevant lucide icons: `Camera`, `Calendar`, `MessageCircle`, `TreeDeciduous`, `Smartphone`, `Users`, `Bell`, `Shield`, `Image`, `Video`, `Settings`, `Globe`

## Technical details

Only `src/components/landing/Pricing.tsx` changes. The `sharedFeatures` array becomes an array of objects with `icon`, `title`, and `description` fields. The rendering section is rebuilt with the new layout.

