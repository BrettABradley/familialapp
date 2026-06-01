## What's actually happening

**1. Google's favicon (the icon next to the search result)**

Google fetches the favicon **separately** from the page favicon — it uses a special crawler (`googlebot-image`) that looks for `/favicon.ico` at the **root of the canonical domain**, and it caches it for weeks. Two things to fix:

- `public/` only contains `favicon.png`. Browsers requesting `/favicon.ico` (which Google does) fall back to whatever Lovable serves by default — the Lovable logo. We need an actual `favicon.ico` at the root.
- Even after fixing, Google's cache won't refresh until it re-crawls (days to weeks). We can speed it up by requesting re-indexing in Search Console.

**2. App Store search not surfacing "Familial"**

This is **not** a code/website fix — it's an App Store Connect metadata issue. Apple's search ranks results based on:
- App **name** / **subtitle** (highest weight)
- **Keywords** field (100 chars, comma-separated, no spaces)
- Developer name (why your dev name works)
- Downloads + ratings velocity (you're brand new, so this is near zero)

If "Familial" the word isn't in your app's **name** or **subtitle** exactly, or if a more established app owns that keyword, you won't rank. New apps also take 24–72h after "Ready for Distribution" to appear in search at all, and competitive single-word terms can take weeks to climb.

---

## The plan

### Fix #1 — Favicon (code changes)

1. Generate a proper `favicon.ico` (multi-resolution: 16×16, 32×32, 48×48) from the existing `Familial_PFP.png` brand mark and save to `public/favicon.ico`.
2. Add `<link rel="icon" href="/favicon.ico" sizes="any" />` as the **first** icon link in `index.html` so Google's crawler picks it up before the PNG variants.
3. Bump the `?v=` cache-bust on the PNG icons.
4. Verify by curling `https://www.familialmedia.com/favicon.ico` after deploy and confirming a non-Lovable image.

### Fix #2 — Help Google re-crawl faster (no code, instructions)

After the deploy, you (or I, via the Google Search Console connector) submit the homepage URL for re-indexing. Favicon refresh in search results still takes 1–4 weeks even after re-crawl — Google rate-limits favicon updates aggressively. There's no faster fix; this is on Google's side.

### Fix #3 — App Store discoverability (no code, App Store Connect changes)

I'll give you a checklist to apply in App Store Connect → App Information / iOS App version:

- **Subtitle** (30 chars): include "Private Family Social" or similar — this is searched.
- **Keywords** (100 chars, comma-separated, no spaces): e.g. `family,private,social,circle,kids,memories,album,events,share,group,chat,parents`. Do **not** repeat the app name — Apple already indexes it.
- **Promotional Text** is NOT indexed — don't waste keywords there.
- Confirm **Primary Category** = Social Networking, **Secondary** = Lifestyle (already set per your memory).
- Confirm the app is **released to all territories** (a region-restricted release won't appear in your store if you're outside it).
- Wait 24–72h after the metadata update; Apple's search index rebuilds asynchronously.

I can't change App Store Connect for you — those fields live in Apple's portal and need your login.

---

## Files I'll touch in build mode

- `public/favicon.ico` (new, generated from brand PNG)
- `index.html` (add `.ico` link, bump `?v=`)

## What I won't do

- Build any UI for this — it's purely head meta + a binary asset + external-portal guidance.
- Touch the OG image / large preview card — you confirmed those are correct.

Ready to switch to build mode and apply Fix #1 + give you the App Store Connect checklist to paste in?