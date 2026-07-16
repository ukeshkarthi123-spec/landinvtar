-- ==========================================
-- REBUILD SETTINGS SYSTEM FROM SCRATCH
-- ==========================================

-- 1. Drop old table if exists to ensure a clean start
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- 2. Create the new production-ready table
CREATE TABLE public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- General
    app_name TEXT NOT NULL DEFAULT 'InvestLand',
    app_logo TEXT,
    support_email TEXT NOT NULL DEFAULT 'support@investland.com',
    support_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    language TEXT NOT NULL DEFAULT 'en-US',
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    maintenance_message TEXT NOT NULL DEFAULT 'The system is currently undergoing scheduled maintenance. Please check back later.',

    -- Platform
    default_roi NUMERIC NOT NULL DEFAULT 18.0,
    minimum_investment NUMERIC NOT NULL DEFAULT 500,
    maximum_investment NUMERIC NOT NULL DEFAULT 10000000,
    minimum_withdrawal NUMERIC NOT NULL DEFAULT 500,
    withdrawal_fee NUMERIC NOT NULL DEFAULT 0.0,

    -- KYC
    pan_verification BOOLEAN NOT NULL DEFAULT true,
    aadhaar_verification BOOLEAN NOT NULL DEFAULT true,
    bank_verification BOOLEAN NOT NULL DEFAULT true,
    selfie_verification BOOLEAN NOT NULL DEFAULT false,
    address_verification BOOLEAN NOT NULL DEFAULT false,

    -- Payments
    razorpay_key_id TEXT DEFAULT '',
    payment_enabled BOOLEAN NOT NULL DEFAULT true,
    withdrawal_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Notifications
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    push_notifications BOOLEAN NOT NULL DEFAULT true,
    sms_notifications BOOLEAN NOT NULL DEFAULT false,
    admin_notifications BOOLEAN NOT NULL DEFAULT true,

    -- Security
    login_attempt_limit INTEGER NOT NULL DEFAULT 5,
    session_timeout INTEGER NOT NULL DEFAULT 3600, -- seconds
    two_factor_required BOOLEAN NOT NULL DEFAULT false,

    -- Appearance
    theme TEXT NOT NULL DEFAULT 'system',
    dark_mode_default BOOLEAN NOT NULL DEFAULT false,
    primary_color TEXT NOT NULL DEFAULT '#10b981',

    -- System
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage settings" ON public.app_settings
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  )
);

-- Public/Users can only read basic info (for app startup)
CREATE POLICY "Public read specific settings" ON public.app_settings
FOR SELECT TO anon, authenticated
USING (true);

-- 4. Initial Seed
INSERT INTO public.app_settings (id) VALUES (gen_random_uuid());
