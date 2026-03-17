
## Plan: fix the black iPhone top bar for real and fully clear the contact header

### What’s actually causing it
The current native fix is the wrong direction for this issue.

By setting the status bar to `overlay: false`, the app is pushing the web content below the iPhone status area. That exposed area is native chrome, not your React UI, so it can stay black even when the app itself is white.

That is why:
- the top bar still looks black
- the message header sits below it instead of visually filling it
- the contact row can still feel slightly cramped/cut off on Dynamic Island devices

### Solution that should work reliably
#### 1. Put the webview back under the status bar
Update the native status bar setup to use:
- `overlaysWebView: true`
- keep the status bar text style light-background friendly (`LIGHT` / dark text)

This makes the white app background render behind the iPhone status area instead of showing a separate black native strip.

#### 2. Make the app shell explicitly white at the top
Strengthen the top-level page background so there is never any transparent/unstyled area showing through:
- ensure `html`, `body`, and `#root` are white
- keep the chat overlay container fully white
- keep the header wrapper white, not translucent, in the full-screen message view

#### 3. Rebuild the message header as a 2-layer safe-area header
Instead of putting all the notch spacing on the same row as the avatar/name, split it into:
- an outer white header wrapper that owns the safe-area top padding
- an inner content row with normal vertical padding and a minimum height

This is more reliable than the current one-line `paddingTop` hack and will stop the contact name/avatar row from being clipped.

#### 4. Apply the same header structure to both chat types
Use the exact same mobile-safe header pattern for:
- direct messages
- group chats

That keeps the fix consistent everywhere messaging opens as a full-screen overlay.

### Files to update
- `capacitor.config.ts`
- `src/lib/capacitorInit.ts`
- `src/index.css`
- `src/pages/Messages.tsx`

### Technical details
- Revert the native status bar from `overlay: false` back to `overlay: true`
- Keep status bar style for dark text on a light background
- In `Messages.tsx`, replace the current header row style:
  - current: one row with `paddingTop: max(env(...), 4rem)`
  - new: outer safe-area wrapper + inner row
- Use a white, non-transparent header background for the chat overlay
- Add explicit white background coverage at `html/body/#root` so the top area cannot render black during mount or transitions

### Expected result
After this change:
- the top iPhone area will stay visually white instead of black
- the app will look like one continuous white surface at the top
- the back button, avatar, and contact name will sit fully below the camera/Dynamic Island
- messaging will keep its current full-screen mobile behavior without the clipping issue

### Validation after implementation
- test a DM on an iPhone with Dynamic Island
- test a group chat on the same device
- confirm the top area is white on Feed, Messages list, and open chat view
- rebuild/sync the native iOS shell after pulling the changes so the native status-bar setting is applied
