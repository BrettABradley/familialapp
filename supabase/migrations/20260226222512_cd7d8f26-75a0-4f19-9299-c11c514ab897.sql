
-- Fix restrictive storage policies on avatars bucket
-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

-- Recreate permissive INSERT policy for authenticated users
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Drop existing restrictive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;

-- Recreate permissive UPDATE policy for authenticated users
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');
