-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'member');

-- Create user_roles table for role management (separate from profiles for security)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, circle_id)
);

-- Create events table for family calendar
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create fridge_pins table for admin pinned items
CREATE TABLE public.fridge_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL,
  title text NOT NULL,
  content text,
  image_url text,
  pin_type text NOT NULL DEFAULT 'note',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create photo_permissions table for download permissions
CREATE TABLE public.photo_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  can_download boolean NOT NULL DEFAULT false,
  granted_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fridge_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_permissions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role in a circle
CREATE OR REPLACE FUNCTION public.has_circle_role(_user_id uuid, _circle_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND circle_id = _circle_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is circle admin or owner
CREATE OR REPLACE FUNCTION public.is_circle_admin(_user_id uuid, _circle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circles WHERE id = _circle_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND circle_id = _circle_id AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their circles"
ON public.user_roles FOR SELECT
USING (
  circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
  OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_circle_admin(auth.uid(), circle_id));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.is_circle_admin(auth.uid(), circle_id));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.is_circle_admin(auth.uid(), circle_id));

-- RLS Policies for events
CREATE POLICY "Circle members can view events"
ON public.events FOR SELECT
USING (
  circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
  OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
);

CREATE POLICY "Circle members can create events"
ON public.events FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
    OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
  )
);

CREATE POLICY "Event creators can update events"
ON public.events FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Event creators can delete events"
ON public.events FOR DELETE
USING (auth.uid() = created_by OR public.is_circle_admin(auth.uid(), circle_id));

-- RLS Policies for fridge_pins
CREATE POLICY "Circle members can view fridge pins"
ON public.fridge_pins FOR SELECT
USING (
  circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
  OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
);

CREATE POLICY "Admins can create fridge pins"
ON public.fridge_pins FOR INSERT
WITH CHECK (
  auth.uid() = pinned_by
  AND public.is_circle_admin(auth.uid(), circle_id)
);

CREATE POLICY "Admins can update fridge pins"
ON public.fridge_pins FOR UPDATE
USING (public.is_circle_admin(auth.uid(), circle_id));

CREATE POLICY "Admins can delete fridge pins"
ON public.fridge_pins FOR DELETE
USING (public.is_circle_admin(auth.uid(), circle_id));

-- RLS Policies for photo_permissions
CREATE POLICY "Users can view their photo permissions"
ON public.photo_permissions FOR SELECT
USING (user_id = auth.uid() OR granted_by = auth.uid());

CREATE POLICY "Post authors can grant photo permissions"
ON public.photo_permissions FOR INSERT
WITH CHECK (
  granted_by = auth.uid()
  AND post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
);

CREATE POLICY "Granters can delete permissions"
ON public.photo_permissions FOR DELETE
USING (granted_by = auth.uid());

-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);

-- Storage policies for post-media bucket
CREATE POLICY "Anyone can view post media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');

CREATE POLICY "Authenticated users can upload post media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post-media' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars bucket
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add triggers for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fridge_pins_updated_at
BEFORE UPDATE ON public.fridge_pins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();