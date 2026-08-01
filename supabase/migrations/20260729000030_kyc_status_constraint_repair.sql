-- ============================================================
-- REPAIR KYC STATUS CONSTRAINTS (Case Insensitivity)
-- ============================================================

-- 1. Repair kyc_documents table constraint
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_status_check;
ALTER TABLE public.kyc_documents ADD CONSTRAINT kyc_documents_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'));

-- 2. Repair profiles table constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_kyc_status_check
    CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected', 'Not Started', 'Pending', 'Verified', 'Approved', 'Rejected'));

-- 3. Standardize trigger to handle all variants
CREATE OR REPLACE FUNCTION public.sync_kyc_final_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync status to profile in standardized lowercase
    UPDATE public.profiles
    SET
        kyc_status = CASE
            WHEN NEW.status IN ('approved', 'Approved', 'Verified') THEN 'approved'
            WHEN NEW.status IN ('pending', 'Pending') THEN 'pending'
            WHEN NEW.status IN ('rejected', 'Rejected') THEN 'rejected'
            ELSE 'not_started'
        END,
        is_kyc_verified = (NEW.status IN ('approved', 'Approved', 'Verified')),
        updated_at = now()
    WHERE id = NEW.user_id;

    -- Send notification on decision change
    IF (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        IF NEW.status IN ('approved', 'Approved', 'Verified') THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (NEW.user_id, 'KYC Verified', 'Your identity verification is successful. You can now start investing!', 'success');
        ELSIF NEW.status IN ('rejected', 'Rejected') THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (NEW.user_id, 'KYC Rejected', COALESCE(NEW.rejection_reason, 'Information mismatch. Please re-submit.'), 'warning');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reload PostgREST metadata cache
NOTIFY pgrst, 'reload schema';
