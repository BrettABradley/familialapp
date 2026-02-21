
-- Add album_id column to events table to link events to photo albums
ALTER TABLE public.events ADD COLUMN album_id uuid REFERENCES public.photo_albums(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_events_album_id ON public.events(album_id);
