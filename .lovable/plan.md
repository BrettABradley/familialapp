

## Plan: Global Keyboard-Aware Layout for Native Mobile Feel

### Problem
The Capacitor config uses `Keyboard: { resize: 'none' }`, which means the webview never shrinks when the keyboard opens. This forces every individual component (dialogs, auth page, edit forms) to be patched separately. The result is a whack-a-mole problem — there will always be another screen where the keyboard blocks content.

### Options Considered

**Option A: Switch to `resize: 'body'`** (Recommended)
Change the Capacitor keyboard resize mode from `'none'` to `'body'`. This makes the webview body shrink when the keyboard opens — exactly how Instagram and other native apps behave. The form content naturally scrolls into view because the viewport itself gets shorter. This is the single most impactful change and requires the least ongoing maintenance.

- Trade-off: The bottom navigation bar (which is `fixed bottom-0`) would move up with the keyboard. We solve this by hiding the bottom nav when the keyboard is open (using the `keyboard-open` class already being set by `capacitorInit.ts`). This is standard native app behavior — Instagram, WhatsApp, etc. all hide the tab bar when typing.

**Option B: Keep `resize: 'none'` + global padding approach**
Keep the current mode but use the `--keyboard-height` CSS variable (already being set) to add bottom padding to all scrollable containers. More control but requires touching many components and is fragile.

**Option C: Keep `resize: 'none'` + auto-scrollIntoView**
Add a global focus listener that calls `scrollIntoView()` on every focused input. Works for some cases but doesn't help with submit buttons or other non-input content below the fold.

### Recommended: Option A

This is the Instagram approach. One config change + one CSS rule to hide the tab bar during typing. Everything else "just works" because the viewport actually shrinks.

### Changes

#### 1. `capacitor.config.ts` — Switch keyboard resize mode
- Change `resize: 'none'` to `resize: 'body'`
- This makes the webview shrink when the keyboard appears, naturally pushing content up

#### 2. `src/components/layout/MobileNavigation.tsx` — Hide when keyboard is open
- Add `keyboard-open:hidden` class (the `keyboard-open` class is already toggled on `<html>` by `capacitorInit.ts`)
- This prevents the bottom nav from floating above the keyboard (matching native app behavior)

#### 3. `src/index.css` — Add keyboard-open utility
- Add a CSS rule: `.keyboard-open .keyboard-hide { display: none; }` as a simple utility
- Increase the global `scroll-margin-bottom` on inputs slightly to ensure the focused field plus submit button are visible

#### 4. Cleanup — Remove redundant visual viewport patches
- The `useVisualViewport` hook and `--visual-viewport-height` CSS variable become unnecessary since the viewport now resizes natively
- However, to be safe on web (non-Capacitor), we keep the hook but it becomes a no-op fallback
- Dialog/AlertDialog `max-h-[var(--visual-viewport-height,100dvh)]` still works correctly as a fallback

#### 5. `src/pages/Auth.tsx` — Remove `mx-auto` centering on Card
- The card already uses `max-w-md` but needs `mx-auto` to center on wider screens. Verify the layout still centers properly with the scrollable container. (Minor check, likely no change needed.)

### Why This Feels Native
- The viewport shrinks = content scrolls naturally (no JS hacks needed)
- Tab bar hides during typing (standard iOS/Android pattern)
- No per-component patches needed for future features
- Submit buttons, form fields, and close buttons all remain accessible automatically

### Files to modify
- `capacitor.config.ts` — change resize mode
- `src/components/layout/MobileNavigation.tsx` — hide on keyboard open
- `src/index.css` — add keyboard-hide utility class

### Post-change note
After this change, the user will need to run `npx cap sync` to apply the new Capacitor config to the native project.

