

## Fix: Black status bar and chat header still clipped

### Problems identified

1. **Black status bar**: The Capacitor config and init code both set the status bar style to `DARK` / `Style.Dark`, which renders white text on a dark/black background. The `theme-color` meta tag is also set to `#1a1a2e` (dark blue), and `apple-mobile-web-app-status-bar-style` is `black-translucent`. All of these need to be `LIGHT` / white to match the app's white background.

2. **Chat header still clipped**: The `max()` fallback of `3.5rem` (56px) isn't enough for iPhones with Dynamic Island. Increasing the minimum to `4rem` (64px) will give proper clearance.

### Changes

#### 1. `src/lib/capacitorInit.ts`
- Change `Style.Dark` → `Style.Light` so the native status bar has dark text on a light/white background

#### 2. `capacitor.config.ts`
- Change `style: 'DARK'` → `style: 'LIGHT'`

#### 3. `index.html`
- Change `theme-color` from `#1a1a2e` to `#ffffff`
- Change `apple-mobile-web-app-status-bar-style` from `black-translucent` to `default` (which renders the standard white/light status bar on iOS)

#### 4. `src/pages/Messages.tsx` (lines 702 and 742)
- Increase the minimum fallback from `3.5rem` to `4rem`:
  ```
  paddingTop: 'max(env(safe-area-inset-top, 0px) + 1rem, 4rem)'
  ```

### Files to modify
- `src/lib/capacitorInit.ts`
- `capacitor.config.ts`
- `index.html`
- `src/pages/Messages.tsx`

