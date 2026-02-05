
# Fix Email Invitation - Update Sender Domain

## Issue Found
The edge function at `supabase/functions/send-circle-invite/index.ts` still uses the placeholder `noreply@yourdomain.com` (line 137). This will cause Resend to reject the email since that domain isn't verified.

## The Fix
Update line 137 from:
```typescript
from: "Familial <noreply@yourdomain.com>", // TODO: Replace with your verified domain
```

To:
```typescript
from: "Familial <noreply@familialmedia.com>",
```

## What's Already Working
- RESEND_API_KEY secret is configured
- The edge function logic is correct
- Input validation and security measures are in place

## After Approval
Once I make this change, the edge function will be redeployed automatically, and I'll test it by calling the function directly to verify emails are sent successfully.

## File to Modify
- `supabase/functions/send-circle-invite/index.ts` - Update the "from" email address
