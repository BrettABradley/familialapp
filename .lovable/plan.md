

## Show Fridge Pin Description on the Board

### Problem
When users add a description/content to a fridge pin, it gets saved to the database but is never displayed on the board. The `FridgeBoardPin` interface doesn't even include the `content` field.

### Solution
Display the content below the title on each polaroid card, making the card slightly taller when content is present. Also enforce a 150-character limit on the content input.

### Changes

**1. `src/components/fridge/FridgeBoard.tsx`**
- Add `content: string | null` to the `FridgeBoardPin` interface
- On each polaroid card: when `pin.content` exists, remove the fixed `aspect-square` on the image/note area and add the description text below the title in the caption area
- Make the bottom padding (`pb-6`) dynamic -- use `pb-10` or similar when content exists so there's room for both title and description
- In the enlarged pin dialog: also show `enlargedPin.content` below the title

**2. `src/pages/Fridge.tsx`**
- Change the content `Textarea` maxLength from 1000 to 150
- Update the label to indicate the limit: "Description (optional, max 150 chars)"

### Visual Behavior
- Pins without content: unchanged (square image, title only at bottom)
- Pins with content: polaroid frame is slightly taller, description appears in a second line below the title in a smaller font, truncated with ellipsis if needed
- Enlarged view: full content shown below the title

