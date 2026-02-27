

## Plan: Create Careers page and update footer link

### Changes

#### 1. Create `src/pages/Careers.tsx`
- Same layout as About page (Header + Footer wrapping, prose styling)
- Message: "We're always open to growing our team — reach out!"
- Brief intro about working at Familial, link to email `support@familialmedia.com?subject=Careers`

#### 2. Update `src/App.tsx`
- Import Careers and add `/careers` as a public route

#### 3. Update `src/components/landing/Footer.tsx`
- Remove the `<p>` subtitle under Careers (line 80)
- Change the `mailto:` link to `<Link to="/careers">`

### Files to create
- `src/pages/Careers.tsx`

### Files to modify
- `src/App.tsx` (add route)
- `src/components/landing/Footer.tsx` (lines 76-81)

