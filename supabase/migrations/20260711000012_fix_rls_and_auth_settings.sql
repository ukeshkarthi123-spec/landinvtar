-- ==========================================
-- FIX RLS POLICIES FOR APP_SETTINGS
-- ==========================================

-- 1. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read specific settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can select settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;

-- 3. Create simplified but secure policies
-- Allow everyone to read settings (necessary for app config)
CREATE POLICY "Allow public select on app_settings"
ON public.app_settings FOR SELECT
TO anon, authenticated
USING (true);

-- Allow admins to manage (INSERT, UPDATE, DELETE)
-- We use a simpler check first to ensure accessibility, then harden
CREATE POLICY "Allow admins to manage app_settings"
ON public.app_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
);

-- 4. Ensure at least one record exists with a known ID if possible,
-- but JIT in React is also fine.
