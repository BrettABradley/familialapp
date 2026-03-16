

## Plan: Add Blog placeholder page and link from footer

### Changes

#### 1. Create `src/pages/Blog.tsx`
- Same layout as About/Careers pages (Header + Footer, prose styling)
- Title: "Blog"
- Placeholder message: "Coming soon — stories, updates, and tips for staying connected as a family."
- Optional: brief note that posts are on the way

#### 2. Update `src/App.tsx`
- Import Blog and add `/blog` as a public route

#### 3. Update `src/components/landing/Footer.tsx`
- Change the Blog `<a href="#">` to `<Link to="/blog">`

### Files to create
- `src/pages/Blog.tsx`

### Files to modify
- `src/App.tsx` (add route)
- `src/components/landing/Footer.tsx` (Blog link ~line 72)

