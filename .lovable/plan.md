

## Problem

On iOS devices with a notch or Dynamic Island, the Sonner toast notifications appear behind the system status bar/camera cutout. The header itself handles safe area insets via `pt-[env(safe-area-inset-top)]`, but the toast component (Sonner) does not account for this — it renders at the very top of the viewport by default.

## Plan

### 1. Update Sonner Toaster to respect iOS safe area insets

In `src/components/ui/sonner.tsx`, add a `style` prop with `top: env(safe-area-inset-top)` and set `position="top-center"` so toasts render below the notch/Dynamic Island area. Also add an `offset` prop to push toasts further down past the sticky header.

### 2. Add global CSS for Sonner safe area

In `src/index.css`, add a rule targeting the Sonner container (`[data-sonner-toaster]`) to apply `top: env(safe-area-inset-top, 0px) !important` as a fallback, ensuring toasts clear the notch on all iOS devices even if the component prop doesn't cascade correctly.

These two changes ensure toast notifications always appear below both the iOS system UI and the app's sticky header.

