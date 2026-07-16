-- ==========================================
-- SETTINGS V2 SCHEMA
-- ==========================================

-- 1. Create a definitive table for platform settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- General
    platform_name TEXT NOT NULL DEFAULT 'InvestLand',
    platform_logo TEXT,
    support_email TEXT NOT NULL DEFAULT 'support@investland.com',
    contact_number TEXT NOT NULL DEFAULT '+91 98765 43210',
    company_address TEXT DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    language TEXT NOT NULL DEFAULT 'en-US',
    date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',

    -- Platform Controls
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    registration_enabled BOOLEAN NOT NULL DEFAULT true,
    investment_enabled BOOLEAN NOT NULL DEFAULT true,
    withdrawals_enabled BOOLEAN NOT NULL DEFAULT true,
    deposits_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Investment Metrics
    default_roi NUMERIC NOT NULL DEFAULT 18.0,
    min_investment NUMERIC NOT NULL DEFAULT 500,
    max_investment NUMERIC NOT NULL DEFAULT 10000000,
    min_withdrawal NUMERIC NOT NULL DEFAULT 500,
    withdrawal_fee NUMERIC NOT NULL DEFAULT 0.0,
    referral_commission NUMERIC NOT NULL DEFAULT 2.0,

    -- KYC Verification Nodes
    pan_verification BOOLEAN NOT NULL DEFAULT true,
    aadhaar_verification BOOLEAN NOT NULL DEFAULT true,
    bank_verification BOOLEAN NOT NULL DEFAULT true,
    selfie_verification BOOLEAN NOT NULL DEFAULT false,
    manual_review BOOLEAN NOT NULL DEFAULT true,
    auto_approval BOOLEAN NOT NULL DEFAULT false,

    -- Notifications
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    sms_notifications BOOLEAN NOT NULL DEFAULT false,
    push_notifications BOOLEAN NOT NULL DEFAULT true,
    admin_alerts BOOLEAN NOT NULL DEFAULT true,
    user_alerts BOOLEAN NOT NULL DEFAULT true,

    -- Security
    two_factor_auth BOOLEAN NOT NULL DEFAULT false,
    session_timeout INTEGER NOT NULL DEFAULT 3600,
    password_policy TEXT NOT NULL DEFAULT 'strong',
    max_login_attempts INTEGER NOT NULL DEFAULT 5,
    device_verification BOOLEAN NOT NULL DEFAULT false,

    -- Payments
    razorpay_enabled BOOLEAN NOT NULL DEFAULT true,
    upi_enabled BOOLEAN NOT NULL DEFAULT true,
    wallet_enabled BOOLEAN NOT NULL DEFAULT true,
    bank_transfer_enabled BOOLEAN NOT NULL DEFAULT true,
    cash_deposit_enabled BOOLEAN NOT NULL DEFAULT false,

    -- Appearance
    primary_color TEXT NOT NULL DEFAULT '#10b981',
    accent_color TEXT NOT NULL DEFAULT '#3b82f6',
    sidebar_style TEXT NOT NULL DEFAULT 'modern',
    layout_type TEXT NOT NULL DEFAULT 'sidebar',
    font_size TEXT NOT NULL DEFAULT 'medium',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select settings" ON public.app_settings;
CREATE POLICY "Public select settings" ON public.app_settings
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
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
