-- ============================================================
-- DECISIVE KYC STATUS CONSTRAINT & SYNC FIX
-- ============================================================

-- 1. Standardize Profiles Table
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_kyc_status_check
    CHECK (kyc_status IN ('Not Started', 'Pending', 'Verified', 'approved', 'Rejected'));

-- 2. Update existing data to the new standard ('approved')
UPDATE public.profiles SET kyc_status = 'approved' WHERE kyc_status = 'Verified';
UPDATE public.profiles SET kyc_verified = true, is_kyc_verified = true WHERE kyc_status = 'approved';

-- 3. Standardize KYC Documents Table status constraint
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_status_check;
ALTER TABLE public.kyc_documents ADD CONSTRAINT kyc_documents_status_check
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'approved'));

-- 4. Update the Trigger Function for Instant Sync
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Force lowercase 'approved' in profiles
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

    -- Instant notification on approval or rejection
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

-- 5. Force PostgREST cache reload
NOTIFY pgrst, 'reload schema';
