

## Plan: Add ScrollArea to Create Event Form (Match Fridge Pattern)

### What
Wrap the Create Event form content in a `ScrollArea` with bottom padding, matching the pattern used in the "Pin to Fridge" dialog. This gives users a smooth scrollbar to navigate the form instead of relying on the dialog's own overflow scroll.

### Changes

#### `src/pages/Events.tsx`
- Wrap the `div.space-y-4` (lines 639-698) inside a `<ScrollArea className="max-h-[70vh]">` container
- Add `pb-32` to the inner div (change `pb-4` to `pb-32`) so the bottom fields and button can be scrolled well above the keyboard
- Import `ScrollArea` from `@/components/ui/scroll-area`

Also apply the same pattern to the **Edit Event** form for consistency.

### Result
The Create/Edit Event dialogs will have the same smooth scrollbar feel as the Fridge dialog, keeping the experience consistent across the app.

