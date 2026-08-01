-- ============================================================
-- FIX AADHAAR BACK COLUMN & CACHE RELOAD
-- ============================================================

-- 1. Ensure the column exists with the correct name
DO $$
BEGIN
    -- If the column exists with the old name, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_file_url') THEN
        ALTER TABLE public.kyc_documents RENAME COLUMN aadhaar_back_file_url TO aadhaar_back_url;
    END IF;

    -- If the column doesn't exist at all, create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='aadhaar_back_url') THEN
        ALTER TABLE public.kyc_documents ADD COLUMN aadhaar_back_url TEXT;
    END IF;
END $$;

-- 2. Force PostgREST to reload the schema cache
-- This is the critical step for "schema cache" errors
NOTIFY pgrst, 'reload schema';

-- Optional: If the user has a custom RPC to reload cache, call it
-- SELECT reload_postgrest_cache();
