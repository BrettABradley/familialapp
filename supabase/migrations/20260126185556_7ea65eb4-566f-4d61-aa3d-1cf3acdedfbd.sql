-- Fix store_offers security issues:
-- 1. Add submitted_by column for user tracking
-- 2. Update rate limit function to use correct column name
-- 3. Create public view excluding sensitive contact data
-- 4. Update RLS policies to protect sensitive business data

-- Step 1: Add submitted_by column to store_offers
ALTER TABLE public.store_offers 
ADD COLUMN submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Drop the old rate limit trigger and function, then recreate with correct column
DROP TRIGGER IF EXISTS check_store_offer_rate ON public.store_offers;

CREATE OR REPLACE FUNCTION public.check_store_offer_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  -- Only rate limit if we have a user
  IF NEW.submitted_by IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT COUNT(*) INTO recent_count
  FROM public.store_offers
  WHERE submitted_by = NEW.submitted_by
    AND created_at > NOW() - INTERVAL '1 day';
  
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 3 store offers per day';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the rate limit trigger
CREATE TRIGGER check_store_offer_rate
  BEFORE INSERT ON public.store_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_store_offer_rate_limit();

-- Step 3: Update RLS policies - drop the public SELECT and create auth-required ones

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view active store offers" ON public.store_offers;

-- Create a policy that only allows authenticated users to see active offers
-- but excludes sensitive contact data through a view
CREATE POLICY "Authenticated users can view active store offers"
ON public.store_offers FOR SELECT
USING (
  auth.uid() IS NOT NULL AND is_active = true
);

-- Allow users to view their own submitted offers (including inactive ones)
CREATE POLICY "Users can view their own store offers"
ON public.store_offers FOR SELECT
USING (auth.uid() = submitted_by);

-- Update the INSERT policy to ensure submitted_by is set
DROP POLICY IF EXISTS "Authenticated users can submit store offers" ON public.store_offers;

CREATE POLICY "Authenticated users can submit store offers"
ON public.store_offers FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = submitted_by
);

-- Allow users to update their own offers
CREATE POLICY "Users can update their own store offers"
ON public.store_offers FOR UPDATE
USING (auth.uid() = submitted_by);

-- Allow users to delete their own offers
CREATE POLICY "Users can delete their own store offers"
ON public.store_offers FOR DELETE
USING (auth.uid() = submitted_by);

-- Step 4: Create a public-safe view that excludes sensitive contact information
-- This view can be used when displaying offers to other users
CREATE OR REPLACE VIEW public.store_offers_public
WITH (security_invoker = on) AS
SELECT 
  id,
  offer_title,
  offer_description,
  target_locations,
  image_url,
  link_url,
  is_active,
  created_at,
  updated_at
  -- Excludes: company_name, company_email, company_phone, submitted_by, price_per_impression
FROM public.store_offers
WHERE is_active = true;