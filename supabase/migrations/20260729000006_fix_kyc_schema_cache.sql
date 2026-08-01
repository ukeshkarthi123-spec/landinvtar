-- ============================================================
-- FIX KYC SCHEMA CACHE & ENSURE REVIEW COLUMNS
-- ============================================================

-- 1. Ensure columns reviewed_by and reviewed_at exist in kyc_documents
DO $$
BEGIN
    -- Add reviewed_by column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_by') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id);
    END IF;

    -- Add reviewed_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_at') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Force PostgREST to reload the schema cache
-- This is critical when you get "Could not find column ... in the schema cache"
NOTIFY pgrst, 'reload schema';

-- 3. Standardize sync trigger to handle notifications properly
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync core profile fields
    UPDATE public.profiles
    SET
        kyc_status = CASE
            WHEN NEW.status IN ('Approved', 'approved') THEN 'approved'
            WHEN NEW.status = 'Pending' THEN 'Pending'
            WHEN NEW.status = 'Rejected' THEN 'Rejected'
            ELSE 'Not Started'
        END,
        is_kyc_verified = (NEW.status IN ('Approved', 'approved')),
        kyc_verified = (NEW.status IN ('Approved', 'approved')),
        kyc_rejected_reason = CASE WHEN NEW.status = 'Rejected' THEN NEW.rejection_reason ELSE NULL END,
        updated_at = now()
    WHERE id = NEW.user_id;

    -- Create notification on transition
    IF (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        IF NEW.status IN ('Approved', 'approved') THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (NEW.user_id, 'KYC Verified', 'Your identity verification is successful. You can now start investing!', 'success');
        ELSIF NEW.status = 'Rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (NEW.user_id, 'KYC Rejected', COALESCE(NEW.rejection_reason, 'Information mismatch. Please re-submit.'), 'warning');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc_documents;
CREATE TRIGGER tr_sync_kyc_status
AFTER INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION sync_kyc_status_to_profile();
