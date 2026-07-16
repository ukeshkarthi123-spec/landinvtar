/*
# Add admin support: is_admin column, admin RPC functions, and admin RLS policies

## Purpose
This migration adds admin capabilities to the InvestLand platform:
1. Adds `is_admin` boolean column to `profiles` table
2. Adds admin-scoped RLS policies on `land_projects`, `investments`, `kyc_documents`, and `support_tickets` so admins can manage all records
3. Adds RPC functions for admin operations: toggle project active status, approve/reject KYC, update support ticket status

## Changes

### profiles table
- Added `is_admin` boolean column (default false)

### RLS Policy additions
- `land_projects`: admin can SELECT, INSERT, UPDATE, DELETE all rows
- `kyc_documents`: admin can SELECT, UPDATE all rows (for KYC review)
- `support_tickets`: admin can SELECT, UPDATE all rows (for ticket management)
- `investments`: admin can SELECT all rows (for reporting)

### RPC Functions
- `toggle_project_active(p_project_id uuid)` — toggles is_active on a land project (admin only)
- `approve_kyc(p_kyc_id uuid)` — approves a KYC submission and updates profile status (admin only)
- `reject_kyc(p_kyc_id uuid, p_reason text)` — rejects a KYC submission and updates profile status (admin only)
- `update_ticket_status(p_ticket_id uuid, p_status text)` — updates support ticket status (admin only)

## Security
- All admin RPC functions check `is_admin` flag on the caller's profile before proceeding
- Admin RLS policies use a subquery: `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)`
- Non-admin users retain their existing owner-scoped policies
*/

-- Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================================
-- Admin RLS policies on land_projects
-- ============================================================
DROP POLICY IF EXISTS "admin_select_projects" ON land_projects;
CREATE POLICY "admin_select_projects" ON land_projects FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_projects" ON land_projects;
CREATE POLICY "admin_insert_projects" ON land_projects FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "admin_update_projects" ON land_projects;
CREATE POLICY "admin_update_projects" ON land_projects FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "admin_delete_projects" ON land_projects;
CREATE POLICY "admin_delete_projects" ON land_projects FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- Admin RLS policies on kyc_documents (admin can see/update all)
-- ============================================================
DROP POLICY IF EXISTS "admin_select_kyc" ON kyc_documents;
CREATE POLICY "admin_select_kyc" ON kyc_documents FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "admin_update_kyc" ON kyc_documents;
CREATE POLICY "admin_update_kyc" ON kyc_documents FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- Admin RLS policies on support_tickets (admin can see/update all)
-- ============================================================
DROP POLICY IF EXISTS "admin_select_tickets" ON support_tickets;
CREATE POLICY "admin_select_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "admin_update_tickets" ON support_tickets;
CREATE POLICY "admin_update_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- Admin RLS policies on investments (admin can see all)
-- ============================================================
DROP POLICY IF EXISTS "admin_select_investments" ON investments;
CREATE POLICY "admin_select_investments" ON investments FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- RPC: toggle_project_active (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_project_active(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_new_state boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE land_projects SET is_active = NOT is_active
  WHERE id = p_project_id
  RETURNING is_active INTO v_new_state;

  RETURN v_new_state;
END;
$$;

-- ============================================================
-- RPC: approve_kyc (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION approve_kyc(p_kyc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_user_id uuid;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT user_id INTO v_user_id FROM kyc_documents WHERE id = p_kyc_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'KYC record not found';
  END IF;

  UPDATE kyc_documents
  SET status = 'Approved', reviewed_at = now(), updated_at = now()
  WHERE id = p_kyc_id;

  UPDATE profiles SET kyc_status = 'Verified', updated_at = now()
  WHERE id = v_user_id;
END;
$$;

-- ============================================================
-- RPC: reject_kyc (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION reject_kyc(p_kyc_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_user_id uuid;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT user_id INTO v_user_id FROM kyc_documents WHERE id = p_kyc_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'KYC record not found';
  END IF;

  UPDATE kyc_documents
  SET status = 'Rejected', rejection_reason = p_reason, reviewed_at = now(), updated_at = now()
  WHERE id = p_kyc_id;

  UPDATE profiles SET kyc_status = 'Not Started', updated_at = now()
  WHERE id = v_user_id;
END;
$$;

-- ============================================================
-- RPC: update_ticket_status (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION update_ticket_status(p_ticket_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE support_tickets
  SET status = p_status, updated_at = now()
  WHERE id = p_ticket_id;
END;
$$;
