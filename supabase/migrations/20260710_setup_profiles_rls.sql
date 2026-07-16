-- ====================================================================
-- PROFILES TABLE SETUP & ROW LEVEL SECURITY (RLS)
-- ====================================================================
-- Run these SQL queries in your Supabase dashboard to ensure the
-- profiles table and RLS policies are correctly configured.

-- 1. DROP existing table and policies (if needed)
-- ⚠️  CAUTION: This will delete all profile data!
-- DROP TABLE IF EXISTS profiles CASCADE;

-- 2. CREATE profiles table with proper schema
CREATE TABLE IF NOT EXISTS profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text DEFAULT '',
  avatar text DEFAULT '',
  kyc_status text NOT NULL DEFAULT 'Not Started' CHECK (kyc_status IN ('Not Started', 'Pending', 'Verified')),
  wallet_balance numeric NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- Policy 1: Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can view all profiles (for display purposes)
-- Comment out if you want profiles to be private
DROP POLICY IF EXISTS "Users can view any profile" ON profiles;
CREATE POLICY "Users can view any profile"
  ON profiles
  FOR SELECT
  USING (true);

-- Policy 3: Users can insert their own profile (auto-create)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 5: Admins can update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (true);

-- 5. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- 6. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profiles_updated ON profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================
-- Run these queries to verify your setup is correct:

-- Check if table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'profiles';

-- Check if RLS is enabled
SELECT relname, relrowsecurity FROM pg_class 
WHERE relname = 'profiles';

-- List all RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check columns and constraints
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- ====================================================================
-- TESTING THE SETUP
-- ====================================================================

-- Test 1: Insert a new profile
INSERT INTO profiles (id, email, name, kyc_status, wallet_balance)
VALUES (
  auth.uid(),
  'test@example.com',
  'Test User',
  'Not Started',
  1000
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  updated_at = now();

-- Test 2: Select profile for current user
SELECT id, name, email, kyc_status, wallet_balance, created_at
FROM profiles
WHERE id = auth.uid();

-- Test 3: Check if all policies are working
-- (Run these as different users to test)
SELECT COUNT(*) as profile_count FROM profiles;

-- ====================================================================
-- TROUBLESHOOTING
-- ====================================================================

-- If you get "permission denied" errors:
-- 1. Verify RLS is enabled: SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles';
-- 2. Check policies exist: SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
-- 3. Verify user is authenticated in your app

-- If profiles aren't being created automatically:
-- 1. Check the auth user exists: SELECT id, email FROM auth.users WHERE id = '<user-id>';
-- 2. Check app is calling autoCreateProfile function
-- 3. Verify the insert policy allows it

-- If queries are slow:
-- 1. Check indexes exist: SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'profiles';
-- 2. Add more indexes if needed (see indexes section above)
-- 3. Analyze query performance with EXPLAIN ANALYZE

-- Common errors and solutions:

-- Error: "new row violates row-level security policy"
-- Solution: Check that id = auth.uid() in your INSERT/UPDATE queries

-- Error: "permission denied for table profiles"
-- Solution: Enable RLS and create proper policies

-- Error: "profiles table does not exist"
-- Solution: Run the CREATE TABLE statement above

-- Error: "column 'id' does not exist"
-- Solution: Ensure table has 'id' column as PRIMARY KEY REFERENCES auth.users(id)
