-- ============================================================
-- DEFINITIVE KYC SCHEMA FIX
-- ============================================================

-- 1. Table Rebuild/Sync
CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    pan_number TEXT,
    aadhaar_number TEXT,
    selfie_url TEXT,
    pan_url TEXT,
    aadhaar_front_url TEXT,
    aadhaar_back_url TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure core columns exist if table was already there
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='full_name') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN full_name TEXT;
    END IF;

    -- Handle renames for consistency with prompt
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='pan_file_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN pan_file_url TO pan_url;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_file_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN aadhaar_file_url TO aadhaar_front_url;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_file_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN aadhaar_back_file_url TO aadhaar_back_url;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_file_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN selfie_file_url TO selfie_url;
    END IF;

    -- Note: dob and address are removed from application logic as per request.
END $$;

-- 2. Update Profiles Table to support Rejected status and metadata
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;

    -- Add new kyc_verified column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='kyc_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN kyc_verified BOOLEAN DEFAULT false;
    END IF;

    -- Add kyc_rejected_reason if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='kyc_rejected_reason') THEN
        ALTER TABLE public.profiles ADD COLUMN kyc_rejected_reason TEXT;
    END IF;
END $$;

-- 3. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. RLS Policies for Table
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own KYC" ON public.kyc_documents;
CREATE POLICY "Users can manage their own KYC"
ON public.kyc_documents FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all KYC" ON public.kyc_documents;
CREATE POLICY "Admins can view all KYC"
ON public.kyc_documents FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
    )
);

DROP POLICY IF EXISTS "Admins can update KYC" ON public.kyc_documents;
CREATE POLICY "Admins can update KYC"
ON public.kyc_documents FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
    )
);

-- 5. RLS Policies for Storage
DROP POLICY IF EXISTS "Users can upload kyc" ON storage.objects;
CREATE POLICY "Users can upload kyc"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

DROP POLICY IF EXISTS "Public can view kyc" ON storage.objects;
CREATE POLICY "Public can view kyc"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents');

-- 6. Status Sync Trigger
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
        kyc_verified = (NEW.status = 'Approved'),
        kyc_rejected_reason = CASE WHEN NEW.status = 'Rejected' THEN NEW.rejection_reason ELSE NULL END,
        updated_at = now()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc_documents;
CREATE TRIGGER tr_sync_kyc_status
AFTER INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION sync_kyc_status_to_profile();

-- Force reload
NOTIFY pgrst, 'reload schema';
