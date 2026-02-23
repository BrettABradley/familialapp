

# Update "Every Plan Includes" Section

## Changes to `src/components/landing/Pricing.tsx`

### 1. Replace "Content Moderation" with "No Sale of Data"
Swap the Content Moderation feature entry with a privacy-focused one:
- Icon: `Shield` (keep the same icon -- it fits privacy/security)
- Title: "No Sale of Data"
- Description: "Your family's data is never sold or shared with third parties."

### 2. Add a small gap between the Custom Plan card and the "Every plan includes" section
Add a bottom margin (`mb-8`) to the Custom Plan card's wrapper div to create a tiny visual gap before the full-width features section begins.

## Technical details
Only `src/components/landing/Pricing.tsx` is modified. Two small changes: one text swap in the `sharedFeatures` array and one spacing class addition.

