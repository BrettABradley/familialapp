-- Fix the overly permissive notifications INSERT policy
-- Drop the existing permissive policy
DROP POLICY "System can create notifications" ON public.notifications;

-- Create a more restrictive policy - only authenticated users can create notifications
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);