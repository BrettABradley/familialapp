

# SEO Optimization — Safe, Additive Changes Only

All changes below are purely additive (new files, new meta tags, new component). Nothing existing gets removed or restructured.

## 1. Add `react-helmet-async` for per-page meta tags

Install `react-helmet-async` and wrap `App` with `<HelmetProvider>`. Create a small `<SEO>` component that accepts `title`, `description`, `path` props and renders appropriate `<Helmet>` tags (title, meta description, canonical URL, og:title, og:description, og:url).

Add `<SEO>` to each public page with unique metadata:
- **/** — "Familial - Private Social Network for Families"
- **/about** — "About Familial - Our Story & Mission"
- **/support** — "Support & How-To Guide - Familial"
- **/blog** — "Blog - Familial"
- **/careers** — "Careers at Familial"
- **/privacy** — "Privacy Policy - Familial"
- **/terms** — "Terms of Service - Familial"
- **/cookies** — "Cookie Policy - Familial"

Each page gets a unique `<meta name="description">` and canonical `<link rel="canonical">`.

## 2. Add `og:url` to `index.html`

Add the missing `<meta property="og:url" content="https://familialapp.lovable.app" />` tag to `index.html` (the per-page `<SEO>` component will override this dynamically).

## 3. Create `public/sitemap.xml`

Static sitemap listing all public pages with `lastmod` dates:
```
/
/about
/support
/blog
/careers
/privacy
/terms
/cookies
```

## 4. Update `public/robots.txt`

Add the Sitemap directive at the bottom:
```
Sitemap: https://familialapp.lovable.app/sitemap.xml
```

## 5. Add JSON-LD structured data to homepage

Add an `Organization` schema to the `<SEO>` component on the homepage only:
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Familial",
  "url": "https://familialapp.lovable.app",
  "logo": "https://familialapp.lovable.app/og-image.jpg",
  "description": "A private social space for the people who matter most."
}
```

## What this does NOT touch
- No changes to routing, layout, or existing components
- No changes to authenticated pages
- No database or backend changes
- Existing `index.html` meta tags remain as fallbacks

## Files

| Action | File |
|--------|------|
| Install | `react-helmet-async` |
| Create | `src/components/shared/SEO.tsx` |
| Modify | `src/App.tsx` — add `HelmetProvider` wrapper |
| Modify | `src/pages/Index.tsx` — add `<SEO>` with JSON-LD |
| Modify | `src/pages/About.tsx`, `Blog.tsx`, `Careers.tsx`, `Support.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `CookiePolicy.tsx` — add `<SEO>` |
| Modify | `index.html` — add `og:url` |
| Create | `public/sitemap.xml` |
| Modify | `public/robots.txt` — add Sitemap line |

