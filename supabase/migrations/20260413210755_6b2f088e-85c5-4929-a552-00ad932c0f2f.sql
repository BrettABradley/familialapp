
-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS accepted_terms_version text;

-- 2. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL PRIMARY KEY,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  muted_types text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
  ON public.notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Add deleted_at to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Drop old SELECT policy and recreate to exclude soft-deleted posts
DROP POLICY IF EXISTS "Circle members can view posts" ON public.posts;
CREATE POLICY "Circle members can view posts"
  ON public.posts FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_hidden = false
    AND (
      circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
      OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
    )
  );

-- 4. Add deleted_at to comments
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS "Circle members can view comments" ON public.comments;
CREATE POLICY "Circle members can view comments"
  ON public.comments FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_hidden = false
    AND post_id IN (
      SELECT id FROM posts
      WHERE (
        circle_id IN (SELECT circle_id FROM circle_memberships WHERE user_id = auth.uid())
        OR circle_id IN (SELECT id FROM circles WHERE owner_id = auth.uid())
      )
    )
  );
