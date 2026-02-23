

## Plan: Remove Moderator Role, Open Fridge and Invites to All Members

### Overview
Three changes: (1) remove the moderator role entirely, (2) let any circle member create/delete fridge pins, and (3) let any circle member send invites.

---

### 1. Remove Moderator Role

**Database migration:**
- Update the `app_role` enum to remove `moderator` (requires recreating the enum since Postgres can't drop enum values directly)
- Update any `user_roles` rows with `moderator` to `member`
- Recreate the `has_circle_role` function with the new enum

**Frontend (Circles.tsx):**
- Remove the `<SelectItem value="moderator">Mod</SelectItem>` option from the role dropdown (line 768)
- Only show "Admin" and "Member" options

---

### 2. Allow All Members to Use the Fridge

**Database migration -- update 4 RLS policies on `fridge_pins`:**
- **INSERT**: Change from `is_circle_admin(auth.uid(), circle_id)` to `is_circle_member(auth.uid(), circle_id)` (keeping `auth.uid() = pinned_by`)
- **DELETE**: Change from `is_circle_admin` to allow deletion by the pin creator OR circle admins: `(auth.uid() = pinned_by OR is_circle_admin(auth.uid(), circle_id))`
- **UPDATE**: Same pattern as DELETE -- pin creator or admin

**Frontend (Fridge.tsx):**
- Remove the `fetchAdminCircles` function and `adminCircles` state entirely
- Remove the `isAdmin` gate on the "Pin Something" button -- show it to all members (still gated by `!readOnly`)
- In the create dialog, show all circles (not just admin ones) in the circle selector
- For delete: allow deletion if the user created the pin (match `pinned_by`) or is admin of that circle
- Update the empty-state text that says "Circle admins can pin items here"

---

### 3. Allow All Members to Invite Members

**Database migration -- update `circle_invites` INSERT policy:**
- Change from requiring admin/owner to requiring circle membership:
  ```sql
  (is_circle_member(auth.uid(), circle_memberships.circle_id))
  ```

**Edge function (`send-circle-invite`):**
- The edge function uses `supabaseAdmin` for the invite insert, so it bypasses RLS. No change needed to the function itself -- the RLS change just allows the client-side path to work too.

**Frontend (Circles.tsx):**
- The Invite button is already visible to all members (line 709), so no UI change needed. The RLS fix will make it functional for non-admins.

---

### Technical Details

**Migration SQL (single migration):**

```sql
-- 1. Update any moderator user_roles to member
UPDATE public.user_roles SET role = 'member' WHERE role = 'moderator';

-- 2. Update any moderator circle_memberships to member
UPDATE public.circle_memberships SET role = 'member' WHERE role = 'moderator';

-- 3. Recreate app_role enum without moderator
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'member';
DROP TYPE public.app_role_old;

-- 4. Recreate has_circle_role function (uses the new enum)
CREATE OR REPLACE FUNCTION public.has_circle_role(...) -- unchanged logic

-- 5. Update fridge_pins RLS policies
DROP POLICY "Admins can create fridge pins" ON public.fridge_pins;
CREATE POLICY "Members can create fridge pins" ON public.fridge_pins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = pinned_by AND is_circle_member(auth.uid(), circle_id));

DROP POLICY "Admins can delete fridge pins" ON public.fridge_pins;
CREATE POLICY "Members can delete own or admin can delete" ON public.fridge_pins
  FOR DELETE TO authenticated
  USING (auth.uid() = pinned_by OR is_circle_admin(auth.uid(), circle_id));

DROP POLICY "Admins can update fridge pins" ON public.fridge_pins;
CREATE POLICY "Members can update own or admin can update" ON public.fridge_pins
  FOR UPDATE TO authenticated
  USING (auth.uid() = pinned_by OR is_circle_admin(auth.uid(), circle_id));

-- 6. Update circle_invites INSERT policy
DROP POLICY "Circle admins can create invites" ON public.circle_invites;
CREATE POLICY "Circle members can create invites" ON public.circle_invites
  FOR INSERT TO authenticated
  WITH CHECK (is_circle_member(auth.uid(), circle_id));
```

**Files to modify:**
- `src/pages/Circles.tsx` -- remove moderator from role dropdown
- `src/pages/Fridge.tsx` -- remove admin-only gating, allow all members to pin/delete own pins

