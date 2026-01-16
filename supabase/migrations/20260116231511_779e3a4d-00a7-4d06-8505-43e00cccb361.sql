-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  related_user_id UUID,
  related_circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  related_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Create family_tree_members table
CREATE TABLE public.family_tree_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  death_date DATE,
  gender TEXT,
  photo_url TEXT,
  bio TEXT,
  created_by UUID NOT NULL,
  parent1_id UUID REFERENCES public.family_tree_members(id) ON DELETE SET NULL,
  parent2_id UUID REFERENCES public.family_tree_members(id) ON DELETE SET NULL,
  spouse_id UUID REFERENCES public.family_tree_members(id) ON DELETE SET NULL,
  linked_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.family_tree_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can view family tree"
ON public.family_tree_members FOR SELECT
USING (
  circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
  OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
);

CREATE POLICY "Circle admins can manage family tree"
ON public.family_tree_members FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND is_circle_admin(auth.uid(), circle_id)
);

CREATE POLICY "Circle admins can update family tree"
ON public.family_tree_members FOR UPDATE
USING (is_circle_admin(auth.uid(), circle_id));

CREATE POLICY "Circle admins can delete family tree members"
ON public.family_tree_members FOR DELETE
USING (is_circle_admin(auth.uid(), circle_id));

-- Create photo_albums table
CREATE TABLE public.photo_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_photo_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can view albums"
ON public.photo_albums FOR SELECT
USING (
  circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
  OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
);

CREATE POLICY "Circle members can create albums"
ON public.photo_albums FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND (
    circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
    OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
  )
);

CREATE POLICY "Album creators can update"
ON public.photo_albums FOR UPDATE
USING (auth.uid() = created_by OR is_circle_admin(auth.uid(), circle_id));

CREATE POLICY "Album creators can delete"
ON public.photo_albums FOR DELETE
USING (auth.uid() = created_by OR is_circle_admin(auth.uid(), circle_id));

-- Create album_photos table
CREATE TABLE public.album_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.photo_albums(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can view album photos"
ON public.album_photos FOR SELECT
USING (
  album_id IN (
    SELECT id FROM photo_albums WHERE
    circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
    OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
  )
);

CREATE POLICY "Circle members can add album photos"
ON public.album_photos FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND album_id IN (
    SELECT id FROM photo_albums WHERE
    circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
    OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
  )
);

CREATE POLICY "Photo uploaders can delete"
ON public.album_photos FOR DELETE
USING (auth.uid() = uploaded_by);

-- Create private_messages table
CREATE TABLE public.private_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their messages"
ON public.private_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
ON public.private_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update read status"
ON public.private_messages FOR UPDATE
USING (auth.uid() = recipient_id);

CREATE POLICY "Senders can delete their messages"
ON public.private_messages FOR DELETE
USING (auth.uid() = sender_id);

-- Add validation triggers
CREATE OR REPLACE FUNCTION public.validate_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Notification title must be 200 characters or less';
  END IF;
  IF NEW.message IS NOT NULL AND length(NEW.message) > 1000 THEN
    RAISE EXCEPTION 'Notification message must be 1000 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_notification_trigger
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.validate_notification();

CREATE OR REPLACE FUNCTION public.validate_family_tree_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Name must be 100 characters or less';
  END IF;
  IF NEW.bio IS NOT NULL AND length(NEW.bio) > 1000 THEN
    RAISE EXCEPTION 'Bio must be 1000 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_family_tree_member_trigger
BEFORE INSERT OR UPDATE ON public.family_tree_members
FOR EACH ROW
EXECUTE FUNCTION public.validate_family_tree_member();

CREATE OR REPLACE FUNCTION public.validate_photo_album()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Album name must be 100 characters or less';
  END IF;
  IF NEW.description IS NOT NULL AND length(NEW.description) > 500 THEN
    RAISE EXCEPTION 'Album description must be 500 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_photo_album_trigger
BEFORE INSERT OR UPDATE ON public.photo_albums
FOR EACH ROW
EXECUTE FUNCTION public.validate_photo_album();

CREATE OR REPLACE FUNCTION public.validate_private_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(NEW.content) > 5000 THEN
    RAISE EXCEPTION 'Message must be 5000 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_private_message_trigger
BEFORE INSERT OR UPDATE ON public.private_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_private_message();

-- Add trigger for updated_at
CREATE TRIGGER update_family_tree_members_updated_at
BEFORE UPDATE ON public.family_tree_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_photo_albums_updated_at
BEFORE UPDATE ON public.photo_albums
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();