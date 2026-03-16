

## Fix: Desktop chat not filling viewport height

### Problem
On desktop, the DM and group chat views use `md:relative md:inset-auto` to render inline instead of via portal, but without a defined height the flex container collapses to content height. This causes:
- Messages float in the upper portion with empty space below
- Input bar sits mid-page instead of anchored at the bottom

### Solution
Give the chat container a full remaining viewport height on desktop so the `flex-1` messages area expands and the input bar pins to the bottom.

**File: `src/pages/Messages.tsx`** (two places — DM view ~line 710, group view ~line 750)

Change the container div classes from:
```
fixed inset-0 z-[60] bg-background flex flex-col md:relative md:z-auto md:inset-auto
```
to:
```
fixed inset-0 z-[60] bg-background flex flex-col md:relative md:z-auto md:inset-auto md:h-[calc(100vh-4rem)]
```

This gives the desktop container a height equal to the viewport minus the header (~4rem), allowing `flex-1` on the messages scroll area to fill the space and the input to stick at the bottom. Mobile remains unchanged (uses `fixed inset-0`).

