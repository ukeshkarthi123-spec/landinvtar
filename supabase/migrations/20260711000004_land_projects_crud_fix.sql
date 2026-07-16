-- ==========================================
-- LAND PROJECTS CRUD & STORAGE SETUP
-- ==========================================

-- 1. Ensure land_projects table is complete
DO $$
BEGIN
  -- Add any potentially missing columns with defaults
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'category') THEN
    ALTER TABLE public.land_projects ADD COLUMN category TEXT DEFAULT 'Residential';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'min_investment') THEN
    ALTER TABLE public.land_projects ADD COLUMN min_investment NUMERIC DEFAULT 500;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'expected_roi') THEN
    ALTER TABLE public.land_projects ADD COLUMN expected_roi NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'funding_progress') THEN
    ALTER TABLE public.land_projects ADD COLUMN funding_progress NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'raised_funding') THEN
    ALTER TABLE public.land_projects ADD COLUMN raised_funding NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'total_funding') THEN
    ALTER TABLE public.land_projects ADD COLUMN total_funding NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'land_projects' AND column_name = 'investors_count') THEN
    ALTER TABLE public.land_projects ADD COLUMN investors_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. SETUP STORAGE FOR PROJECT IMAGES
-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-images' AND
  (SELECT (role = 'admin') FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-images' AND
  (SELECT (role = 'admin') FROM public.profiles WHERE id = auth.uid())
);

-- 3. UPDATED LAND PROJECTS RLS
-- Use the secure is_admin() function created in previous migrations
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.land_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active projects" ON public.land_projects;
CREATE POLICY "Anyone can view active projects" ON public.land_projects
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage projects" ON public.land_projects;
CREATE POLICY "Admins can manage projects" ON public.land_projects
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
