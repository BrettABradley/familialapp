

## Plan: Update Careers link in footer

### Changes

#### 1. Update `src/components/landing/Footer.tsx`
- Replace the Careers placeholder `<a href="#">` with a `mailto:` link to `support@familialmedia.com`
- Add a small note below the link: "We're always open to growing our team — reach out!"
- Or alternatively, change the Careers item to display the message inline as a tooltip/subtitle

Simplest approach: Replace the Careers `<a href="#">` with a `mailto:support@familialmedia.com?subject=Careers` link, and add a small subtitle text beneath it saying "We're always open to growing our team!"

### Files to modify
- `src/components/landing/Footer.tsx` (lines 76-79)

