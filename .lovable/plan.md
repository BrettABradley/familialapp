

## Plan: Keyboard-Friendly ResetPassword + Fix Toast Notifications Behind Notch

### Problem
1. The ResetPassword page uses rigid centering (`flex items-center justify-center`) that doesn't scroll when the keyboard opens — same issue we just fixed on Auth.
2. Toast notifications (the Radix `useToast` system) render at `fixed top-0` with no safe-area inset, so they appear behind the Dynamic Island/notch on mobile.

### Changes

#### 1. `src/pages/ResetPassword.tsx`
- Both container divs (invalid link state on line 70 and main form on line 92): change `min-h-screen flex items-center justify-center` to `min-h-[100dvh] flex flex-col justify-center overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]`

#### 2. `src/components/ui/toast.tsx` — ToastViewport safe-area fix
- Change the viewport from `fixed top-0` to `fixed top-0 pt-[env(safe-area-inset-top,0px)]` so toasts drop below the notch on mobile
- Desktop is unaffected since `env(safe-area-inset-top)` resolves to 0

### Files to modify
- `src/pages/ResetPassword.tsx` — keyboard-friendly scrollable layout
- `src/components/ui/toast.tsx` — safe-area padding on ToastViewport

