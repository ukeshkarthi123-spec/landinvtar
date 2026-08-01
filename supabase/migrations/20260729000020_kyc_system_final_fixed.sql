-- ============================================================
-- FINAL KYC SYSTEM REBUILD
-- ============================================================

-- 1. Drop existing KYC objects to start with a clean slate
DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc_documents;
DROP TRIGGER IF EXISTS tr_sync_kyc_v2 ON public.kyc_documents;
DROP FUNCTION IF EXISTS public.sync_kyc_status_to_profile();
DROP FUNCTION IF EXISTS public.sync_kyc_v2_to_profile();
DROP TABLE IF EXISTS public.kyc_documents;

-- 2. Create the unified kyc_documents table
CREATE TABLE public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    pan_number TEXT NOT NULL,
    aadhaar_number TEXT NOT NULL,
    pan_image TEXT NOT NULL,       -- URL to PAN image
    aadhaar_front TEXT NOT NULL,   -- URL to Aadhaar Front
    aadhaar_back TEXT NOT NULL,    -- URL to Aadhaar Back
    selfie TEXT NOT NULL,          -- URL to Selfie
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Standardize Profiles Table status values
DO $$
BEGIN
    -- Update constraint to only allow the requested values
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_kyc_status_check
        CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected'));

    -- Reset existing statuses to match new lowercase standard
    UPDATE public.profiles SET kyc_status = 'approved' WHERE kyc_status IN ('Verified', 'approved');
    UPDATE public.profiles SET kyc_status = 'pending' WHERE kyc_status IN ('Pending', 'pending');
    UPDATE public.profiles SET kyc_status = 'rejected' WHERE kyc_status IN ('Rejected', 'rejected');
    UPDATE public.profiles SET kyc_status = 'not_started' WHERE kyc_status NOT IN ('approved', 'pending', 'rejected');

    -- Ensure kyc_verified boolean exists and is synced
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_kyc_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN is_kyc_verified BOOLEAN DEFAULT false;
    END IF;
    UPDATE public.profiles SET is_kyc_verified = (kyc_status = 'approved');
END $$;

-- 4. Unified Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-final', 'kyc-final', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Row Level Security for Table
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own KYC record
CREATE POLICY "kyc_user_policy" ON public.kyc_documents
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view and review all KYC records
CREATE POLICY "kyc_admin_policy" ON public.kyc_documents
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
        )
    );

-- 6. Storage Policies
CREATE POLICY "kyc_storage_read" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-final');
CREATE POLICY "kyc_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kyc-final');

-- 7. Profile Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_kyc_final_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        kyc_status = NEW.status,
        is_kyc_verified = (NEW.status = 'approved'),
        updated_at = now()
    WHERE id = NEW.user_id;

    -- Send notification on decision
    IF (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            NEW.user_id,
            CASE WHEN NEW.status = 'approved' THEN 'KYC Verified' ELSE 'KYC Update' END,
            CASE
                WHEN NEW.status = 'approved' THEN 'Congratulations! Your identity has been verified. You can now start investing.'
                WHEN NEW.status = 'rejected' THEN 'Your KYC submission was rejected: ' || COALESCE(NEW.rejection_reason, 'Please check your documents.')
                ELSE 'Your KYC documents are currently under review.'
            END,
            CASE WHEN NEW.status = 'approved' THEN 'success' WHEN NEW.status = 'rejected' THEN 'warning' ELSE 'info' END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_sync_kyc_final
AFTER INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_kyc_final_to_profile();

-- 8. Force schema reload
NOTIFY pgrst, 'reload schema';
