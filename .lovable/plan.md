

## Plan: Create Privacy Policy page for Familial LLC

### Changes

#### 1. Create `src/pages/PrivacyPolicy.tsx`
- Full privacy policy page with Header + Footer wrapping
- Sections: Information We Collect, How We Use It, Information Sharing, Data Storage & Security, Children's Privacy (COPPA), Your Rights, Cookies, Changes to Policy, Contact
- Tailored to Familial LLC's anti-tracking, no-algorithm, private-by-design positioning
- Contact: support@familialmedia.com, (480) 648-9596

#### 2. Update `src/App.tsx`
- Add `/privacy` as a public route

#### 3. Update `src/components/landing/Footer.tsx`
- Change Privacy Policy link from `<a href="#">` to `<Link to="/privacy">`

### Files to create
- `src/pages/PrivacyPolicy.tsx`

### Files to modify
- `src/App.tsx`
- `src/components/landing/Footer.tsx`

