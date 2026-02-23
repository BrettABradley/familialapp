

# Fix: Only Save Invite After Email Sends Successfully

## Problem
Currently, the invite flow works like this:
1. Save invite record to the database
2. Try to send the email
3. If email fails, the invite record stays -- blocking future attempts because duplicate detection rejects it

This means a failed email permanently blocks re-inviting that person.

## Solution
Move the database insert into the backend function so it only happens **after** the email sends successfully. The client will no longer insert the invite record directly.

## Changes

### 1. `src/pages/Circles.tsx` -- Remove client-side DB insert
- Remove the `supabase.from("circle_invites").insert(...)` call
- Instead, just call the backend function directly
- The backend function will handle both sending the email AND saving the invite
- On success, show "Invite sent!"; on failure, show the error without leaving a stale record

### 2. `supabase/functions/send-circle-invite/index.ts` -- Add DB insert after email success
- After the Resend API confirms the email was sent, insert the invite record into `circle_invites` using the admin client
- Include all required fields: `circle_id`, `invited_by` (from the authenticated user), `email`, `status: 'pending'`
- If email fails, return an error without touching the database
- The existing validation checks (duplicate invite, already a member, etc.) stay in place within the function

## Technical Details

```text
BEFORE:
  Client: insert invite -> call edge function -> send email
  Problem: invite saved even if email fails

AFTER:
  Client: call edge function
  Edge function: validate -> send email -> insert invite (only on success)
  Result: no stale records on failure, user can retry
```

- The `validate_circle_invite` database trigger will still run on insert, providing server-side duplicate protection
- The `handle_invite_notification` trigger will still fire to create in-app notifications for existing users
- The `handle_invite_on_signup` trigger continues to work for new user auto-join
- Files modified: `src/pages/Circles.tsx`, `supabase/functions/send-circle-invite/index.ts`

