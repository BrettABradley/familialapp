

## Plan: Push toast notifications further below the camera notch

The toast currently uses `offset={60}` plus `top: env(safe-area-inset-top)`, but the screenshot shows it's still partially hidden behind the Dynamic Island.

### Change
**File:** `src/components/ui/sonner.tsx` (line 14)
- Increase `offset` from `60` to `80` to give more clearance below the notch/Dynamic Island

