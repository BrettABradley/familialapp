

## Fix: Fridge Pin Dialog Not Scrollable on Mobile

### Problem
When users add a photo in the "Pin to Fridge" dialog on mobile, the image preview makes the dialog content taller than the screen. The dialog doesn't scroll, so the "Pin to Fridge" button becomes unreachable.

### Solution
Wrap the dialog's inner content in a `ScrollArea` so the form scrolls when it exceeds the available viewport height. This is a small, targeted fix.

### Technical Details

**File: `src/pages/Fridge.tsx`**

1. Import `ScrollArea` from `@/components/ui/scroll-area`
2. Wrap the `div.space-y-4` inside `DialogContent` with a `ScrollArea` that has a `max-h-[70vh]` (70% of viewport height), ensuring the form is always scrollable on small screens
3. Add slight padding adjustment so the scroll area contents aren't clipped

This is a one-file, few-line change. No backend changes needed.
