-- ==========================================
-- FINAL KYC SYSTEM FIX & HARDENING
-- ==========================================

-- 1. Table Schema Cleanup
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

    -- Ensure selfie_file_url exists (rename selfie_url if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN selfie_url TO selfie_file_url;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_file_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN selfie_file_url TEXT;
    END IF;
END $$;

-- 2. Improved Trigger Function to Sync KYC status
-- Sets profile.kyc_status to exact status from document table
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    kyc_status = CASE
      WHEN NEW.status = 'Approved' THEN 'Verified'
      WHEN NEW.status = 'Pending' THEN 'Pending'
      WHEN NEW.status = 'Rejected' THEN 'Rejected'
      ELSE 'Not Started'
    END,
    updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Storage Bucket Configuration
-- Ensure bucket is set to public for direct loading (as requested for simplicity)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Precise Storage Policies (Path-based)
-- Users can only manage files in their own folder (folder name = user_id)
DROP POLICY IF EXISTS "Users can upload KYC images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view KYC images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own KYC images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own KYC images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all KYC" ON storage.objects;

-- Policy for UPLOAD (INSERT)
CREATE POLICY "Users can upload own KYC" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'kyc-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy for UPDATE (required for overwrite)
CREATE POLICY "Users can update own KYC" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'kyc-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy for SELECT (allows users to see their own, and admins to see all)
CREATE POLICY "KYC visibility" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'kyc-documents' AND (
            (storage.foldername(name))[1] = auth.uid()::text OR
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
            )
        )
    );

-- 5. KYC Documents Table Policies
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_kyc" ON kyc_documents;
DROP POLICY IF EXISTS "insert_own_kyc" ON kyc_documents;
DROP POLICY IF EXISTS "update_own_kyc" ON kyc_documents;
DROP POLICY IF EXISTS "Admins can manage all KYC" ON kyc_documents;
DROP POLICY IF EXISTS "Admins can view all KYC docs" ON kyc_documents;
DROP POLICY IF EXISTS "Admins can update all KYC docs" ON kyc_documents;

-- USER POLICIES
CREATE POLICY "user_select_own" ON public.kyc_documents
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "user_insert_own" ON public.kyc_documents
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_update_own" ON public.kyc_documents
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ADMIN POLICIES
CREATE POLICY "admin_manage_all" ON public.kyc_documents
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')));

-- Force schema reload
NOTIFY pgrst, 'reload schema';
