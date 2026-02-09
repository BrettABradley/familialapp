-- Add foreign key from posts.author_id to profiles.user_id so PostgREST can join them
ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_profiles_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(user_id);

-- Add foreign key from comments.author_id to profiles.user_id so PostgREST can join them
ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_id_profiles_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(user_id);