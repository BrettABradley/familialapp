

## Plan: Move Support to Footer Nav, Fix Security Dead Link

### Changes

**1. `src/components/landing/Header.tsx`**
- Remove the "Support" link from the desktop top nav (line 40-42)
- Remove the "Support" link from the mobile menu as well

**2. `src/components/landing/Footer.tsx`**
- Add a "Support" link (`Link to="/support"`) in the Product section (next to Security)
- Change the Security dead link (`href="#"`) to point to a real route — `/support` makes sense since the Support page covers platform security context, OR create a simple anchor to a security section. Most practical: link Security to `/support` with a hash like `/support#security` or just `/privacy` since privacy/security are closely related.

I'll link Security to `/privacy` (the Privacy Policy page already exists and covers data security) unless you'd prefer a dedicated security page.

### Files to modify
- `src/components/landing/Header.tsx` — remove Support from top nav + mobile menu
- `src/components/landing/Footer.tsx` — add Support link, fix Security link to `/privacy`

