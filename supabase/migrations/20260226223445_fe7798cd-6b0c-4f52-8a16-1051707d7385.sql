-- Add UPDATE policy on profile_images for own images
CREATE POLICY "Users can update own profile images"
ON public.profile_images
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);