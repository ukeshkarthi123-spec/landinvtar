-- ENSURE ALL REQUIRED COLUMNS FOR LAND PROJECTS EXIST
-- This fixes the "rating column not found" and other schema cache errors.

DO $$
BEGIN
    -- 1. Essential Missing Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='rating') THEN
        ALTER TABLE public.land_projects ADD COLUMN rating NUMERIC(3,2) DEFAULT 5.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='featured') THEN
        ALTER TABLE public.land_projects ADD COLUMN featured BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='project_code') THEN
        ALTER TABLE public.land_projects ADD COLUMN project_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='short_description') THEN
        ALTER TABLE public.land_projects ADD COLUMN short_description TEXT;
    END IF;

    -- 2. Investment Parameters (New set)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='investment_status') THEN
        ALTER TABLE public.land_projects ADD COLUMN investment_status TEXT DEFAULT 'Active' CHECK (investment_status IN ('Upcoming', 'Active', 'Funded', 'Completed', 'Sold Out'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='minimum_investment') THEN
        ALTER TABLE public.land_projects ADD COLUMN minimum_investment NUMERIC DEFAULT 500;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='maximum_investment') THEN
        ALTER TABLE public.land_projects ADD COLUMN maximum_investment NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='target_return') THEN
        ALTER TABLE public.land_projects ADD COLUMN target_return NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='duration') THEN
        ALTER TABLE public.land_projects ADD COLUMN duration TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='funding_goal') THEN
        ALTER TABLE public.land_projects ADD COLUMN funding_goal NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='raised_amount') THEN
        ALTER TABLE public.land_projects ADD COLUMN raised_amount NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='total_units') THEN
        ALTER TABLE public.land_projects ADD COLUMN total_units INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='available_units') THEN
        ALTER TABLE public.land_projects ADD COLUMN available_units INTEGER DEFAULT 0;
    END IF;

    -- 3. Geographical & Contact
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='pincode') THEN
        ALTER TABLE public.land_projects ADD COLUMN pincode TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='country') THEN
        ALTER TABLE public.land_projects ADD COLUMN country TEXT DEFAULT 'India';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='latitude') THEN
        ALTER TABLE public.land_projects ADD COLUMN latitude NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='longitude') THEN
        ALTER TABLE public.land_projects ADD COLUMN longitude NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='google_map_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN google_map_url TEXT;
    END IF;

    -- 4. Media & Docs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='cover_image') THEN
        ALTER TABLE public.land_projects ADD COLUMN cover_image TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='gallery_images') THEN
        ALTER TABLE public.land_projects ADD COLUMN gallery_images TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='video_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN video_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='brochure_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN brochure_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='legal_document_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN legal_document_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='dtcp_certificate_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN dtcp_certificate_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='rera_certificate_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN rera_certificate_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='sale_deed_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN sale_deed_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='master_plan_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN master_plan_url TEXT;
    END IF;

END $$;

-- FORCE SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
