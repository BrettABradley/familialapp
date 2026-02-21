

# Auto-Join Circles for Invited Users

## Problem
When an invited user signs up, nothing connects them to the circle they were invited to. The `circle_invites` table has a record with their email, but no code checks for pending invites and adds the new user as a member.

## Solution
Create a database trigger that fires when a new user signs up (on `auth.users` insert). It will look up any pending invites matching the new user's email and automatically:
1. Add them as a member of each invited circle
2. Mark those invites as "accepted"

Additionally, add a check on login (in the frontend) for any pending invites, as a fallback for users who signed up before this trigger existed.

## Changes

### 1. Database Migration -- Auto-join trigger function

Create a trigger function (`handle_invite_on_signup`) that runs after a new user is created in `auth.users`. It will:
- Look up all pending, non-expired invites matching the user's email
- Insert a `circle_memberships` row for each
- Update the invite status to `'accepted'`

This uses `SECURITY DEFINER` since it needs to read `circle_invites` and write to `circle_memberships` without RLS restrictions.

### 2. Database Migration -- RLS policy for circle_invites UPDATE

Add an UPDATE policy on `circle_invites` so the trigger (and future frontend fallback) can mark invites as accepted. The trigger runs as SECURITY DEFINER so it bypasses RLS, but we also need a policy allowing the invited user to update their own invites.

### 3. Frontend fallback -- Check pending invites on login

In `CircleContext.tsx`, after fetching circles, also query `circle_invites` for any pending invites matching the logged-in user's email. If found, insert the membership and update the invite status. This handles:
- Users who signed up before the trigger was added
- Edge cases where the trigger might not fire

### 4. Update circle_memberships INSERT RLS

Currently only circle admins can add members. The trigger bypasses RLS (SECURITY DEFINER), but the frontend fallback needs users to be able to insert their own membership when accepting an invite. We'll add a new INSERT policy: "Users can join via invite" that checks a valid pending invite exists for their email.

## Technical Details

### Trigger SQL (simplified)
```text
CREATE FUNCTION public.handle_invite_on_signup()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.circle_memberships (circle_id, user_id, role)
  SELECT ci.circle_id, NEW.id, 'member'
  FROM public.circle_invites ci
  WHERE ci.email = NEW.email
    AND ci.status = 'pending'
    AND ci.expires_at > now()
  ON CONFLICT DO NOTHING;

  UPDATE public.circle_invites
  SET status = 'accepted'
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invite_on_signup();
```

### Frontend fallback in CircleContext
After login, query pending invites by email, join circles, and mark accepted. This ensures no invited user falls through the cracks.
