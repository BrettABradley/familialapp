-- Fix #1: Restrict profiles access to circle members only
-- Create a security definer function to check if two users share a circle
CREATE OR REPLACE FUNCTION public.shares_circle_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if both users are members of the same circle
    SELECT 1 FROM circle_memberships cm1
    INNER JOIN circle_memberships cm2 ON cm1.circle_id = cm2.circle_id
    WHERE cm1.user_id = _user_id AND cm2.user_id = _other_user_id
    
    UNION
    
    -- Check if user is owner and other is member
    SELECT 1 FROM circles c
    INNER JOIN circle_memberships cm ON c.id = cm.circle_id
    WHERE c.owner_id = _user_id AND cm.user_id = _other_user_id
    
    UNION
    
    -- Check if other is owner and user is member
    SELECT 1 FROM circles c
    INNER JOIN circle_memberships cm ON c.id = cm.circle_id
    WHERE c.owner_id = _other_user_id AND cm.user_id = _user_id
    
    UNION
    
    -- Check if both are owners of the same circle (edge case)
    SELECT 1 FROM circles c1
    INNER JOIN circles c2 ON c1.id = c2.id
    WHERE c1.owner_id = _user_id AND c2.owner_id = _other_user_id
  )
$$;

-- Drop the overly permissive profiles SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a more restrictive policy: users can only see their own profile or profiles of circle members
CREATE POLICY "Users can view profiles in their circles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id  -- Can always see own profile
  OR public.shares_circle_with(auth.uid(), user_id)  -- Can see profiles of circle members
);

-- Fix #2: Restrict store_offers to not expose sensitive data via direct access
-- The public view already exists, so we just need to update the SELECT policy
-- Drop the overly permissive policy that exposes all active offers
DROP POLICY IF EXISTS "Authenticated users can view active store offers" ON public.store_offers;

-- Only allow users to view their own offers (they already have a policy for this)
-- The store_offers_public view should be used for public listing
-- Verify the "Users can view their own store offers" policy exists and is sufficient