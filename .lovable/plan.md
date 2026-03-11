
Goal: Move desktop nav off the far-right edge and match the “centered/easy tap-through” layout from your screenshot.

What I found
- In `src/components/layout/CircleHeader.tsx`, the header row uses `justify-between` with only two desktop groups:
  1) left brand/circle/bell cluster
  2) nav cluster  
- That naturally pushes the nav cluster all the way to the right on wide screens, creating too much middle whitespace.

Implementation plan
1. Rework desktop header alignment in `CircleHeader.tsx`
- Keep mobile behavior exactly as-is.
- Keep the left cluster exactly as-is (logo, circle, bell).
- Change desktop nav positioning to a centered desktop pattern instead of edge-anchored:
  - Use responsive positioning so nav is visually centered on large desktop (`lg+`), not right-flush.
  - Keep a safe fallback on smaller desktop widths (`md`) to prevent overlap with the left cluster.
- Preserve current nav item spacing (`gap-4`) and tap target size (button `size="sm"`), since your screenshot shows good spacing between items.

2. Add overlap-safe responsive behavior
- Ensure nav can’t collide with the left cluster when viewport shrinks:
  - `md`: right-aligned fallback
  - `lg+`: centered placement
- This gives the screenshot look on true desktop while staying robust at intermediate widths.

3. Keep header consistency
- Update `src/components/layout/CircleHeaderSkeleton.tsx` alignment logic to mirror the real header so loading state doesn’t “jump” from one layout to another.

Acceptance checks
- At desktop widths similar to your screenshot, nav sits more centered (not pinned right).
- Right side has noticeable whitespace (matching your reference).
- Mobile top actions remain unchanged.
- No nav overlap with logo/circle area at smaller desktop widths.

Files to update
- `src/components/layout/CircleHeader.tsx`
- `src/components/layout/CircleHeaderSkeleton.tsx`
