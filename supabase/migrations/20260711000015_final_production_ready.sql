-- ==========================================
-- FINAL PRODUCTION READINESS & SCHEMA ALIGNMENT
-- ==========================================

-- 1. Create specialized audit logging for Admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Setup automated referral reward trigger (Stub for Logic)
CREATE OR REPLACE FUNCTION public.distribute_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
    -- Logic: If kyc_status becomes 'Verified', find the referrer and credit wallet
    -- This requires a 'referrer_id' column in profiles which we ensure below
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Enhance Profiles table for production features
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 4. Secure storage for KYC (Private by default)
-- Policy to allow users to ONLY upload to their own folder structure
DROP POLICY IF EXISTS "Users manage own kyc docs" ON storage.objects;
CREATE POLICY "Users manage own kyc docs" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Final check on is_admin() to ensure zero recursion and high performance
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  );
$$;
