## Goal
Send a personal thank-you email from the founder to **haleymliming@gmail.com** and **brycehammaz@gmail.com**, letting them know a Family plan has been gifted to their account.

## Approach
Use the existing app email infrastructure (`send-transactional-email` edge function + React Email templates registry). One new template, two sends — one per recipient, each with its own idempotency key.

## Steps

1. **Create template** `supabase/functions/_shared/transactional-email-templates/founder-gift.tsx`
   - React Email component, white background, Playfair-style heading, Inter body to match existing templates.
   - Optional `name` prop for personalized greeting (falls back to a generic greeting).
   - Copy: warm note from Brett — thanks for being an early supporter, a Family plan has been added to their account at no cost, no action needed, just enjoy it. Signed "Brett, founder of Familial."
   - Subject: "A small thank-you from Familial"
   - Registered as `founder-gift` in `registry.ts`.

2. **Deploy** the `send-transactional-email` function so the new template is live.

3. **Trigger the two sends** by invoking `send-transactional-email` twice (via `curl_edge_functions`), one per recipient, with idempotency keys `founder-gift-haley-2026-05-19` and `founder-gift-bryce-2026-05-19`.

4. **Confirm** in chat that both emails were dispatched.

## Notes
- No new infrastructure needed — transactional email pipeline already exists.
- No DB changes.
- Not a marketing/bulk send: two specific individuals, each tied to the gift you just granted them. Compliant with the transactional-email policy.
