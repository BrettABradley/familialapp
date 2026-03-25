

## Plan: Fix Desktop Auth Centering + Mobile Keyboard Blocking Content

### Two Issues

**Issue 1 — Desktop**: The Auth page card is left-aligned instead of centered. The container uses `flex flex-col justify-center` but is missing `items-center`.

**Issue 2 — Mobile keyboard still blocking content**: The `resize: 'body'` Capacitor config change requires running `npx cap sync` on the native project to take effect. However, there's also an issue with the `--visual-viewport-height` CSS variable approach used by dialogs — the `useVisualViewport` hook needs to be more robust, and the sheet component also needs the same treatment.

### Changes

#### 1. `src/pages/Auth.tsx` — Center the card on desktop
- Add `items-center` to the outer flex container so the card centers horizontally on all screen sizes
- Same fix for the loading state container

#### 2. `src/pages/ResetPassword.tsx` — Same centering fix
- Add `items-center` to both the invalid-link and reset-form containers for consistency

#### 3. `src/components/ui/sheet.tsx` — Add keyboard-aware max-height
- Add `max-h-[var(--visual-viewport-height,100dvh)] overflow-y-auto` to the sheet content base styles so sheets also shrink when the keyboard opens

#### 4. `src/lib/capacitorInit.ts` — Update visual viewport variable alongside keyboard height
- When the keyboard opens/closes, also set `--visual-viewport-height` so dialogs and sheets that use this variable resize correctly even in native Capacitor context
- This ensures the visual viewport variable works on native (where `window.visualViewport` resize events may not fire reliably with `resize: 'body'`)

### Files to modify
- `src/pages/Auth.tsx` — add `items-center`
- `src/pages/ResetPassword.tsx` — add `items-center`
- `src/components/ui/sheet.tsx` — keyboard-aware max-height
- `src/lib/capacitorInit.ts` — sync `--visual-viewport-height` with keyboard events

### Post-change reminder
Run `npx cap sync ios` after pulling to apply the `resize: 'body'` config change to the native build.

