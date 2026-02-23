

# Polish Pricing Section

## What feels off and how to fix it

The pricing cards are too sparse with only 2 bullet points, making them feel incomplete. Users may not scroll down to see the shared features list, leaving them uncertain about what each plan includes.

## Changes to `src/components/landing/Pricing.tsx`

### 1. Change "Choose your circle size" to "Choose your plan"
Simple text update on line 129.

### 2. Add "All features included" note to each pricing card
Below the 2 feature bullet points (circle count + member limit), add a subtle line that says **"All features included"** styled as a muted, smaller text with a checkmark icon. This anchors to `#all-features` so users can click to see the full list.

This fills out the card visually and reassures users at the point of decision.

### 3. Add an `id` anchor to the shared features section
Add `id="all-features"` to the "Every plan includes" container div so the in-card link can scroll to it smoothly.

### 4. Slight card padding adjustment
Add a bit more vertical space in the card content area so the "All features included" line doesn't feel cramped.

## Result
- Cards feel more complete and trustworthy
- Users immediately see that all plans share the same features
- A clickable link lets curious users jump to the full feature list
- "Choose your plan" is clearer and more direct

## Technical details
Only one file changes: `src/components/landing/Pricing.tsx`. The changes are purely cosmetic/text -- no logic changes.

