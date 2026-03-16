

## Fix: Keep chat header visible when keyboard opens + dismiss keyboard on scroll

### Problem
From the screenshot, when the iOS keyboard opens in a chat, the header (with back button and contact name) scrolls out of view, trapping the user. Additionally, scrolling the message list should dismiss the keyboard for a native feel.

### Changes

**File: `src/pages/Messages.tsx`**

#### 1. Make chat header sticky within the fixed container
The header div (line 702 for DM, line 742 for group) already sits inside a `fixed inset-0 flex flex-col` container. The issue is that on iOS, the keyboard resize can cause the visual viewport to shift. Adding `sticky top-0 z-10` to the header ensures it pins to the top of its scroll parent regardless of keyboard state.

However, the real fix is ensuring the header never participates in scrolling. The current structure (`flex flex-col` with `flex-1 overflow-y-auto` for messages) should already keep the header fixed. The likely issue is the `fixed inset-0` container itself is being resized by the keyboard on iOS.

**Fix**: Add `overflow-hidden` to the outer container so the flex layout handles the keyboard resize correctly, and ensure the header has `flex-shrink-0` so it never collapses:
- DM header (line 702): Add `flex-shrink-0` to the header div
- Group header (line 742): Same
- Input bar (line 727 for DM, similar for group): Add `flex-shrink-0`

#### 2. Dismiss keyboard on scroll
Add an `onTouchMove` handler to the messages scroll area that blurs the active element (dismissing the keyboard):
```tsx
onTouchMove={() => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}}
```
Apply to the `flex-1 overflow-y-auto` div in both DM view (line 711) and group view.

### Summary
- Add `flex-shrink-0` to chat headers and input bars in both DM and group views (4 divs)
- Add `onTouchMove` blur handler to both message scroll areas to dismiss keyboard on scroll

