-- 1. Add mobile_number and fix selfie_file_url to kyc_documents if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='mobile_number') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN mobile_number TEXT;
    END IF;

    -- Ensure selfie_file_url exists (rename selfie_url if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN selfie_url TO selfie_file_url;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_file_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN selfie_file_url TEXT;
    END IF;
END $$;

-- 2. Update status constraint to match capitalization
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_status_check;
ALTER TABLE public.kyc_documents ADD CONSTRAINT kyc_documents_status_check
    CHECK (status IN ('Pending', 'Approved', 'Rejected'));

-- 3. Ensure RLS is enabled
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for kyc_documents
DROP POLICY IF EXISTS "select_own_kyc" ON kyc_documents;
CREATE POLICY "select_own_kyc" ON kyc_documents
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_kyc" ON kyc_documents;
CREATE POLICY "insert_own_kyc" ON kyc_documents
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_kyc" ON kyc_documents;
CREATE POLICY "update_own_kyc" ON kyc_documents
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all KYC docs" ON kyc_documents;
CREATE POLICY "Admins can view all KYC docs" ON kyc_documents
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')));

DROP POLICY IF EXISTS "Admins can update all KYC docs" ON kyc_documents;
CREATE POLICY "Admins can update all KYC docs" ON kyc_documents
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')));

-- 5. Storage Policies for kyc-documents bucket
-- Ensure bucket is public for easy previewing (or keep private and use signed URLs, but user said "Return public URLs")
-- Actually, it's better to keep it private for KYC, but user requested "Return public URLs after upload".
-- I will keep the bucket settings and just ensure policies allow SELECT for authenticated.

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can upload KYC images" ON storage.objects;
CREATE POLICY "Users can upload KYC images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kyc-documents');

DROP POLICY IF EXISTS "Users can view KYC images" ON storage.objects;
CREATE POLICY "Users can view KYC images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'kyc-documents');
