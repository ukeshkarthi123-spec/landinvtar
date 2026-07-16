-- ==========================================
-- FINAL ADMIN AUTH & PROFILE SYNC FIX
-- ==========================================

-- 1. Ensure profiles table has all necessary columns
DO $$
BEGIN
  -- Add role column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'support', 'user'));
  END IF;

  -- Add is_admin column if it somehow doesn't exist (should exist from previous migrations)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Update existing admin if present
UPDATE public.profiles
SET role = 'admin', is_admin = true
WHERE LOWER(email) = 'admin24@gmail.com';

-- 3. Optimized Profile Sync Function
-- This function handles the automatic creation of a profile record
-- when a user signs up via any method (email, phone, OAuth).
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, row_security = off
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_avatar text;
  v_role text := 'user';
  v_is_admin boolean := false;
BEGIN
  v_email := LOWER(COALESCE(NEW.email, ''));
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');

  -- Extract name from metadata with multiple fallbacks
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(split_part(v_email, '@', 1), ''),
    NULLIF(v_phone, ''),
    'User'
  );

  v_avatar := upper(left(v_name, 2));

  -- AUTO-PROMOTE ADMIN ACCOUNT
  IF v_email = 'admin24@gmail.com' THEN
    v_role := 'admin';
    v_is_admin := true;
  END IF;

  INSERT INTO public.profiles (
    id,
    name,
    email,
    phone,
    avatar,
    kyc_status,
    wallet_balance,
    role,
    is_admin,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_name,
    v_email,
    v_phone,
    v_avatar,
    'Not Started',
    0,
    v_role,
    v_is_admin,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE
      -- Only upgrade to admin, never downgrade via this trigger
      WHEN profiles.role = 'user' AND EXCLUDED.role != 'user' THEN EXCLUDED.role
      ELSE profiles.role
    END,
    is_admin = CASE
      WHEN profiles.is_admin = false AND EXCLUDED.is_admin = true THEN true
      ELSE profiles.is_admin
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 4. Re-bind the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_on_signup();

-- 5. Hardened RLS Policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own profile (Critical for app initialization)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Authenticated users can view all profiles (Needed for social features/transfers)
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
CREATE POLICY "Users can view any profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Policy 3: Users can insert their own profile (Fallback for JIT recovery in frontend)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users can update their own non-sensitive fields
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 5: Admins can manage all profiles (Full access)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
    )
  );

-- 6. Retroactively sync missing profiles for existing auth.users
-- This handles the case where users were created before the trigger was fixed.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) LOOP
    INSERT INTO public.profiles (id, name, email, role, is_admin, kyc_status, wallet_balance, created_at, updated_at)
    VALUES (
      r.id,
      COALESCE(r.raw_user_meta_data->>'name', r.raw_user_meta_data->>'full_name', split_part(r.email, '@', 1), 'User'),
      LOWER(r.email),
      CASE WHEN LOWER(r.email) = 'admin24@gmail.com' THEN 'admin' ELSE 'user' END,
      CASE WHEN LOWER(r.email) = 'admin24@gmail.com' THEN true ELSE false END,
      'Not Started',
      0,
      r.created_at,
      r.created_at
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
