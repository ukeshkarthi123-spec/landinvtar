-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Clear existing policies to avoid duplicates
DROP POLICY IF EXISTS "Allow users to upload their own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to read all KYC" ON storage.objects;

-- 3. Storage Policies

-- Policy: Authenticated users can upload their own files
CREATE POLICY "Allow users to upload their own KYC"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Project Images Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read of project images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

CREATE POLICY "Allow admins to manage project images"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);

-- Policy: Users can read their own files
CREATE POLICY "Allow users to read their own KYC"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Project Images Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read of project images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

CREATE POLICY "Allow admins to manage project images"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);

-- Policy: Users can update their own files
CREATE POLICY "Allow users to update their own KYC"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Project Images Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read of project images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

CREATE POLICY "Allow admins to manage project images"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);

-- Policy: Users can delete their own files
CREATE POLICY "Allow users to delete their own KYC"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Project Images Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read of project images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

CREATE POLICY "Allow admins to manage project images"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);

-- Policy: Admins can read all files
CREATE POLICY "Allow admins to read all KYC"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);

-- 4. Project Images Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read of project images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

CREATE POLICY "Allow admins to manage project images"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'project-images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);
