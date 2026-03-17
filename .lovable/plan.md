

## Fix: Pin chat header with `position: fixed` so it never moves on keyboard open

### Problem
When the iOS keyboard opens, the visual viewport shifts and the header (back button + contact name) slides up behind the Dynamic Island. The header needs to be pinned to the viewport so it stays put regardless of keyboard state.

### Approach
Make the header `fixed` to the viewport instead of a flex child. Use `padding-top` with `max(env(safe-area-inset-top), 3.25rem)` to guarantee it sits just below the Dynamic Island. Add a spacer div so message content isn't hidden behind the fixed header.

### Changes — `src/pages/Messages.tsx`

**DM header (lines 702-712):**
- Change outer wrapper from `flex-shrink-0` to `fixed top-0 left-0 right-0 z-10`
- Keep `paddingTop: 'max(env(safe-area-inset-top, 0px), 3.25rem)'`
- After the header, insert a spacer `<div style={{ height: 'calc(max(env(safe-area-inset-top, 0px), 3.25rem) + 3.5rem)' }} />`

**Group header (lines 744-similar):**
- Same fixed positioning and spacer treatment

**Both headers will be:**
- `position: fixed` — anchored to the viewport, unaffected by keyboard
- Padded below the Dynamic Island via the safe-area max fallback
- Followed by a height-matched spacer so messages scroll correctly beneath

### Files to modify
- `src/pages/Messages.tsx` (DM header + Group header, ~4 insertions/edits)

