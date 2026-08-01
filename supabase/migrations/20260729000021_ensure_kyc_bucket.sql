-- ============================================================
-- ENSURE KYC STORAGE BUCKET EXISTS WITH PROPER POLICIES
-- ============================================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-final', 'kyc-final', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Enable RLS on storage.objects (if not already enabled)
-- Note: Supabase enables this by default, but we ensure policies are set.

-- 3. DROP existing policies for this bucket to avoid conflicts during sync
DO $$
BEGIN
    DELETE FROM storage.policies WHERE bucket_id = 'kyc-final';
EXCEPTION
    WHEN undefined_table THEN
        -- Standard Supabase may not allow direct delete from storage.policies
        -- We will use DROP POLICY IF EXISTS instead
        NULL;
END $$;

-- 4. Create SELECT policy: Anyone can view KYC documents (Public bucket)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'kyc-final' );

-- 5. Create INSERT policy: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kyc-final' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Create UPDATE/DELETE policy: Users can manage their own files
CREATE POLICY "Users can update own KYC documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'kyc-final' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own KYC documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'kyc-final' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Grant Admin Full Access
CREATE POLICY "Admins have full access to KYC bucket"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'kyc-final' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
    )
);
