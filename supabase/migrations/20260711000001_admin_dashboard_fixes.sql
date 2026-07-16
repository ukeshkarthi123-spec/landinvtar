-- ==========================================
-- ADMIN DASHBOARD COMPREHENSIVE FIXES
-- ==========================================

-- 1. Ensure all tables have proper admin access policies
-- We use a function to check if the current user is an admin to avoid RLS recursion on the profiles table.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. APPLY ADMIN POLICIES TO ALL TABLES

-- PROFILES
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin());

-- LAND PROJECTS
DROP POLICY IF EXISTS "admin_insert_projects" ON land_projects;
DROP POLICY IF EXISTS "admin_update_projects" ON land_projects;
DROP POLICY IF EXISTS "admin_delete_projects" ON land_projects;

CREATE POLICY "admin_all_projects" ON land_projects FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- INVESTMENTS
DROP POLICY IF EXISTS "admin_select_investments" ON investments;
CREATE POLICY "admin_all_investments" ON investments FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- WALLET TRANSACTIONS
DROP POLICY IF EXISTS "admin_select_transactions" ON wallet_transactions;
CREATE POLICY "admin_all_transactions" ON wallet_transactions FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PAYMENT ORDERS
DROP POLICY IF EXISTS "admin_select_payment_orders" ON payment_orders;
CREATE POLICY "admin_all_payment_orders" ON payment_orders FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "admin_select_notifications" ON notifications;
CREATE POLICY "admin_all_notifications" ON notifications FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. ENSURE ADMIN ROLE FOR admin24@gmail.com
UPDATE public.profiles
SET role = 'admin', is_admin = true
WHERE LOWER(email) = 'admin24@gmail.com';

-- 4. ADD MISSING TABLES FOR REPORTS AND SETTINGS IF NECESSARY
-- (For now we will use existing tables, but we might need a settings table)

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON app_settings FOR ALL
  TO authenticated USING (public.is_admin());

CREATE POLICY "Public read settings" ON app_settings FOR SELECT
  TO authenticated, anon USING (true);

-- Seed some default settings
INSERT INTO app_settings (key, value)
VALUES
  ('payment_gateway', '{"provider": "razorpay", "enabled": true, "test_mode": true}'::jsonb),
  ('platform_fee', '{"percentage": 2, "enabled": true}'::jsonb),
  ('kyc_config', '{"auto_approve": false, "require_aadhaar": true, "require_pan": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
