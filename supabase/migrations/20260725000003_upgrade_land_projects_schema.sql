-- ============================================================
-- UPGRADE LAND PROJECTS SCHEMA
-- ============================================================

DO $$
BEGIN
    -- General Info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='project_code') THEN
        ALTER TABLE public.land_projects ADD COLUMN project_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='short_description') THEN
        ALTER TABLE public.land_projects ADD COLUMN short_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='pincode') THEN
        ALTER TABLE public.land_projects ADD COLUMN pincode TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='country') THEN
        ALTER TABLE public.land_projects ADD COLUMN country TEXT DEFAULT 'India';
    END IF;

    -- Investment Info
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

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='available_units') THEN
        ALTER TABLE public.land_projects ADD COLUMN available_units INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='total_units') THEN
        ALTER TABLE public.land_projects ADD COLUMN total_units INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='investment_status') THEN
        ALTER TABLE public.land_projects ADD COLUMN investment_status TEXT DEFAULT 'Active' CHECK (investment_status IN ('Upcoming', 'Active', 'Funded', 'Completed', 'Sold Out'));
    END IF;

    -- Extra Features
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='featured') THEN
        ALTER TABLE public.land_projects ADD COLUMN featured BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='rating') THEN
        ALTER TABLE public.land_projects ADD COLUMN rating NUMERIC(2,1) DEFAULT 5.0;
    END IF;

    -- Media
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='cover_image') THEN
        ALTER TABLE public.land_projects ADD COLUMN cover_image TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='gallery_images') THEN
        ALTER TABLE public.land_projects ADD COLUMN gallery_images TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='video_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN video_url TEXT;
    END IF;

    -- Documents
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

    -- Location Mapping
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='latitude') THEN
        ALTER TABLE public.land_projects ADD COLUMN latitude NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='longitude') THEN
        ALTER TABLE public.land_projects ADD COLUMN longitude NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='land_projects' AND column_name='google_map_url') THEN
        ALTER TABLE public.land_projects ADD COLUMN google_map_url TEXT;
    END IF;

END $$;

-- ============================================================
-- STORAGE SETUP
-- ============================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-media', 'project-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- PUBLIC SELECT
CREATE POLICY "Public Access Media" ON storage.objects FOR SELECT USING (bucket_id = 'project-media');
CREATE POLICY "Public Access Docs" ON storage.objects FOR SELECT USING (bucket_id = 'project-documents');

-- ADMIN ALL
CREATE POLICY "Admin All Media" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-media' AND
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')))
);

CREATE POLICY "Admin All Docs" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')))
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Public can view Active/Upcoming projects
DROP POLICY IF EXISTS "Anyone can view active projects" ON public.land_projects;
CREATE POLICY "Anyone can view active projects" ON public.land_projects
  FOR SELECT USING (is_active = true OR investment_status IN ('Active', 'Upcoming'));

-- Admin full management
DROP POLICY IF EXISTS "Admins can manage projects" ON public.land_projects;
CREATE POLICY "Admins can manage projects" ON public.land_projects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')));

NOTIFY pgrst, 'reload schema';
