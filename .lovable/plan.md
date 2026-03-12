

## Add Sign Out Button to Settings Page

**Problem**: On mobile, there's no way to sign out — the desktop nav has a Sign Out button, but the mobile bottom nav and Settings page don't.

**Fix**: Add a Sign Out button at the bottom of the Settings page, after the ReceiptHistory section. This is the natural place mobile users would look.

### Implementation

**File: `src/pages/Settings.tsx`**
- Import `LogOut` from lucide-react
- Import `useAuth` is already there — use `signOut` from the auth hook (need to destructure it)
- Add a destructive-styled Sign Out button after `<ReceiptHistory />`, before closing `</main>`
- Add a small separator/spacer before it for visual clarity

```tsx
<div className="mt-6 pb-24">
  <Button variant="outline" onClick={handleSignOut} className="w-full text-destructive hover:text-destructive">
    <LogOut className="w-4 h-4 mr-2" />
    Sign Out
  </Button>
</div>
```

The `handleSignOut` function will call `signOut()` from the auth context and navigate to `/`. The `pb-24` ensures it's not hidden behind the mobile bottom nav.

**Single file change, no backend changes needed.**

