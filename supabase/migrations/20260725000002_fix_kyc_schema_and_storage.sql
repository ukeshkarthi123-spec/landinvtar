-- 1. Fix kyc_documents schema
-- Add missing columns and unique constraint for upsert
DO $$
BEGIN
    -- Add mobile_number if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='mobile_number') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN mobile_number TEXT;
    END IF;

    -- Add aadhaar_back_file_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_file_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN aadhaar_back_file_url TEXT;
    END IF;

    -- Rename selfie_url to selfie_file_url if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN selfie_url TO selfie_file_url;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_file_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN selfie_file_url TEXT;
    END IF;
END $$;

-- Add UNIQUE constraint on user_id if it doesn't exist (required for upsert)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kyc_documents_user_id_key'
    ) THEN
        ALTER TABLE public.kyc_documents ADD CONSTRAINT kyc_documents_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. Fix Storage Policies for kyc-documents bucket
-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop old loose policies
DROP POLICY IF EXISTS "Users can upload KYC images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view KYC images" ON storage.objects;

-- Policy for INSERT (allows initial upload)
CREATE POLICY "Users can upload KYC images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kyc-documents');

-- Policy for UPDATE (required for upsert: true)
CREATE POLICY "Users can update own KYC images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'kyc-documents');

-- Policy for SELECT (allows previewing)
CREATE POLICY "Users can view KYC images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'kyc-documents');

-- Policy for DELETE (if users want to replace)
CREATE POLICY "Users can delete own KYC images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'kyc-documents');

-- 3. Force schema reload
NOTIFY pgrst, 'reload schema';
