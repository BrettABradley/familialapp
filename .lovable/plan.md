

## Plan: Circle Limits, Ownership Transfer, and Album Enhancements

### Problem 1: Free Account Circle Limit Not Enforced

The `can_create_circle` database function defaults to a limit of 3 when no `user_plans` row exists. However, the `user_plans` table is currently **empty** -- no rows are created for new signups. While the default of 3 matches the Free tier pricing, this is fragile. We need to:

- **Auto-create a `user_plans` row on signup** via the existing `handle_new_user` trigger, ensuring every user gets a concrete Free tier row (max_circles=3, max_members_per_circle=8).
- **Also show the user their remaining circle slots** in the UI so they know they have a limit.
- Fix the `user_plans` table default for `max_circles` from 1 to 3 (so if a row is created without specifying, it matches Free tier).

### Problem 2: Circle Ownership Transfer

Currently only owners can edit/delete circles. We need to add:

- A **"Transfer Ownership"** option in the circle management UI (visible only to the current owner).
- A dropdown/select to pick from existing circle members.
- Update the `circles.owner_id` to the new owner. This requires a new RLS policy or a database function since the current UPDATE policy only allows the owner.

### Problem 3: Circle Deletion by Admin

Circle deletion already works for owners (the trash icon on hover). However, circle admins (non-owners with admin role) cannot delete circles. We should:

- Allow circle admins to also see the delete button and delete the circle via the existing RLS policy (which currently only allows `owner_id = auth.uid()`).
- **Decision**: Keep delete restricted to owners only, since ownership can now be transferred. Admins who need to delete can request ownership transfer first. This is safer.

### Problem 4: Album "Created by" Attribution

Albums store `created_by` but the UI doesn't show who created them. We need to:

- Fetch the creator's profile (display_name) when displaying albums.
- Show "Created by [Name]" on each album card and in the album detail view.

### Problem 5: Album Deletion by Creator/Admin

Album deletion already works for the creator in the detail view. We should also:

- Make sure circle admins can delete any album (the RLS policy already supports this via `is_circle_admin`).
- Add a delete button on album cards in the list view (not just detail view) for the creator/admin.

---

### Technical Implementation

**1. Database Migration**

```sql
-- Fix user_plans defaults to match Free tier
ALTER TABLE public.user_plans ALTER COLUMN max_circles SET DEFAULT 3;

-- Update handle_new_user to also create a user_plans row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_plans (user_id, plan, max_circles, max_members_per_circle)
  VALUES (NEW.id, 'free', 3, 8)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Backfill: create user_plans rows for existing users who don't have one
INSERT INTO public.user_plans (user_id, plan, max_circles, max_members_per_circle)
SELECT p.user_id, 'free', 3, 8
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_plans up WHERE up.user_id = p.user_id);

-- Allow owners to transfer ownership (update owner_id)
-- The existing UPDATE policy only allows owner to update, which covers transfer
-- But we need a function to handle the transfer safely
CREATE OR REPLACE FUNCTION public.transfer_circle_ownership(_circle_id uuid, _new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is current owner
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = _circle_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the circle owner can transfer ownership';
  END IF;
  
  -- Verify new owner is a member of the circle
  IF NOT EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id = _circle_id AND user_id = _new_owner_id) THEN
    RAISE EXCEPTION 'New owner must be a member of the circle';
  END IF;
  
  -- Transfer ownership
  UPDATE circles SET owner_id = _new_owner_id WHERE id = _circle_id;
  
  -- Remove new owner from memberships (owners are implicit members)
  DELETE FROM circle_memberships WHERE circle_id = _circle_id AND user_id = _new_owner_id;
  
  -- Add old owner as admin member
  INSERT INTO circle_memberships (circle_id, user_id, role) VALUES (_circle_id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;
END;
$$;
```

**2. Circles Page (`src/pages/Circles.tsx`)**

- Add a "Transfer Ownership" button in the circle card (owner only).
- Open a dialog showing circle members with a "Transfer" button next to each.
- Call the `transfer_circle_ownership` database function via `supabase.rpc()`.

**3. Albums Page (`src/pages/Albums.tsx`)**

- Update the album fetch query to join with `profiles` to get creator display name.
- Show "Created by [Name]" on album cards in the grid view.
- Show "Created by [Name]" in the album detail header.
- Add a delete button on album cards in the list view for creator/admins.

**4. Files to Change**

| File | Change |
|------|--------|
| Database migration | Fix defaults, backfill user_plans, add transfer function |
| `src/pages/Circles.tsx` | Add transfer ownership dialog and handler |
| `src/pages/Albums.tsx` | Add "Created by" display, delete button on album cards |

