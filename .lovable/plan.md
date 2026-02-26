

# Plan: Replace Phone-Only Support with Email + Phone Support Options

## Summary

Replace standalone phone number links across the site with a unified "Contact Support" approach that offers both email (support@familialmedia.com) and phone ((480) 648-9596). The email will be the primary/default contact method, with phone as a secondary option.

## Changes

### 1. Header — Replace phone number with support email
- **Desktop**: Replace the phone link with a `Mail` icon + "support@familialmedia.com" mailto link
- **Mobile menu**: Same — replace phone with email link

### 2. Footer — Show both contact methods
- Replace the phone-only link with two lines: email (primary) and phone (secondary)
- This gives visitors a clear place to find both options

### 3. CTA Section — Replace phone button with email button
- Change "Call (480) 648-9596" button to "Email Support" with a mailto link
- Keep it clean — one primary CTA (Get Started) + one support CTA (Email Support)

### 4. Pricing "Custom Plan" card — Show both options
- Replace the single phone button with two buttons: "Email Us" (primary) and "Call Us" (secondary)

### 5. Store page — Replace all phone links with email
- Header support button: email instead of phone
- Advertiser pricing card: "Email to Discuss" instead of "Call to Discuss"
- Footer CTA: "Email Support" instead of "Call Support"

### 6. Add a dedicated "Contact Support" section in the Footer
- Under the existing footer columns, add a small "Need Help?" block with both email and phone, making it always discoverable

## Files to modify
- `src/components/landing/Header.tsx` — swap phone for email
- `src/components/landing/Footer.tsx` — add both email + phone
- `src/components/landing/CTA.tsx` — swap phone button for email button
- `src/components/landing/Pricing.tsx` — show both options on custom plan card
- `src/pages/Store.tsx` — swap phone for email in 3 places

