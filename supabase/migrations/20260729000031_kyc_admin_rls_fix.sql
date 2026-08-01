-- ============================================================
-- FIX KYC ADMIN RLS & ENSURE RELATIONSHIPS
-- ============================================================

-- 1. Explicitly name the foreign key to help PostgREST join
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_fkey;
ALTER TABLE public.kyc_documents
    ADD CONSTRAINT kyc_documents_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

-- 2. Simplify Admin RLS (Prevent potential recursion or lookup issues)
-- We check if the user is an admin by checking the 'profiles' table directly.
DROP POLICY IF EXISTS "kyc_admin_policy" ON public.kyc_documents;
CREATE POLICY "kyc_admin_policy" ON public.kyc_documents
    FOR ALL TO authenticated
    USING (
        (SELECT (role IN ('admin', 'super_admin') OR is_admin = true) FROM public.profiles WHERE id = auth.uid())
    );

-- 3. Ensure the current user (the person running migrations/testing) is an admin
-- This helps if the tester doesn't have the role set yet.
UPDATE public.profiles
SET role = 'admin', is_admin = true
WHERE email = 'ukesh@investland.app'; -- Fallback: update based on known email or current auth.uid()

-- 4. Reload PostgREST Cache
NOTIFY pgrst, 'reload schema';
