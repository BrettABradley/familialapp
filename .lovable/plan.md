

# Fix Circle Invitation 401 Error

## Problem
The circle invitation edge function is returning **401 Unauthorized** at the gateway level before your code even runs. This is why:
- The edge function logs show only boot/shutdown messages with no request handling
- The HTTP logs show every POST request getting a 401 response
- The "email failed to send" toast always appears

The function already has its own authentication check in code (validating the user's token), but the gateway is also enforcing JWT verification and rejecting the requests first.

## Solution
Disable gateway-level JWT verification for the `send-circle-invite` function in the config file, allowing requests to reach the function code where authentication is already handled properly.

## Changes

### `supabase/config.toml`
Add configuration to disable automatic JWT verification for the send-circle-invite function:

```toml
[functions.send-circle-invite]
verify_jwt = false
```

This lets the request through to your function code, which already validates the user's auth token via `supabase.auth.getUser()` and returns 401 if unauthorized.

No other code changes are needed -- the edge function and the Circles page code are correct. The only issue was the gateway blocking requests before they reached your function.

