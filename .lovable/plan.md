
# Fix Circle Invitation Email Failures

## Problem
The circle invitation emails fail to send because the edge function uses `noreply@familialmedia.com` as the sender address. Resend requires a verified domain to send from custom addresses. If the domain isn't verified in your Resend account, all email sends will fail silently.

## Solution
Update the edge function to use Resend's default sender address (`onboarding@resend.dev`) which works without domain verification. This gets invitations working immediately. You can switch back to your custom domain later once it's verified.

## Changes

### 1. Update `supabase/functions/send-circle-invite/index.ts`
- Change the `from` field from `"Familial <noreply@familialmedia.com>"` to `"Familial <onboarding@resend.dev>"`
- Add better error logging so we can see the exact Resend API error in logs

### 2. Improve error visibility in `src/pages/Circles.tsx`
- Log the actual error from the edge function to the console so failures are easier to debug in the future

## Technical Details

The key change is on one line in the edge function:

```
// Before
from: "Familial <noreply@familialmedia.com>",

// After  
from: "Familial <onboarding@resend.dev>",
```

Note: With `onboarding@resend.dev`, Resend's free tier limits you to sending only to the email address associated with your Resend account. To send to any email, you'll need to verify the `familialmedia.com` domain in your Resend dashboard and switch the sender back.
