
# Fix Circle Invite Email Error

## Problem
The `send-circle-invite` backend function has outdated CORS (Cross-Origin Resource Sharing) headers. The app's client library now sends additional headers that the function doesn't explicitly allow, causing the browser to block the request entirely before it even reaches the function. This is why:
- The invite record saves to the database (direct database call works fine)
- But the email never sends (the function call is blocked by the browser)
- No request logs appear in the function (it never receives the request)

## Fix

**Update CORS headers** in `supabase/functions/send-circle-invite/index.ts`:

Change the allowed headers from:
```
authorization, x-client-info, apikey, content-type
```
to:
```
authorization, x-client-info, apikey, content-type,
x-supabase-client-platform, x-supabase-client-platform-version,
x-supabase-client-runtime, x-supabase-client-runtime-version
```

This is a one-line change in the edge function. No other files need modification.

## Technical Details
- File modified: `supabase/functions/send-circle-invite/index.ts` (line 8)
- The same CORS fix should also be applied to the other edge functions (`moderate-content`, `notify-store-offer`, `create-checkout`, `stripe-webhook`) to prevent similar issues in the future
- The function will be automatically redeployed after the change
