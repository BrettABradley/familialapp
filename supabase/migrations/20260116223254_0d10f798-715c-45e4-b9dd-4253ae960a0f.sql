-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  location TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Circles (family groups, friend groups)
CREATE TABLE public.circles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Circle memberships (many-to-many)
CREATE TABLE public.circle_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(circle_id, user_id)
);

-- Posts
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Comments on posts
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reactions on posts
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Circle invites
CREATE TABLE public.circle_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

-- Store offers (B2B advertising for local companies)
CREATE TABLE public.store_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_email TEXT NOT NULL,
  company_phone TEXT,
  offer_title TEXT NOT NULL,
  offer_description TEXT,
  target_locations TEXT[] DEFAULT '{}',
  image_url TEXT,
  link_url TEXT,
  price_per_impression DECIMAL(10,4) DEFAULT 0.01,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_offers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Circles policies
CREATE POLICY "Users can view circles they belong to" ON public.circles FOR SELECT 
  USING (owner_id = auth.uid() OR id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid()));
CREATE POLICY "Users can create circles" ON public.circles FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update circles" ON public.circles FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete circles" ON public.circles FOR DELETE USING (auth.uid() = owner_id);

-- Circle memberships policies
CREATE POLICY "Members can view circle memberships" ON public.circle_memberships FOR SELECT 
  USING (user_id = auth.uid() OR circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid()));
CREATE POLICY "Circle owners/admins can add members" ON public.circle_memberships FOR INSERT 
  WITH CHECK (circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid()) 
    OR circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Circle owners/admins can remove members" ON public.circle_memberships FOR DELETE 
  USING (circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid()) 
    OR circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid() AND role = 'admin')
    OR user_id = auth.uid());

-- Posts policies
CREATE POLICY "Circle members can view posts" ON public.posts FOR SELECT 
  USING (circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid()) 
    OR circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid()));
CREATE POLICY "Circle members can create posts" ON public.posts FOR INSERT 
  WITH CHECK (auth.uid() = author_id AND (circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid()) 
    OR circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid())));
CREATE POLICY "Authors can update posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- Comments policies
CREATE POLICY "Circle members can view comments" ON public.comments FOR SELECT 
  USING (post_id IN (SELECT id FROM public.posts WHERE circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid()) 
    OR circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid())));
CREATE POLICY "Circle members can create comments" ON public.comments FOR INSERT 
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete comments" ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- Reactions policies
CREATE POLICY "Circle members can view reactions" ON public.reactions FOR SELECT 
  USING (post_id IN (SELECT id FROM public.posts WHERE circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid()) 
    OR circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid())));
CREATE POLICY "Users can add reactions" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- Circle invites policies
CREATE POLICY "Users can view invites they sent" ON public.circle_invites FOR SELECT USING (auth.uid() = invited_by);
CREATE POLICY "Circle admins can create invites" ON public.circle_invites FOR INSERT 
  WITH CHECK (circle_id IN (SELECT id FROM public.circles WHERE owner_id = auth.uid()) 
    OR circle_id IN (SELECT circle_id FROM public.circle_memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- Store offers are public for viewing
CREATE POLICY "Anyone can view active store offers" ON public.store_offers FOR SELECT USING (is_active = true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_circles_updated_at BEFORE UPDATE ON public.circles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_offers_updated_at BEFORE UPDATE ON public.store_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;