-- ==========================================
-- ROBUST KYC SYNC & PROFILE ENHANCEMENT
-- ==========================================

-- 1. Add kyc_verified boolean to profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='kyc_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN kyc_verified BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='kyc_rejected_reason') THEN
        ALTER TABLE public.profiles ADD COLUMN kyc_rejected_reason TEXT;
    END IF;
END $$;

-- 2. Improved Trigger Function to Sync KYC status with Notifications
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- Update Profile
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

    -- Create Notification for user if status changed to Approved or Rejected
    IF (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        IF NEW.status = 'Approved' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                NEW.user_id,
                'KYC Verified!',
                'Your KYC documents have been successfully verified. You can now start investing!',
                'success'
            );
        ELSIF NEW.status = 'Rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                NEW.user_id,
                'KYC Rejected',
                COALESCE(NEW.rejection_reason, 'There was an issue with your KYC documents. Please re-submit.'),
                'warning'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure trigger is attached
DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc_documents;
CREATE TRIGGER tr_sync_kyc_status
AFTER INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION sync_kyc_status_to_profile();

-- 4. Initial Sync for existing Verified users
UPDATE public.profiles
SET kyc_verified = true
WHERE kyc_status = 'Verified';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
