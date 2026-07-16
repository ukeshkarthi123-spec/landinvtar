/*
# Add tables for profile features (KYC, Bank, UPI, Support, Referrals, Tax Reports)

## Purpose
This migration adds 6 new tables to support the profile screen features:
1. `kyc_documents` — stores KYC submission (PAN, Aadhaar, selfie) with admin approval status
2. `bank_accounts` — stores user bank accounts with default selection
3. `upi_ids` — stores user UPI IDs with verification and default selection
4. `support_tickets` — stores customer support tickets with messages
5. `referrals` — stores referral codes and referral history
6. `tax_reports` — stores generated tax report metadata

## New Tables

### kyc_documents
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
- `pan_number` (text)
- `pan_file_url` (text, URL to uploaded PAN file)
- `aadhaar_number` (text)
- `aadhaar_file_url` (text, URL to uploaded Aadhaar file)
- `selfie_url` (text, URL to uploaded selfie)
- `status` (text: 'Pending' | 'Approved' | 'Rejected', default 'Pending')
- `rejection_reason` (text, nullable)
- `submitted_at` (timestamptz, default now())
- `reviewed_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### bank_accounts
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
- `account_holder` (text, NOT NULL)
- `account_number` (text, NOT NULL)
- `ifsc_code` (text, NOT NULL)
- `bank_name` (text, NOT NULL)
- `branch_name` (text, nullable)
- `is_default` (boolean, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### upi_ids
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
- `upi_id` (text, NOT NULL)
- `is_verified` (boolean, default false)
- `is_default` (boolean, default false)
- `created_at` (timestamptz, default now())

### support_tickets
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
- `subject` (text, NOT NULL)
- `description` (text, NOT NULL)
- `category` (text: 'General' | 'Investment' | 'Payment' | 'KYC' | 'Technical', default 'General')
- `status` (text: 'Open' | 'In Progress' | 'Resolved' | 'Closed', default 'Open')
- `priority` (text: 'Low' | 'Medium' | 'High', default 'Medium')
- `messages` (jsonb, default '[]'::jsonb)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### referrals
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
- `referral_code` (text, UNIQUE, NOT NULL)
- `referred_email` (text, nullable)
- `status` (text: 'Pending' | 'Completed' | 'Rewarded', default 'Pending')
- `reward_amount` (numeric, default 0)
- `created_at` (timestamptz, default now())

### tax_reports
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
- `financial_year` (text, NOT NULL)
- `total_invested` (numeric, default 0)
- `total_returns` (numeric, default 0)
- `report_data` (jsonb)
- `status` (text: 'Generating' | 'Ready' | 'Failed', default 'Generating')
- `created_at` (timestamptz, default now())

## RPC Functions
- `set_default_bank_account(p_account_id uuid)` — unsets other defaults, sets the given account as default
- `set_default_upi(p_upi_id uuid)` — unsets other defaults, sets the given UPI as default
- `generate_referral_code()` — generates a unique 8-char referral code for the calling user
- `submit_kyc(p_pan text, p_aadhaar text)` — creates a KYC submission and updates profile status to 'Pending'
- `add_support_message(p_ticket_id uuid, p_message text)` — appends a user message to a ticket

## Security
- RLS enabled on all 6 new tables
- All tables scoped to `authenticated` with `auth.uid() = user_id` ownership checks
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
- RPC functions use SECURITY DEFINER with explicit auth.uid() checks
*/

-- ============================================================
-- KYC Documents
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  pan_number text,
  pan_file_url text,
  aadhaar_number text,
  aadhaar_file_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  rejection_reason text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_kyc" ON kyc_documents;
CREATE POLICY "select_own_kyc" ON kyc_documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_kyc" ON kyc_documents;
CREATE POLICY "insert_own_kyc" ON kyc_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_kyc" ON kyc_documents;
CREATE POLICY "update_own_kyc" ON kyc_documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_kyc" ON kyc_documents;
CREATE POLICY "delete_own_kyc" ON kyc_documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Bank Accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  bank_name text NOT NULL,
  branch_name text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bank" ON bank_accounts;
