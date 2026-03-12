

## Fix: Messages Send Error and Mobile Layout

### Problems Identified

1. **Send error**: The insert uses `as any` type cast and passes `undefined` for `media_urls` when no files are attached. Should pass `null` instead, and remove the `as any` cast to use proper typing.

2. **Mobile layout**: The chat views use `h-[calc(100vh-200px)]` which doesn't account for the 64px bottom navigation bar + safe area padding. The message input gets buried behind the bottom nav. Additionally, `py-8` container padding wastes vertical space on mobile chat views.

### Plan

**1. Fix message sending (lines 488-516)**
- Replace `media_urls: mediaUrls.length > 0 ? mediaUrls : undefined` with `null` instead of `undefined`
- Remove `as any` casts — the types should match the schema

**2. Fix mobile chat layout (DM view, lines 636-670 and Group view, lines 674-778)**
- Change `h-[calc(100vh-200px)]` to account for mobile bottom nav: use `h-[calc(100vh-200px)] md:h-[calc(100vh-200px)]` with a mobile-specific height like `h-[calc(100vh-theme(spacing.16)-env(safe-area-inset-bottom)-140px)]` — or simpler: reduce container padding on mobile and use `pb-20` to clear the bottom nav
- Reduce `py-8` to `py-4` on mobile for chat views to reclaim vertical space
- Make the message input bar sticky at the bottom, above the mobile nav, by using proper bottom padding
- Tighten the input bar: reduce gap, make voice recorder more compact on mobile

**3. Tighten message input bar (lines 577-600)**
- On mobile, the attachment button + voice recorder + input + send button are cramped. Collapse voice recorder into an icon-only button on mobile
- Reduce padding/gaps for a cleaner mobile look matching the screenshot reference

### Files Changed
- `src/pages/Messages.tsx` — all changes in this single file

