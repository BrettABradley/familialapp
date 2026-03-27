

## Plan: Create Test Account for Apple Review

Apple requires a demo account during App Store review. We need to create a working test account in the authentication system.

### Steps

1. **Temporarily enable auto-confirm** for email signups (so the test account doesn't need email verification)
2. **Create the test account** by signing up through the app with these credentials:
   - **Email:** `appreview@familialapp.com`
   - **Password:** `FamilialReview2026!`
3. **Disable auto-confirm** after account creation (restore normal email verification)
4. **Pre-populate the account** — ensure it belongs to at least one circle with sample data so the reviewer can see the app's features

### What you provide to Apple
In App Store Connect under "App Review Information → Sign-In Information":
- **Username:** `appreview@familialapp.com`
- **Password:** `FamilialReview2026!`

### Implementation
- Use the auth configuration tool to toggle auto-confirm
- Sign up the account programmatically
- Optionally create a demo circle with sample posts/events so the reviewer has content to browse

Shall I proceed with creating this account?

