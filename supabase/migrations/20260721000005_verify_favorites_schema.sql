-- Complete rebuild of favorites table to ensure end-to-end functionality
-- This handles missing tables, incorrect columns, and RLS issues in one go.

-- 1. Create the table with strict UUID types and constraints
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.land_projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Prevent duplicate favorites for the same user/project
    CONSTRAINT unique_user_project_favorite UNIQUE(user_id, project_id)
);

-- 2. Ensure RLS is enabled
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 3. Clear existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can read own favorites" ON public.favorites;
DROP POLICY IF EXISTS "authenticated_manage_favorites" ON public.favorites;

-- 4. Create explicit, easy-to-diagnose policies
-- SELECT: Users can only see their own favorites
CREATE POLICY "select_favorites_policy"
ON public.favorites FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT: Users can only insert for themselves
CREATE POLICY "insert_favorites_policy"
ON public.favorites FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own favorites
CREATE POLICY "delete_favorites_policy"
ON public.favorites FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Add performance and constraint indexes
CREATE INDEX IF NOT EXISTS idx_fav_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_fav_project_id ON public.favorites(project_id);

-- 6. Grant permissions (just in case they were revoked)
GRANT ALL ON public.favorites TO authenticated;
GRANT SELECT ON public.favorites TO anon;
