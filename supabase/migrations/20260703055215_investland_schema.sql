/*
# InvestLand Complete Database Schema

## Overview
Full schema for the InvestLand fractional land investment platform.

## New Tables

### 1. profiles
Extends auth.users with app-specific user data.
- id (uuid): matches auth.users.id — the primary key
- name (text): display name
- email (text): user's email address
- phone (text): optional phone number
- avatar (text): 2-letter initials string used as avatar
- kyc_status (text): KYC verification state — 'Not Started', 'Pending', 'Verified'
- wallet_balance (numeric): current INR wallet balance, default ₹10,000 for demo
- created_at / updated_at timestamps

### 2. land_projects
All available investment projects (read-only from client, seeded by admin).
- id (uuid): primary key
- name, location, state, city, image (text): project identifiers
- images (text[]): array of image URLs for gallery
- total_area (text): e.g. "12.5 Acres"
- min_investment (numeric): minimum investment in INR
- expected_roi (numeric): annual ROI percentage
- funding_progress (numeric): 0-100 percent funded
- total_funding / raised_funding (numeric): funding amounts in INR
- investors_count (integer): number of investors
- risk_score (text): 'Low', 'Medium', 'High'
- category (text): 'Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'
- is_govt_approved / is_verified (boolean): badges
- timeline (text): e.g. "3 Years"
- description (text): project description
- highlights (text[]): key selling points
- amenities (jsonb): nearby amenities array
- documents (jsonb): legal documents array
- lat / lng (numeric): coordinates
- appreciation_rate (numeric): expected appreciation percentage
- is_active (boolean): controls visibility

### 3. investments
User investments in land projects.
- id (uuid): primary key
- user_id (uuid): references auth.users, defaults to auth.uid()
- project_id (uuid): references land_projects
- amount (numeric): invested amount in INR
- roi_rate (numeric): project ROI at time of investment (for computing current value)
- status (text): 'Active', 'Exited', 'Pending'
- created_at / updated_at timestamps

### 4. wallet_transactions
Full credit/debit history for each user's wallet.
- id (uuid): primary key
- user_id (uuid): references auth.users, defaults to auth.uid()
- type (text): 'credit' or 'debit'
- description (text): human-readable description
- amount (numeric): INR amount
- status (text): 'Completed', 'Pending', 'Failed'
- reference_id (uuid): optional link to investment record
- created_at timestamp

### 5. notifications
User notifications created by server-side functions.
- id (uuid): primary key
- user_id (uuid): references auth.users
- title (text): notification heading
- message (text): notification body
- type (text): 'success', 'info', 'warning'
- is_read (boolean): whether user has read it
- created_at timestamp

## Security Model
- profiles: owner-scoped — users SELECT/UPDATE their own row only
- land_projects: public read (anon + authenticated), no client writes
- investments: owner-scoped (authenticated only, DEFAULT auth.uid())
- wallet_transactions: owner-scoped (authenticated only, DEFAULT auth.uid())
- notifications: owner-scoped SELECT + UPDATE (to mark read), INSERT via SECURITY DEFINER functions only

## Server Functions (SECURITY DEFINER — bypass RLS for atomic operations)
- create_profile_on_signup(): trigger that creates profile row on auth.users INSERT
- invest_in_project(p_project_id, p_amount): atomic invest: deduct wallet, create investment + transaction + notification
- add_wallet_money(p_amount, p_method): credit wallet + create transaction record
- withdraw_wallet_money(p_amount): debit wallet + create transaction record
- mark_all_notifications_read(): marks all user notifications as read

## Seed Data
6 realistic Indian land investment projects pre-seeded.
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT '',
  kyc_status text NOT NULL DEFAULT 'Verified'
    CHECK (kyc_status IN ('Not Started', 'Pending', 'Verified')),
  wallet_balance numeric NOT NULL DEFAULT 10000 CHECK (wallet_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, row_security = off
AS $$
DECLARE
  v_name text;
  v_avatar text;
  v_email text;
  v_phone text;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NULLIF(split_part(v_email, '@', 1), ''),
    NULLIF(v_phone, ''),
    'User'
  );
  v_avatar := upper(left(COALESCE(v_name, 'U'), 2));

  INSERT INTO public.profiles (id, name, email, phone, avatar, kyc_status, wallet_balance)
  VALUES (
    NEW.id,
    v_name,
    v_email,
    v_phone,
    v_avatar,
    'Verified',
    10000
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_on_signup();

-- ============================================================
-- LAND PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS land_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  state text NOT NULL,
  city text NOT NULL,
  image text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  total_area text NOT NULL DEFAULT '',
  min_investment numeric NOT NULL DEFAULT 500,
  expected_roi numeric NOT NULL DEFAULT 0,
  funding_progress numeric NOT NULL DEFAULT 0 CHECK (funding_progress BETWEEN 0 AND 100),
  total_funding numeric NOT NULL DEFAULT 0,
  raised_funding numeric NOT NULL DEFAULT 0,
  investors_count integer NOT NULL DEFAULT 0,
  risk_score text NOT NULL DEFAULT 'Low' CHECK (risk_score IN ('Low', 'Medium', 'High')),
  category text NOT NULL DEFAULT 'Residential'
    CHECK (category IN ('Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas')),
  is_govt_approved boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  timeline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  highlights text[] NOT NULL DEFAULT '{}',
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  lat numeric,
  lng numeric,
  appreciation_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE land_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_projects" ON land_projects;
CREATE POLICY "public_read_projects" ON land_projects
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- ============================================================
-- INVESTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES land_projects(id),
  amount numeric NOT NULL CHECK (amount > 0),
  roi_rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Exited', 'Pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_investments" ON investments;
CREATE POLICY "select_own_investments" ON investments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_investments" ON investments;
CREATE POLICY "insert_own_investments" ON investments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- WALLET TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Failed')),
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON wallet_transactions;
CREATE POLICY "select_own_transactions" ON wallet_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON wallet_transactions;
CREATE POLICY "insert_own_transactions" ON wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('success', 'info', 'warning')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SERVER FUNCTION: invest_in_project
-- Atomically deducts wallet balance, creates investment record,
-- wallet transaction, and notification.
-- ============================================================
CREATE OR REPLACE FUNCTION public.invest_in_project(
  p_project_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_balance numeric;
  v_project land_projects%ROWTYPE;
  v_investment_id uuid;
  v_new_balance numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock and get wallet balance
  SELECT wallet_balance INTO v_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, Required: %', v_balance, p_amount;
  END IF;

  -- Get project details
  SELECT * INTO v_project
  FROM land_projects
  WHERE id = p_project_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or inactive';
  END IF;

  IF p_amount < v_project.min_investment THEN
    RAISE EXCEPTION 'Amount % is below minimum investment of %', p_amount, v_project.min_investment;
  END IF;

  -- Deduct wallet balance
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Create investment record
  INSERT INTO investments (user_id, project_id, amount, roi_rate, status)
  VALUES (v_user_id, p_project_id, p_amount, v_project.expected_roi, 'Active')
  RETURNING id INTO v_investment_id;

  -- Create wallet debit transaction
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (v_user_id, 'debit', 'Invested in ' || v_project.name, p_amount, 'Completed', v_investment_id);

  -- Update project funding stats
  UPDATE land_projects
  SET raised_funding = raised_funding + p_amount,
      investors_count = investors_count + 1,
      funding_progress = LEAST(100, ROUND((raised_funding + p_amount) / total_funding * 100, 1))
  WHERE id = p_project_id;

  -- Create success notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    'Investment Confirmed!',
    'Your investment of ₹' || to_char(p_amount, 'FM999,999,999') || ' in ' || v_project.name || ' has been confirmed. Expected annual return: ' || v_project.expected_roi || '%',
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'investment_id', v_investment_id,
    'new_balance', v_new_balance,
    'project_name', v_project.name
  );
END;
$$;

-- ============================================================
-- SERVER FUNCTION: add_wallet_money
-- Credits wallet and records the transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_wallet_money(
  p_amount numeric,
  p_method text DEFAULT 'UPI'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_new_balance numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  UPDATE profiles
  SET wallet_balance = wallet_balance + p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO wallet_transactions (user_id, type, description, amount, status)
  VALUES (v_user_id, 'credit', 'Added via ' || p_method, p_amount, 'Completed');

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ============================================================
-- SERVER FUNCTION: withdraw_wallet_money
-- Debits wallet and records the transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.withdraw_wallet_money(
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_balance numeric;
  v_new_balance numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT wallet_balance INTO v_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: ₹%', v_balance;
  END IF;

  IF p_amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₹100';
  END IF;

  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  INSERT INTO wallet_transactions (user_id, type, description, amount, status)
  VALUES (v_user_id, 'debit', 'Withdrawal to bank account', p_amount, 'Completed');

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ============================================================
-- SERVER FUNCTION: mark_all_notifications_read
-- Marks all unread notifications as read for the calling user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$;

-- ============================================================
-- SEED: land_projects
-- 6 realistic Indian land investment projects
-- ============================================================
INSERT INTO land_projects (
  id, name, location, state, city, image, images,
  total_area, min_investment, expected_roi,
  funding_progress, total_funding, raised_funding, investors_count,
  risk_score, category, is_govt_approved, is_verified,
  timeline, description, highlights, amenities, documents,
  lat, lng, appreciation_rate, is_active
) VALUES
(
  '11111111-0000-0000-0000-000000000001',
  'Green Valley Residences',
  'Whitefield, Bengaluru',
  'Karnataka',
  'Bengaluru',
  'https://images.pexels.com/photos/1117452/pexels-photo-1117452.jpeg?w=800',
  ARRAY[
    'https://images.pexels.com/photos/1117452/pexels-photo-1117452.jpeg?w=800',
    'https://images.pexels.com/photos/280229/pexels-photo-280229.jpeg?w=800',
    'https://images.pexels.com/photos/1370704/pexels-photo-1370704.jpeg?w=800'
  ],
  '12.5 Acres', 500, 18.5,
  72, 25000000, 18000000, 1247,
  'Low', 'Residential', true, true,
  '3 Years',
  'Premium residential plots in the heart of Whitefield, Bengaluru. RERA approved with clear titles and excellent connectivity to tech corridors.',
  ARRAY['RERA Approved','Clear Title','24/7 Security','Gated Community'],
  '[{"name":"International Tech Park","distance":"2.1 km","type":"work"},{"name":"Columbia Asia Hospital","distance":"3.5 km","type":"hospital"},{"name":"Inorbit Mall","distance":"4.2 km","type":"shopping"},{"name":"Whitefield Metro","distance":"1.8 km","type":"metro"}]'::jsonb,
  '[{"name":"Land Title Deed","status":"Verified"},{"name":"RERA Certificate","status":"Verified"},{"name":"Soil Report","status":"Verified"},{"name":"Environmental NOC","status":"Verified"}]'::jsonb,
  12.9698, 77.7499, 22, true
),
(
  '11111111-0000-0000-0000-000000000002',
  'Coastal Commerce Hub',
  'Panvel, Navi Mumbai',
  'Maharashtra',
  'Mumbai',
  'https://images.pexels.com/photos/323705/pexels-photo-323705.jpeg?w=800',
  ARRAY[
    'https://images.pexels.com/photos/323705/pexels-photo-323705.jpeg?w=800',
    'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg?w=800',
    'https://images.pexels.com/photos/2883049/pexels-photo-2883049.jpeg?w=800'
  ],
  '8.2 Acres', 1000, 24.2,
  45, 45000000, 20250000, 892,
  'Medium', 'Commercial', true, true,
  '4 Years',
  'Premium commercial land near Navi Mumbai International Airport. Ideal for logistics, warehousing, and commercial development.',
  ARRAY['Airport Proximity','Highway Access','Industrial Zone','Tax Benefits'],
  '[{"name":"Navi Mumbai Airport","distance":"5.5 km","type":"airport"},{"name":"MIDC Industrial Area","distance":"2.0 km","type":"work"},{"name":"Panvel Railway Station","distance":"3.1 km","type":"transport"},{"name":"DY Patil Hospital","distance":"4.8 km","type":"hospital"}]'::jsonb,
  '[{"name":"Land Title Deed","status":"Verified"},{"name":"Industrial NOC","status":"Verified"},{"name":"Soil Report","status":"Verified"},{"name":"Airport Authority Clearance","status":"Pending"}]'::jsonb,
  18.9894, 73.1175, 28, true
),
(
  '11111111-0000-0000-0000-000000000003',
  'Organic Farm Estates',
  'Coorg, Karnataka',
  'Karnataka',
  'Coorg',
  'https://images.pexels.com/photos/974314/pexels-photo-974314.jpeg?w=800',
  ARRAY[
    'https://images.pexels.com/photos/974314/pexels-photo-974314.jpeg?w=800',
    'https://images.pexels.com/photos/1084543/pexels-photo-1084543.jpeg?w=800',
    'https://images.pexels.com/photos/2132227/pexels-photo-2132227.jpeg?w=800'
  ],
  '45.0 Acres', 500, 14.8,
  88, 18000000, 15840000, 2341,
  'Low', 'Farm Land', true, true,
  '5 Years',
  'Certified organic farmland in the lush hills of Coorg. Coffee and spice cultivation with professional farm management and guaranteed buyback.',
  ARRAY['Organic Certified','Guaranteed Buyback','Managed Farming','Tourism Potential'],
  '[{"name":"Madikeri Town","distance":"12 km","type":"city"},{"name":"Coorg Wildlife Sanctuary","distance":"8 km","type":"nature"},{"name":"Mangalore Airport","distance":"115 km","type":"airport"}]'::jsonb,
  '[{"name":"Land Title Deed","status":"Verified"},{"name":"Organic Certification","status":"Verified"},{"name":"Farm Management Agreement","status":"Verified"},{"name":"Revenue Records","status":"Verified"}]'::jsonb,
  12.4244, 75.7382, 16, true
),
(
  '11111111-0000-0000-0000-000000000004',
  'Metro Tech Industrial Park',
  'Outer Ring Road, Hyderabad',
  'Telangana',
  'Hyderabad',
  'https://images.pexels.com/photos/1463917/pexels-photo-1463917.jpeg?w=800',
  ARRAY[
    'https://images.pexels.com/photos/1463917/pexels-photo-1463917.jpeg?w=800',
    'https://images.pexels.com/photos/236698/pexels-photo-236698.jpeg?w=800'
  ],
  '20.0 Acres', 2000, 28.5,
  31, 80000000, 24800000, 445,
  'Medium', 'Industrial', true, true,
  '5 Years',
  'Strategic industrial land on Hyderabad Outer Ring Road. Next to IT special economic zones with excellent infrastructure.',
  ARRAY['SEZ Adjacent','ORR Access','Power & Water','Industrial Zone'],
  '[{"name":"Rajiv Gandhi Int. Airport","distance":"18 km","type":"airport"},{"name":"HITEC City","distance":"22 km","type":"work"},{"name":"Apollo Hospital","distance":"15 km","type":"hospital"}]'::jsonb,
  '[{"name":"Land Title Deed","status":"Verified"},{"name":"Industrial License","status":"Verified"},{"name":"Environmental Report","status":"Verified"}]'::jsonb,
  17.4065, 78.4772, 32, true
),
(
  '11111111-0000-0000-0000-000000000005',
  'Serene Luxury Villas',
  'Alibaug, Maharashtra',
  'Maharashtra',
  'Alibaug',
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?w=800',
  ARRAY[
    'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?w=800',
    'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?w=800'
  ],
  '5.5 Acres', 5000, 32.0,
  58, 120000000, 69600000, 312,
  'Low', 'Luxury Villas', true, true,
  '3 Years',
  'Exclusive beachfront villa plots in Alibaug. Only 2 hours from Mumbai with ferry connectivity. Premium luxury lifestyle investment.',
  ARRAY['Beachfront','Ferry Access','Club Membership','Sea View'],
  '[{"name":"Alibaug Beach","distance":"0.5 km","type":"nature"},{"name":"Mandwa Ferry Jetty","distance":"8 km","type":"transport"},{"name":"Kolaba Fort","distance":"3 km","type":"landmark"}]'::jsonb,
  '[{"name":"Land Title Deed","status":"Verified"},{"name":"Coastal Zone NOC","status":"Verified"},{"name":"RERA Registration","status":"Verified"}]'::jsonb,
  18.6414, 72.8722, 38, true
),
(
  '11111111-0000-0000-0000-000000000006',
  'Smart City Plots',
  'GIFT City, Gandhinagar',
  'Gujarat',
  'Gandhinagar',
  'https://images.pexels.com/photos/1563355/pexels-photo-1563355.jpeg?w=800',
  ARRAY[
    'https://images.pexels.com/photos/1563355/pexels-photo-1563355.jpeg?w=800',
    'https://images.pexels.com/photos/325185/pexels-photo-325185.jpeg?w=800'
  ],
  '6.8 Acres', 1000, 21.3,
  64, 35000000, 22400000, 789,
  'Low', 'Commercial', true, true,
  '4 Years',
  'Premium plots within India''s first operational smart city and IFSC. Exceptional infrastructure with global financial district potential.',
  ARRAY['IFSC Zone','Smart Infrastructure','Tax Exemptions','Global Connectivity'],
  '[{"name":"Ahmedabad Airport","distance":"25 km","type":"airport"},{"name":"Sabarmati Riverfront","distance":"20 km","type":"nature"},{"name":"GIFT City Metro","distance":"0.8 km","type":"metro"}]'::jsonb,
  '[{"name":"Land Title Deed","status":"Verified"},{"name":"GIFT City Allotment","status":"Verified"},{"name":"IFSC Certificate","status":"Verified"}]'::jsonb,
  23.1585, 72.6749, 26, true
)
ON CONFLICT (id) DO UPDATE SET
  investors_count = EXCLUDED.investors_count,
  raised_funding = EXCLUDED.raised_funding,
  funding_progress = EXCLUDED.funding_progress;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_project_id ON investments(project_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_land_projects_active ON land_projects(is_active, investors_count DESC);
