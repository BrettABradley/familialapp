

## Plan: Fix Keyboard Blocking Dialogs on Mobile

### Root Cause
The Capacitor config uses `Keyboard: { resize: 'none' }`, which means the webview does **not** shrink when the iOS keyboard opens. The dialog uses `max-h-[100dvh]` but `100dvh` never changes, so the bottom of the dialog (submit buttons, form fields) gets hidden behind the keyboard with no way to scroll to them.

### Solution
Use the `VisualViewport` API to track the actual visible area and apply it as a CSS custom property. When the keyboard opens, `window.visualViewport.height` shrinks to reflect the real available space. The dialog will use this value instead of `100dvh` on mobile.

### Changes

#### 1. `src/hooks/useVisualViewport.ts` — New hook
- Listen to `window.visualViewport` resize events
- Set `--visual-viewport-height` CSS custom property on `document.documentElement`
- Defaults to `100dvh` when VisualViewport API is unavailable

#### 2. `src/App.tsx` — Activate the hook
- Call `useVisualViewport()` at the app root so the CSS variable is always up to date

#### 3. `src/components/ui/dialog.tsx` — Use visual viewport height
- Change mobile `max-h-[100dvh]` to `max-h-[var(--visual-viewport-height,100dvh)]`
- This makes the dialog shrink when the keyboard opens, keeping all content scrollable

#### 4. `src/components/ui/alert-dialog.tsx` — Same fix
- AlertDialogContent also needs the visual viewport max-height for mobile consistency

### Files to create/modify
- **New**: `src/hooks/useVisualViewport.ts`
- `src/App.tsx` — add hook call
- `src/components/ui/dialog.tsx` — swap `100dvh` for CSS variable
- `src/components/ui/alert-dialog.tsx` — add mobile-aware max-height

