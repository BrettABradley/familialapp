## Security findings — fix plan

Goal: resolve the 4 findings without breaking avatar uploads (profile, circle, group chat), transfer requests, or appeal flows.

---

### 1. ERROR — Avatars bucket: any user can upload to any path

The `avatars` bucket is used for three path patterns:
- `{user_id}/...` — personal profile avatar (`Settings.tsx`)
- `circle-{circleId}/...` — circle avatar (`Circles.tsx`)
- `group-chats/{groupId}/...` — group chat avatar (`Messages.tsx`)

A simple "first folder must equal auth.uid()" check would break circle and group-chat avatars. Replace the INSERT and UPDATE policies with one that allows uploads only to a path the caller is entitled to:

- own-profile path: `(storage.foldername(name))[1] = auth.uid()::text`, OR
- circle path: name starts with `circle-<uuid>/` AND `public.is_circle_member(auth.uid(), <uuid>)` is true, OR
- group-chat path: name starts with `group-chats/<uuid>/` AND `public.is_group_chat_member(auth.uid(), <uuid>)` is true.

Apply the same WITH CHECK (and USING for UPDATE) to both `Authenticated users can upload avatars` and `Users can update their own avatar`.

### 2. WARN — `circle_transfer_requests` INSERT does not verify ownership

The current `Circle owners can create transfer requests` policy only checks `auth.uid() = from_user_id`. Replace its WITH CHECK with:

```
auth.uid() = from_user_id
AND EXISTS (
  SELECT 1 FROM public.circles
  WHERE id = circle_id AND owner_id = auth.uid()
)
```

So only the real current owner of the referenced circle can create a transfer request.

### 3. WARN — `user_appeals` token exposure (future risk)

Today there is no user-facing SELECT policy on `user_appeals`, so users cannot read their own row or token — only platform admins can. The finding is purely a "don't add a user SELECT policy later that leaks tokens" warning. Action:

- Verify (already done) that no SELECT policy grants users access to their own appeals.
- Mark the finding ignored with an explanation, and record the constraint in security memory so future changes don't add a SELECT policy that exposes `token`.

### 4. WARN — `store_offers` company contact details

The scanner's own description concludes "No finding needed here" — the SELECT policy correctly limits visibility to the submitter and admins, and submitters reading back their own row is by design. Action: mark ignored with that rationale.

---

### Technical details

**Migration** (single file):

```sql
-- 1. Avatars bucket: tighten upload + update policies
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    -- own profile folder
    (storage.foldername(name))[1] = auth.uid()::text
    -- circle avatar: path "circle-<uuid>/..."
    OR (
      (storage.foldername(name))[1] LIKE 'circle-%'
      AND public.is_circle_member(
        auth.uid(),
        substring((storage.foldername(name))[1] from 8)::uuid
      )
    )
    -- group chat avatar: path "group-chats/<uuid>/..."
    OR (
      (storage.foldername(name))[1] = 'group-chats'
      AND public.is_group_chat_member(
        auth.uid(),
        (storage.foldername(name))[2]::uuid
      )
    )
  )
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] LIKE 'circle-%'
      AND public.is_circle_member(
        auth.uid(),
        substring((storage.foldername(name))[1] from 8)::uuid
      )
    )
    OR (
      (storage.foldername(name))[1] = 'group-chats'
      AND public.is_group_chat_member(
        auth.uid(),
        (storage.foldername(name))[2]::uuid
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] LIKE 'circle-%'
      AND public.is_circle_member(
        auth.uid(),
        substring((storage.foldername(name))[1] from 8)::uuid
      )
    )
    OR (
      (storage.foldername(name))[1] = 'group-chats'
      AND public.is_group_chat_member(
        auth.uid(),
        (storage.foldername(name))[2]::uuid
      )
    )
  )
);

-- 2. circle_transfer_requests: enforce real ownership on INSERT
DROP POLICY IF EXISTS "Circle owners can create transfer requests" ON public.circle_transfer_requests;
CREATE POLICY "Circle owners can create transfer requests"
ON public.circle_transfer_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = from_user_id
  AND EXISTS (
    SELECT 1 FROM public.circles
    WHERE id = circle_id AND owner_id = auth.uid()
  )
);
```

**Findings to mark ignored** via `security--manage_security_finding`:
- `user_appeals_token_exposure` — no user-facing SELECT exists; admin-only access by design.
- `store_offers_company_contact_exposure` — scanner itself notes "No finding needed here".

**Security memory update**: note that `user_appeals.token` and `user_appeals.email` must never be exposed via a user SELECT policy; admin-only is the contract.

No frontend code changes required — existing upload paths (`{user.id}/…`, `circle-{circleId}/…`, `group-chats/{groupId}/…`) already match the tightened policy.
