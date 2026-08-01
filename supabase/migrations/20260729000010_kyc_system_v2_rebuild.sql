-- ============================================================
-- KYC SYSTEM V2: TOTAL REBUILD
-- ============================================================

-- 1. Drop existing KYC-related objects to start fresh
DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc_documents;
DROP FUNCTION IF EXISTS public.sync_kyc_status_to_profile();
DROP TABLE IF EXISTS public.kyc_documents;

-- 2. Create standardized kyc_documents table
CREATE TABLE public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    pan_number TEXT NOT NULL,
    aadhaar_number TEXT NOT NULL,
    selfie_url TEXT NOT NULL,
    pan_image_url TEXT NOT NULL,
    aadhaar_front_url TEXT NOT NULL,
    aadhaar_back_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Clean and Standardize Profiles Table
DO $$
BEGIN
    -- Ensure status column is clean
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_kyc_status_check
        CHECK (kyc_status IN ('Not Started', 'pending', 'approved', 'rejected'));

    -- Ensure boolean columns exist for easy querying
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_kyc_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN is_kyc_verified BOOLEAN DEFAULT false;
    END IF;

    -- Sync existing data to 'pending'/'approved' if needed
    UPDATE public.profiles SET kyc_status = 'approved' WHERE kyc_status = 'Verified';
    UPDATE public.profiles SET is_kyc_verified = true WHERE kyc_status = 'approved';
END $$;

-- 4. Storage Configuration
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-v2', 'kyc-v2', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Row Level Security
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own KYC
CREATE POLICY "Users can manage own KYC"
ON public.kyc_documents FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all KYC
CREATE POLICY "Admins can view all KYC"
ON public.kyc_documents FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
    )
);

-- Policy: Admins can update all KYC (for approval/rejection)
CREATE POLICY "Admins can update all KYC"
ON public.kyc_documents FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
    )
);

-- 6. Storage Policies
CREATE POLICY "Public Read KYC" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-v2');
CREATE POLICY "Authenticated Upload KYC" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kyc-v2');

-- 7. Automated Profile Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_kyc_v2_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        kyc_status = NEW.status,
        is_kyc_verified = (NEW.status = 'approved'),
        updated_at = now()
    WHERE id = NEW.user_id;

    -- Create In-App Notification
    IF (OLD.status IS NULL OR OLD.status != NEW.status) THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            NEW.user_id,
            CASE WHEN NEW.status = 'approved' THEN 'KYC Verified' ELSE 'KYC Update' END,
            CASE
                WHEN NEW.status = 'approved' THEN 'Success! Your identity has been verified. You can now start investing.'
                WHEN NEW.status = 'rejected' THEN 'Your KYC was rejected: ' || COALESCE(NEW.rejection_reason, 'Information mismatch.')
                ELSE 'Your KYC is under review.'
            END,
            CASE WHEN NEW.status = 'approved' THEN 'success' WHEN NEW.status = 'rejected' THEN 'warning' ELSE 'info' END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_sync_kyc_v2
AFTER INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_kyc_v2_to_profile();

-- 8. Force PostgREST cache reload
NOTIFY pgrst, 'reload schema';
