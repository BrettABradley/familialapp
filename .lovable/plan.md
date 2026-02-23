

# Stay Signed In on Homepage + Pricing Layout Fix

## Overview
Two changes: (1) The landing page header should reflect your signed-in state so you can interact with pricing buttons without re-authenticating, and (2) the "Need More Members" and "Need a Custom Plan" cards should sit side by side on desktop.

## What Changes

### 1. Header Shows Signed-In State
The landing page header currently always shows "Sign In" and "Get Started" buttons, even if you're already logged in. This means when you click a pricing button, it may unnecessarily redirect you to `/auth`.

**Fix:** Update `Header.tsx` to use the `useAuth` hook. If signed in:
- Replace "Sign In" / "Get Started" with a "Go to Dashboard" button (links to `/feed`)
- Same change in the mobile menu

### 2. Pricing Bottom Cards Side by Side on Desktop
Currently "Need More Members?" and "Need a Custom Plan?" are stacked vertically in separate `max-w-2xl` containers.

**Fix:** Wrap both cards in a single `max-w-6xl` grid container with `md:grid-cols-2` so they sit side by side on desktop and stack on mobile.

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/components/landing/Header.tsx` | Import `useAuth`; conditionally render "Go to Dashboard" button when user is signed in, or "Sign In" / "Get Started" when not |
| `src/components/landing/Pricing.tsx` | Combine the "Extra Members" and "Custom Plans" cards into a single `grid md:grid-cols-2` container with `max-w-6xl` |

### Header Logic
```text
if (user) --> Show "Go to Dashboard" button linking to /feed
else      --> Show "Sign In" + "Get Started" buttons linking to /auth
```

### Pricing Layout
```text
Before:
  [Need More Members?]    (max-w-2xl, centered)
  [Need a Custom Plan?]   (max-w-2xl, centered)

After:
  [Need More Members?]  [Need a Custom Plan?]   (max-w-6xl, grid md:grid-cols-2)
  (stacked on mobile)
```

