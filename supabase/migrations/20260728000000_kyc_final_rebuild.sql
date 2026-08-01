-- ============================================================
-- KYC INFRASTRUCTURE REBUILD & RELATIONSHIP FIX
-- ============================================================

-- 1. Ensure kyc_documents table is correct
DO $$
BEGIN
    -- Rename selfie_url if it still exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN selfie_url TO selfie_file_url;
    END IF;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='mobile_number') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN mobile_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_file_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN aadhaar_back_file_url TEXT;
    END IF;
END $$;

-- 2. Explicit Foreign Key Relationship for PostgREST Joins
-- This fixes the "Could not find a relationship" error when joining with profiles
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_profiles_fkey;
ALTER TABLE public.kyc_documents
    ADD CONSTRAINT kyc_documents_user_id_profiles_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

-- 3. Storage Bucket Configuration
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage Policies
-- Clean up old policies
DELETE FROM storage.policies WHERE bucket_id = 'kyc-documents';

-- Policy: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kyc-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own documents
CREATE POLICY "Users can view own KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'kyc-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can view ALL documents
CREATE POLICY "Admins can view all KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'kyc-documents' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'super_admin')
    )
);

-- Policy: Admins can update/delete documents (for cleanup)
CREATE POLICY "Admins can manage all KYC documents"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'kyc-documents' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'super_admin')
    )
);

-- 5. KYC Status Sync Trigger (Robust version)
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

    -- Also create a notification if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            NEW.user_id,
            CASE WHEN NEW.status = 'Approved' THEN 'KYC Verified!' ELSE 'KYC Update' END,
            CASE
                WHEN NEW.status = 'Approved' THEN 'Your KYC documents have been successfully verified.'
                WHEN NEW.status = 'Rejected' THEN 'Your KYC verification was rejected: ' || COALESCE(NEW.rejection_reason, 'Please check your documents.')
                ELSE 'Your KYC documents are under review.'
            END,
            CASE WHEN NEW.status = 'Approved' THEN 'success' WHEN NEW.status = 'Rejected' THEN 'warning' ELSE 'info' END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc_documents;
CREATE TRIGGER tr_sync_kyc_status
AFTER INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION sync_kyc_status_to_profile();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON public.kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON public.kyc_documents(status);

-- Force cache reload
NOTIFY pgrst, 'reload schema';
