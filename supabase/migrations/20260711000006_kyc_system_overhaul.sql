-- ==========================================
-- KYC SYSTEM OVERHAUL
-- ==========================================

-- 1. Ensure foreign key to profiles instead of auth.users for PostgREST joins
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_fkey;
ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Trigger to automatically update profiles.kyc_status
CREATE OR REPLACE FUNCTION sync_kyc_status_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    kyc_status = CASE
      WHEN NEW.status = 'Approved' THEN 'Verified'
      WHEN NEW.status = 'Pending' THEN 'Pending'
      ELSE 'Not Started'
    END,
    updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_kyc_document_sync ON public.kyc_documents;
CREATE TRIGGER on_kyc_document_sync
  AFTER INSERT OR UPDATE OF status ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION sync_kyc_status_to_profile();

-- 3. SETUP STORAGE FOR KYC DOCUMENTS
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false) -- Private bucket for security
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Users can upload own KYC" ON storage.objects;
CREATE POLICY "Users can upload own KYC" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can view own KYC" ON storage.objects;
CREATE POLICY "Users can view own KYC" ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Admins can view all KYC" ON storage.objects;
CREATE POLICY "Admins can view all KYC" ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
);

-- 4. FIX RLS FOR KYC DOCUMENTS
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all KYC" ON public.kyc_documents;
CREATE POLICY "Admins can manage all KYC" ON public.kyc_documents FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
);
