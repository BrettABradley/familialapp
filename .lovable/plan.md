

# Restructure Pricing Page for Honesty and Clarity

## Problem
Right now each tier lists different features (e.g., "Event planning & calendars" only on Family, "Family tree features" only on Extended), which implies those features are exclusive to paid tiers. In reality, the **only** differences between tiers are circle count and member limits. All features are available to everyone, including free users.

## Approach
Restructure the pricing cards so each tier only highlights its **circle count** and **member limit** as the differentiators. Then add a shared "All plans include" section below the pricing cards that lists every feature available across all tiers.

## Changes to `src/components/landing/Pricing.tsx`

### 1. Simplify the tier feature lists
Each tier card will only show two bullet points -- the things that actually differ:
- **Free**: 1 circle, 8 members per circle
- **Family**: 2 circles, 20 members per circle
- **Extended**: 3 circles, 35 members per circle

### 2. Add a shared features section
Below the three pricing cards (and above the "Custom Plan" card), add a centered section titled **"All plans include"** with a grid of features that apply to every tier:
- Unlimited posts and photos
- Event planning and calendars
- Photo albums
- Family tree features
- Private messaging
- Video sharing
- Mobile and web access
- Circle management tools

### 3. Update tier descriptions
Make the descriptions reinforce that the difference is just scale:
- Free: "For small families getting started"
- Family: "For growing families who need more space"
- Extended: "For large families and reunions"

### Visual Layout

The pricing cards will be cleaner and shorter, making the value proposition obvious at a glance. The shared features grid below will reassure users that they get the full experience regardless of tier.

### Technical Details

Only one file changes: `src/components/landing/Pricing.tsx`.

- Replace the `features` arrays in each tier object with just the 2 differentiating items
- Add a `const sharedFeatures` array with all the common features
- Render a new section between the pricing grid and the "Custom Plan" card using a responsive grid (e.g., `grid-cols-2 md:grid-cols-4`) with check icons

