-- Add aadhaar_back_file_url to kyc_documents
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_file_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN aadhaar_back_file_url TEXT;
    END IF;
END $$;
