-- ==========================================
-- SETTINGS SCHEMA OVERHAUL
-- ==========================================

-- We transition from key-value to a single-row configuration table
-- which is much more reliable for a dashboard with many interdependent fields.

CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- General
  app_name TEXT DEFAULT 'InvestLand',
  support_email TEXT DEFAULT 'support@investland.com',
  platform_currency TEXT DEFAULT 'INR',
  default_roi NUMERIC DEFAULT 18,

  -- KYC Requirements
  pan_verification BOOLEAN DEFAULT true,
  aadhaar_verification BOOLEAN DEFAULT true,
  bank_verification BOOLEAN DEFAULT true,
  selfie_verification BOOLEAN DEFAULT false,

  -- Payments
  razorpay_key_id TEXT DEFAULT 'rzp_test_XXXXXXXXXXXXXX',
  min_withdrawal NUMERIC DEFAULT 500,
  withdrawal_fee NUMERIC DEFAULT 0,

  -- Notifications
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  admin_alerts BOOLEAN DEFAULT true,
  investment_alerts BOOLEAN DEFAULT true,
  withdrawal_alerts BOOLEAN DEFAULT true,
  kyc_alerts BOOLEAN DEFAULT true,

  -- Maintenance
  maintenance_mode BOOLEAN DEFAULT false,
  system_announcement TEXT DEFAULT '',

  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage configs" ON public.app_settings;
CREATE POLICY "Admins manage configs" ON public.app_settings FOR ALL
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone read configs" ON public.app_settings;
CREATE POLICY "Anyone read configs" ON public.app_settings FOR SELECT
TO authenticated, anon USING (true);

-- Insert default row
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
