-- Add RLS INSERT policy to store_offers requiring authentication
CREATE POLICY "Authenticated users can submit store offers" 
ON public.store_offers 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Add text length constraints using validation trigger instead of CHECK constraints
-- (CHECK constraints must be immutable, so we use triggers for flexibility)

CREATE OR REPLACE FUNCTION public.validate_store_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate company_name length
  IF length(NEW.company_name) > 200 THEN
    RAISE EXCEPTION 'Company name must be 200 characters or less';
  END IF;
  
  -- Validate company_email format and length
  IF length(NEW.company_email) > 255 THEN
    RAISE EXCEPTION 'Company email must be 255 characters or less';
  END IF;
  
  IF NEW.company_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Validate company_phone length if provided
  IF NEW.company_phone IS NOT NULL AND length(NEW.company_phone) > 50 THEN
    RAISE EXCEPTION 'Company phone must be 50 characters or less';
  END IF;
  
  -- Validate offer_title length
  IF length(NEW.offer_title) > 200 THEN
    RAISE EXCEPTION 'Offer title must be 200 characters or less';
  END IF;
  
  -- Validate offer_description length if provided
  IF NEW.offer_description IS NOT NULL AND length(NEW.offer_description) > 2000 THEN
    RAISE EXCEPTION 'Offer description must be 2000 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_store_offer_trigger
BEFORE INSERT OR UPDATE ON public.store_offers
FOR EACH ROW
EXECUTE FUNCTION public.validate_store_offer();

-- Add validation trigger for posts content
CREATE OR REPLACE FUNCTION public.validate_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate content length if provided
  IF NEW.content IS NOT NULL AND length(NEW.content) > 5000 THEN
    RAISE EXCEPTION 'Post content must be 5000 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_post_trigger
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.validate_post();

-- Add validation trigger for comments content
CREATE OR REPLACE FUNCTION public.validate_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate content length
  IF length(NEW.content) > 2000 THEN
    RAISE EXCEPTION 'Comment must be 2000 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_comment_trigger
BEFORE INSERT OR UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.validate_comment();

-- Add validation trigger for circles
CREATE OR REPLACE FUNCTION public.validate_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate name length
  IF length(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Circle name must be 100 characters or less';
  END IF;
  
  -- Validate description length if provided
  IF NEW.description IS NOT NULL AND length(NEW.description) > 500 THEN
    RAISE EXCEPTION 'Circle description must be 500 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_circle_trigger
BEFORE INSERT OR UPDATE ON public.circles
FOR EACH ROW
EXECUTE FUNCTION public.validate_circle();

-- Add validation trigger for events
CREATE OR REPLACE FUNCTION public.validate_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate title length
  IF length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Event title must be 200 characters or less';
  END IF;
  
  -- Validate description length if provided
  IF NEW.description IS NOT NULL AND length(NEW.description) > 2000 THEN
    RAISE EXCEPTION 'Event description must be 2000 characters or less';
  END IF;
  
  -- Validate location length if provided
  IF NEW.location IS NOT NULL AND length(NEW.location) > 300 THEN
    RAISE EXCEPTION 'Event location must be 300 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_event_trigger
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.validate_event();

-- Add validation trigger for fridge_pins
CREATE OR REPLACE FUNCTION public.validate_fridge_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate title length
  IF length(NEW.title) > 100 THEN
    RAISE EXCEPTION 'Pin title must be 100 characters or less';
  END IF;
  
  -- Validate content length if provided
  IF NEW.content IS NOT NULL AND length(NEW.content) > 1000 THEN
    RAISE EXCEPTION 'Pin content must be 1000 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_fridge_pin_trigger
BEFORE INSERT OR UPDATE ON public.fridge_pins
FOR EACH ROW
EXECUTE FUNCTION public.validate_fridge_pin();