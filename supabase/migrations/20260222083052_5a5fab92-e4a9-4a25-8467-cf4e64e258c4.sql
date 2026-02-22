
-- Add parent_comment_id to comments for reply threading
ALTER TABLE public.comments ADD COLUMN parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Index for faster reply lookups
CREATE INDEX idx_comments_parent_id ON public.comments(parent_comment_id);
