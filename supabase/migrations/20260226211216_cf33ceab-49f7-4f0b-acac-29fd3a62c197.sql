
-- 1. Add a permissive UPDATE policy for circle members to update avatar_url
CREATE POLICY "Members can update circle avatar"
ON public.circles
FOR UPDATE
USING (
  is_circle_member(auth.uid(), id)
)
WITH CHECK (
  is_circle_member(auth.uid(), id)
);

-- 2. Trigger to prevent non-owners from changing fields other than avatar_url
CREATE OR REPLACE FUNCTION public.restrict_circle_member_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If the user is the owner, allow all changes
  IF OLD.owner_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Non-owners can only change avatar_url
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.invite_code IS DISTINCT FROM OLD.invite_code
     OR NEW.transfer_block IS DISTINCT FROM OLD.transfer_block
     OR NEW.extra_members IS DISTINCT FROM OLD.extra_members
  THEN
    RAISE EXCEPTION 'Only the circle owner can modify circle details other than the avatar';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_circle_member_update
BEFORE UPDATE ON public.circles
FOR EACH ROW
EXECUTE FUNCTION public.restrict_circle_member_update();

-- 3. Storage policy: allow authenticated users to upload to avatars bucket
-- First check if policy exists, use DO block
DO $$
BEGIN
  -- Insert policy for avatars bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload avatars'
  ) THEN
    CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can update avatars'
  ) THEN
    CREATE POLICY "Authenticated users can update avatars"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars');
  END IF;
END $$;
