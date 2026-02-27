

## Plan: Create Terms of Service page for Familial LLC

### Changes

#### 1. Create `src/pages/TermsOfService.tsx`
- Same layout as Privacy Policy (Header + Footer wrapping, prose styling)
- Tailored terms for Familial LLC's private family social network
- Sections: Acceptance of Terms, Description of Service, Account Registration, User Content & Conduct, Circles & Privacy, Intellectual Property, Subscriptions & Payments (Stripe), Termination, Disclaimers & Limitation of Liability, Indemnification, Governing Law, Changes to Terms, Contact Info
- Contact: support@familialmedia.com, (480) 648-9596

#### 2. Update `src/App.tsx`
- Import TermsOfService and add `/terms` as a public route

#### 3. Update `src/components/landing/Footer.tsx`
- Change Terms of Service link from `<a href="#">` to `<Link to="/terms">`

### Files to create
- `src/pages/TermsOfService.tsx`

### Files to modify
- `src/App.tsx`
- `src/components/landing/Footer.tsx`

