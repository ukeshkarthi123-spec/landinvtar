-- ============================================================
-- FINAL KYC SCHEMA SYNCHRONIZATION
-- This migration ensures the database matches all code usages
-- ============================================================

-- 1. Table Consistency
CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    pan_number TEXT,
    aadhaar_number TEXT,
    mobile_number TEXT,
    pan_url TEXT,
    aadhaar_front_url TEXT,
    aadhaar_back_url TEXT,
    selfie_url TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'approved')),
    rejection_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Column Audit & Fix
DO $$
BEGIN
    -- Ensure mobile_number exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='mobile_number') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN mobile_number TEXT;
    END IF;

    -- Ensure reviewed_at exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_at') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;

    -- Ensure submitted_at exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='submitted_at') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT now();
        UPDATE public.kyc_documents SET submitted_at = created_at WHERE submitted_at IS NULL;
    END IF;

    -- Standardize URL column names if they still use legacy '_file_url'
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

END $$;

-- 3. Trigger Maintenance
-- Ensure the profile sync trigger uses the latest column names
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        kyc_status = CASE
            WHEN NEW.status = 'Approved' THEN 'approved'
            WHEN NEW.status = 'approved' THEN 'approved'
            WHEN NEW.status = 'Pending' THEN 'Pending'
            WHEN NEW.status = 'Rejected' THEN 'Rejected'
            ELSE 'Not Started'
        END,
        is_kyc_verified = (NEW.status IN ('Approved', 'approved')),
        kyc_verified = (NEW.status IN ('Approved', 'approved')),
        kyc_rejected_reason = CASE WHEN NEW.status = 'Rejected' THEN NEW.rejection_reason ELSE NULL END,
        updated_at = now()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
