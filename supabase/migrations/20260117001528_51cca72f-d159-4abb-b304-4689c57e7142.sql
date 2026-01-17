-- ====================================
-- FIX 1: Storage Policy - Require circle membership for post-media uploads
-- ====================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can upload post media" ON storage.objects;

-- Create stricter policy requiring circle membership
CREATE POLICY "Circle members can upload post media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post-media' 
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.circle_memberships WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.circles WHERE owner_id = auth.uid())
  )
);

-- ====================================
-- FIX 2: Rate Limiting - Add database triggers for critical operations
-- ====================================

-- Rate limit function for posts (20 per hour)
CREATE OR REPLACE FUNCTION public.check_post_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.posts
  WHERE author_id = NEW.author_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 20 posts per hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rate limit function for comments (50 per hour)
CREATE OR REPLACE FUNCTION public.check_comment_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.comments
  WHERE author_id = NEW.author_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 50 comments per hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rate limit function for private messages (30 per hour)
CREATE OR REPLACE FUNCTION public.check_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.private_messages
  WHERE sender_id = NEW.sender_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 30 messages per hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rate limit function for circle invites (10 per day per circle)
CREATE OR REPLACE FUNCTION public.check_invite_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.circle_invites
  WHERE circle_id = NEW.circle_id
    AND created_at > NOW() - INTERVAL '1 day';
  
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 10 invites per day per circle';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rate limit function for store offers (3 per day per user)
CREATE OR REPLACE FUNCTION public.check_store_offer_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.store_offers
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '1 day';
  
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 3 store offers per day';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rate limit function for fridge pins (20 per hour)
CREATE OR REPLACE FUNCTION public.check_fridge_pin_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.fridge_pins
  WHERE pinned_by = NEW.pinned_by
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 20 pins per hour';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for rate limiting
CREATE TRIGGER enforce_post_rate_limit
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_post_rate_limit();

CREATE TRIGGER enforce_comment_rate_limit
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_comment_rate_limit();

CREATE TRIGGER enforce_message_rate_limit
  BEFORE INSERT ON public.private_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_message_rate_limit();

CREATE TRIGGER enforce_invite_rate_limit
  BEFORE INSERT ON public.circle_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.check_invite_rate_limit();

CREATE TRIGGER enforce_store_offer_rate_limit
  BEFORE INSERT ON public.store_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_store_offer_rate_limit();

CREATE TRIGGER enforce_fridge_pin_rate_limit
  BEFORE INSERT ON public.fridge_pins
  FOR EACH ROW
  EXECUTE FUNCTION public.check_fridge_pin_rate_limit();