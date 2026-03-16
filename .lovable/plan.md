

## Plan: Fix desktop chat layout and sanitize error messages

### Issues identified

1. **Desktop layout broken**: The chat views render via `createPortal` to `document.body` for both mobile and desktop. On desktop, `md:relative md:z-auto md:inset-auto` tries to undo the fixed positioning, but since the element is portaled outside the normal DOM tree, it renders detached from the page layout — causing the chat header to appear at the bottom of the viewport instead of the top.

2. **Raw error details exposed**: The error toast displays raw database/network internals like `"Failing row contains (36, POST, null, {"Content-Type": "a..., "Authorization": null}..."`. Users should see a clean, friendly message.

### Changes

**File: `src/pages/Messages.tsx`**

1. **Conditionally use portal only on mobile** — Use the `useIsMobile()` hook. On mobile, render the chat view through `createPortal` (keeps the full-screen overlay fix). On desktop, render it inline within the normal layout flow (no portal). This applies to both the DM view (line ~714) and the group chat view (line ~824).

2. **Sanitize error messages in toast** — In `handleSendMessage` (lines 532-534 and 549-551), replace the raw `error.details || error.message` with a clean user-friendly message: `"Failed to send message. Please try again."`. Keep the `console.error` with full details for debugging.

### Files to update
- `src/pages/Messages.tsx`

