-- ==========================================
-- SETTINGS DEFINITIVE FIX
-- ==========================================

-- 1. Ensure the table uses UUID and has all required columns
-- We use a fresh table approach if necessary, but ALTER is safer for data persistence.
-- Since the user says it's already UUID PRIMARY KEY, we just ensure columns.

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'InvestLand',
ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS aadhaar_verification BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pan_verification BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bank_verification BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS selfie_verification BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. DROP OLD POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS "Admins manage configs" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone read configs" ON public.app_settings;
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;

-- 4. CREATE PRODUCTION POLICIES
-- Policy to allow any authenticated user with 'admin' role to read
CREATE POLICY "Admins can select settings" ON public.app_settings
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
);

-- Policy to allow any authenticated user with 'admin' role to update
CREATE POLICY "Admins can update settings" ON public.app_settings
FOR UPDATE TO authenticated
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

-- Policy to allow any authenticated user with 'admin' role to insert (for first-time init)
CREATE POLICY "Admins can insert settings" ON public.app_settings
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
);

-- 5. INITIALIZE DATA (If table empty)
-- Since we don't know the UUID, the React code will handle the first insert
-- but we can add a default row with a fixed UUID for consistency if we wanted.
-- For now, let the React code's JIT insert handle it.
