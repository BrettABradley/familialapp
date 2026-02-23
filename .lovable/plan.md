

# Fix: Auth Session Missing in Circle Invite Function

## Problem
The edge function logs show this error:
```
AuthSessionMissingError: Auth session missing!
```

The function creates a Supabase client and calls `supabase.auth.getUser()` without passing the token. In Lovable Cloud's edge runtime, the client cannot resolve the session from headers alone -- you must pass the token explicitly to `getUser(token)`.

## Solution
One-line fix in `supabase/functions/send-circle-invite/index.ts`: extract the token from the Authorization header and pass it to `getUser(token)`.

## Changes

### `supabase/functions/send-circle-invite/index.ts`
- Extract the bearer token: `const token = authHeader.replace("Bearer ", "")`
- Change `supabase.auth.getUser()` to `supabase.auth.getUser(token)`
- This explicitly validates the JWT and retrieves the user, bypassing the session requirement

## Technical Details

```text
BEFORE:
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  // Fails because edge runtime has no session store

AFTER:
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  // Works because token is validated directly
```

- Only one file modified: `supabase/functions/send-circle-invite/index.ts`
- The function will be automatically redeployed
- No client-side changes needed -- `supabase.functions.invoke()` already sends the Authorization header