CREATE POLICY "select_own_bank" ON bank_accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bank" ON bank_accounts;
CREATE POLICY "insert_own_bank" ON bank_accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bank" ON bank_accounts;
CREATE POLICY "update_own_bank" ON bank_accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bank" ON bank_accounts;
CREATE POLICY "delete_own_bank" ON bank_accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- UPI IDs
-- ============================================================
CREATE TABLE IF NOT EXISTS upi_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  upi_id text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE upi_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_upi" ON upi_ids;
CREATE POLICY "select_own_upi" ON upi_ids FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_upi" ON upi_ids;
CREATE POLICY "insert_own_upi" ON upi_ids FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_upi" ON upi_ids;
CREATE POLICY "update_own_upi" ON upi_ids FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_upi" ON upi_ids;
CREATE POLICY "delete_own_upi" ON upi_ids FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Support Tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Investment', 'Payment', 'KYC', 'Technical')),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tickets" ON support_tickets;
CREATE POLICY "update_own_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tickets" ON support_tickets;
CREATE POLICY "delete_own_tickets" ON support_tickets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Referrals
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text UNIQUE NOT NULL,
  referred_email text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Rewarded')),
  reward_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_referrals" ON referrals;
CREATE POLICY "select_own_referrals" ON referrals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_referrals" ON referrals;
CREATE POLICY "insert_own_referrals" ON referrals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_referrals" ON referrals;
CREATE POLICY "update_own_referrals" ON referrals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_referrals" ON referrals;
CREATE POLICY "delete_own_referrals" ON referrals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Tax Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  financial_year text NOT NULL,
  total_invested numeric NOT NULL DEFAULT 0,
  total_returns numeric NOT NULL DEFAULT 0,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Generating' CHECK (status IN ('Generating', 'Ready', 'Failed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tax_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tax" ON tax_reports;
CREATE POLICY "select_own_tax" ON tax_reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tax" ON tax_reports;
CREATE POLICY "insert_own_tax" ON tax_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tax" ON tax_reports;
CREATE POLICY "update_own_tax" ON tax_reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tax" ON tax_reports;
CREATE POLICY "delete_own_tax" ON tax_reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_user ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_upi_user ON upi_ids(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_tax_user ON tax_reports(user_id);

-- ============================================================
-- RPC: set_default_bank_account
-- ============================================================
CREATE OR REPLACE FUNCTION set_default_bank_account(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE id = p_account_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Account not found or not owned by caller';
  END IF;

  UPDATE bank_accounts SET is_default = false, updated_at = now()
  WHERE user_id = auth.uid() AND is_default = true;

  UPDATE bank_accounts SET is_default = true, updated_at = now()
  WHERE id = p_account_id AND user_id = auth.uid();
END;
$$;

-- ============================================================
-- RPC: set_default_upi
-- ============================================================
CREATE OR REPLACE FUNCTION set_default_upi(p_upi_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM upi_ids
    WHERE id = p_upi_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'UPI not found or not owned by caller';
  END IF;

  UPDATE upi_ids SET is_default = false
  WHERE user_id = auth.uid() AND is_default = true;

  UPDATE upi_ids SET is_default = true
  WHERE id = p_upi_id AND user_id = auth.uid();
END;
$$;

-- ============================================================
-- RPC: generate_referral_code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT referral_code INTO v_code
  FROM referrals
  WHERE user_id = v_user_id AND referred_email IS NULL
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  INSERT INTO referrals (user_id, referral_code)
  VALUES (v_user_id, v_code);

  RETURN v_code;
END;
$$;

-- ============================================================
-- RPC: submit_kyc
-- ============================================================
CREATE OR REPLACE FUNCTION submit_kyc(
  p_pan text,
  p_aadhaar text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kyc_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM kyc_documents
  WHERE user_id = v_user_id AND status IN ('Pending', 'Rejected');

  INSERT INTO kyc_documents (user_id, pan_number, aadhaar_number, status, submitted_at)
  VALUES (v_user_id, p_pan, p_aadhaar, 'Pending', now())
  RETURNING id INTO v_kyc_id;

  UPDATE profiles SET kyc_status = 'Pending', updated_at = now()
  WHERE id = v_user_id;

  RETURN v_kyc_id;
END;
$$;

-- ============================================================
-- RPC: add_support_message
-- ============================================================
CREATE OR REPLACE FUNCTION add_support_message(
  p_ticket_id uuid,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT messages INTO v_existing
  FROM support_tickets
  WHERE id = p_ticket_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_existing IS NULL THEN
    RAISE EXCEPTION 'Ticket not found or not owned by caller';
  END IF;

  UPDATE support_tickets
  SET messages = v_existing || jsonb_build_array(
    jsonb_build_object(
      'sender', 'user',
      'message', p_message,
      'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  ),
  updated_at = now()
  WHERE id = p_ticket_id;
END;
$$;
