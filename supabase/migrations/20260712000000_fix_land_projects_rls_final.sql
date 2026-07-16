-- ==========================================
-- DEFINITIVE RLS FIX FOR LAND PROJECTS
-- ==========================================

-- 1. Ensure the is_admin function is robust
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin' OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Apply explicit ALL policy with WITH CHECK to avoid "new row violates" errors
ALTER TABLE public.land_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active projects" ON public.land_projects;
DROP POLICY IF EXISTS "Public can view active projects" ON public.land_projects;
CREATE POLICY "Public view projects" ON public.land_projects
FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage projects" ON public.land_projects;
CREATE POLICY "Admin manage projects" ON public.land_projects
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. Ensure the storage bucket policies are also robust
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-images' AND
  public.is_admin()
);

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-images' AND
  public.is_admin()
);
