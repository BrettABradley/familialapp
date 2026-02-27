

## Plan: Add About page and link it in the footer

### Changes

#### 1. Create `src/pages/About.tsx`
- Same layout as legal pages (Header + Footer wrapping, prose styling)
- Tailored "About Familial" content covering:
  - **Our Story**: Familial was born from a simple belief — families deserve a private space to connect without algorithms, ads, or data harvesting
  - **Our Mission**: To give families a living scrapbook — a place to share moments, plan events, and stay close without the noise of public social media
  - **What Makes Us Different**: No tracking, no ads, no algorithms, chronological feed, Circles for contextual sharing, private by design
  - **Who We Are**: Familial LLC, based in Arizona, built by people who believe technology should bring families closer, not exploit them
  - **Contact**: support@familialmedia.com, (480) 648-9596

#### 2. Update `src/App.tsx`
- Import About and add `/about` as a public route

#### 3. Update `src/components/landing/Footer.tsx`
- Change the "About" link under Company from `<a href="#">` to `<Link to="/about">`

#### 4. Update `src/components/landing/Header.tsx`
- Add an "About" nav link in both desktop and mobile navigation pointing to `/about`

### Files to create
- `src/pages/About.tsx`

### Files to modify
- `src/App.tsx`
- `src/components/landing/Footer.tsx`
- `src/components/landing/Header.tsx`

