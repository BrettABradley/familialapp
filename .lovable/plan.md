

## Redirect Native App to Login Page

The issue: When the app loads in Capacitor (iOS), it shows the marketing landing page (`/` → `Index`) instead of the auth flow. In a native app context, users should go straight to login (or to `/circles` if already authenticated).

### Approach

Detect if the app is running inside Capacitor and redirect accordingly on the `/` route:

1. **Install `@capacitor/core`** (already installed) — use `Capacitor.isNativePlatform()` to detect native context.

2. **Update `Index.tsx`** — At the top of the component, check if running in Capacitor:
   - If native + authenticated → redirect to `/circles`
   - If native + not authenticated → redirect to `/auth`
   - If web → show landing page as normal

This is a minimal change — just a few lines added to the existing `Index` page component using `useAuth` and `useNavigate`, with an early return while redirecting.

### Files Changed
- `src/pages/Index.tsx` — Add Capacitor detection + redirect logic

