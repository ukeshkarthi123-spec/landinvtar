-- ==========================================
-- PRODUCTION HARDENING & SECURITY AUDIT
-- ==========================================

-- 1. Create a helper function to safely check admin status without recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Audit and Fix Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated USING (public.is_admin());

-- 3. Audit and Fix Land Projects RLS (Ensure write protection)
ALTER TABLE public.land_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active projects" ON public.land_projects;
CREATE POLICY "Public can view active projects" ON public.land_projects
FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage projects" ON public.land_projects;
CREATE POLICY "Admins can manage projects" ON public.land_projects
FOR ALL TO authenticated USING (public.is_admin());

-- 4. Audit and Fix Investments RLS
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
CREATE POLICY "Users can view own investments" ON public.investments
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all investments" ON public.investments;
CREATE POLICY "Admins can view all investments" ON public.investments
FOR SELECT TO authenticated USING (public.is_admin());

-- 5. Fix Foreign Key relationships for easier joins
-- Ensure investments link to profiles for the Admin Dashboard
ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_user_id_profiles_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. Setup Audit Logging Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.audit_logs
FOR SELECT TO authenticated USING (public.is_admin());
