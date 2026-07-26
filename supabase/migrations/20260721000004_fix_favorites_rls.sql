-- Fix favorites table and policies
-- Ensure the table exists with the correct columns and constraints
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.land_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Remove any conflicting policies
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can read own favorites" ON public.favorites;

-- Create granular policies for better security and troubleshooting
CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own favorites" ON public.favorites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_favorites_user_project ON public.favorites(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_favorites_project_id ON public.favorites(project_id);
