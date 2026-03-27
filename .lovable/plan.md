

## Plan: Fix Cancel Date Missing + Sticky Toast Issues

### Issue 1 — Cancel toast shows "You'll keep access until ."
The `formatDate` in `SubscriptionCard.tsx` returns `""` when `dateStr` is null. The edge function does return the date, but if it's null for any reason, the toast has no fallback. Fix: use the existing `planData.current_period_end` as fallback, and guard the toast message so it never shows an empty date.

### Issue 2 — Invite toast gets stuck, no way to dismiss
`TOAST_REMOVE_DELAY` in `src/hooks/use-toast.ts` is set to `1000000` ms (~16 minutes). Toasts effectively never auto-dismiss. Fix: reduce to `5000` ms (5 seconds) so all toasts auto-dismiss naturally.

### Changes

#### 1. `src/hooks/use-toast.ts` (line 6)
- Change `TOAST_REMOVE_DELAY` from `1000000` to `5000`

#### 2. `src/components/settings/SubscriptionCard.tsx` (line 168)
- Add fallback: use `planData.current_period_end` if `data.current_period_end` is missing
- Guard against empty date in the toast message

### App update
These are frontend-only changes. You will need to rebuild and deploy the app update for the mobile app to pick them up.

### Files to modify
- `src/hooks/use-toast.ts`
- `src/components/settings/SubscriptionCard.tsx`

