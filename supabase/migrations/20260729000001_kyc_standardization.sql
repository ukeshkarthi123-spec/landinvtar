-- ============================================================
-- KYC STANDARDIZATION MIGRATION
-- Aligns with the new single source of truth requirements
-- ============================================================

DO $$
BEGIN
    -- 1. Ensure is_kyc_verified exists and is synced from kyc_verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_kyc_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN is_kyc_verified BOOLEAN DEFAULT false;
    END IF;

    -- Sync data if column was just created
    UPDATE public.profiles SET is_kyc_verified = kyc_verified WHERE is_kyc_verified IS FALSE AND kyc_verified IS TRUE;

    -- 2. Update kyc_status to use lowercase 'approved' for consistency with prompt
    -- We'll keep 'Verified' as a synonym in the CHECK constraint if it exists, or just update data
    UPDATE public.profiles SET kyc_status = 'approved' WHERE kyc_status = 'Verified';
END $$;

-- 3. Update the sync trigger to use the new standard
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        kyc_status = CASE
            WHEN NEW.status = 'Approved' THEN 'approved'
            WHEN NEW.status = 'Pending' THEN 'Pending'
            WHEN NEW.status = 'Rejected' THEN 'Rejected'
            ELSE 'Not Started'
        END,
        is_kyc_verified = (NEW.status = 'Approved'),
        kyc_verified = (NEW.status = 'Approved'), -- Keep legacy for safety
        kyc_rejected_reason = CASE WHEN NEW.status = 'Rejected' THEN NEW.rejection_reason ELSE NULL END,
        updated_at = now()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure check constraint allows 'approved'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_kyc_status_check
    CHECK (kyc_status IN ('Not Started', 'Pending', 'Verified', 'approved', 'Rejected'));

-- Force reload
NOTIFY pgrst, 'reload schema';
