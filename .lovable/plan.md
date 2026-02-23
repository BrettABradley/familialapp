

# Add FAQ Section Below Pricing

## Overview
Add a new FAQ component below the "Every plan includes" section, using the existing Radix accordion component for expandable Q&A items. The section will address common questions about privacy, plans, data, and family circles.

## New File: `src/components/landing/FAQ.tsx`

Create a new component with an accordion-based FAQ section containing 6-8 questions covering:

- **Privacy**: "Is my family's data sold or shared?" / "Who can see my posts?"
- **Plans**: "What's the difference between plans?" / "Can I upgrade or downgrade?"
- **Features**: "What happens when I hit my member limit?" / "Can I create multiple circles?"
- **General**: "Is Familial available on mobile?" / "How do I invite family members?"

### Design
- Full-width section with `bg-background` to contrast with the `bg-secondary` sections above and below
- Centered content with `max-w-3xl` for readable line lengths
- Section heading: "Frequently Asked Questions"
- Subtitle: "Everything you need to know about Familial."
- Uses the existing `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` components from `src/components/ui/accordion.tsx`

## Changes to `src/pages/Index.tsx`

Import and render the new `FAQ` component between `Pricing` and `CTA`:

```
<Pricing />
<FAQ />
<CTA />
```

## Technical Details
- Uses existing `@radix-ui/react-accordion` (already installed)
- Uses existing shadcn accordion UI components (already in project)
- No new dependencies needed
- FAQ data is a simple static array of `{ question, answer }` objects inside the component
