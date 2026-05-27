## Lightbox landscape mode fix

Harden the top control bar (X + Download) in all lightboxes so they stay tappable in landscape on notched iPhones.

### Changes per lightbox top bar

1. `z-30` → `z-50` (sit above embla viewport + zoom-pan-pinch wrapper)
2. Add `pointer-events-auto` on the button container so taps register even when ancestor sets `touch-action: none`
3. Right padding: `pr-4` → `pr-[max(env(safe-area-inset-right,0px),1rem)]` (clear the notch/camera bumper in landscape)
4. Left padding: add `pl-[max(env(safe-area-inset-left,0px),1rem)]` for symmetry

### Files

- `src/components/feed/PostCard.tsx` — feed lightbox top bar (~line 398)
- `src/pages/Albums.tsx` — album lightbox top bar (~line 122)
- `src/pages/ProfileView.tsx` — avatar zoom (~line 80) and post lightbox (~line 689)
- `src/pages/Messages.tsx` — message image attachment lightbox (~line 1248)

No portrait behavior changes, no logic changes, presentation-only.
