-- ============================================================
-- DEFINITIVE KYC SCHEMA UNIFICATION
-- ============================================================

-- 1. Standardize kyc_documents table
CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    pan_number TEXT,
    aadhaar_number TEXT,
    pan_url TEXT,
    aadhaar_front_url TEXT,
    aadhaar_back_url TEXT,
    selfie_url TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'approved')),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Column Consistency Check & Add Missing
DO $$
BEGIN
    -- Core identity & Numbers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='full_name') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN full_name TEXT;
    END IF;

    -- URL Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='pan_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN pan_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_front_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN aadhaar_front_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN aadhaar_back_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN selfie_url TEXT;
    END IF;

    -- Review Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_by') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_at') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;

    -- Handle potential legacy name collisions / migrations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='pan_file_url') THEN
        UPDATE public.kyc_documents SET pan_url = pan_file_url WHERE pan_url IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_file_url') THEN
        UPDATE public.kyc_documents SET aadhaar_front_url = aadhaar_file_url WHERE aadhaar_front_url IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_file_url') THEN
        UPDATE public.kyc_documents SET aadhaar_back_url = aadhaar_back_file_url WHERE aadhaar_back_url IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='selfie_file_url') THEN
        UPDATE public.kyc_documents SET selfie_url = selfie_file_url WHERE selfie_url IS NULL;
    END IF;
END $$;

-- 3. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Unified Sync Trigger (Profiles update)
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        kyc_status = CASE
            WHEN NEW.status IN ('Approved', 'approved') THEN 'approved'
            WHEN NEW.status = 'Pending' THEN 'Pending'
            WHEN NEW.status = 'Rejected' THEN 'Rejected'
            ELSE 'Not Started'
        END,
        is_kyc_verified = (NEW.status IN ('Approved', 'approved')),
        kyc_verified = (NEW.status IN ('Approved', 'approved')), -- Legacy sync
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

-- 5. Final cache reload
NOTIFY pgrst, 'reload schema';
