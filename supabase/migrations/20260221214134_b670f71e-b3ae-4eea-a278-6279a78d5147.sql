-- Add foreign key from reactions.user_id to profiles.user_id for join support
ALTER TABLE public.reactions
ADD CONSTRAINT reactions_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);