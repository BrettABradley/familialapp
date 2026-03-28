

# Fix SEO Image to Show Familial Logo

## Problem
The current `public/og-image.jpg` shows the Lovable logo in social sharing previews.

## Solution
1. **Copy the uploaded logo** (`Familial_JPG_Black-2.jpg`) to `public/og-image.jpg`, replacing the existing Lovable-branded image.
2. No code changes needed — `index.html` already references `/og-image.jpg` for both `og:image` and `twitter:image`.

## Note
After deployment, cached previews on social platforms may take time to update. Use Facebook's Sharing Debugger or Twitter's Card Validator to force a refresh.

