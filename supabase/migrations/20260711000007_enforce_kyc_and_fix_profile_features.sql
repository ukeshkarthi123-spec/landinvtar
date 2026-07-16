-- ============================================================
-- ENFORCE KYC ON FINANCIAL TRANSACTIONS & FIX PROFILE FEATURES
-- ============================================================

-- 1. Create a helper function to verify KYC status
CREATE OR REPLACE FUNCTION public.check_kyc_verified(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status text;
BEGIN
  SELECT kyc_status INTO v_status FROM public.profiles WHERE id = p_user_id;
  IF v_status != 'Verified' THEN
    RAISE EXCEPTION 'KYC_NOT_VERIFIED: Complete your KYC verification to continue using financial services.';
  END IF;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update invest_in_project to enforce KYC
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

  -- ENFORCE KYC
  PERFORM public.check_kyc_verified(v_user_id);

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

-- 3. Update add_wallet_money (Deposit) to enforce KYC
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

  -- ENFORCE KYC
  PERFORM public.check_kyc_verified(v_user_id);

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

-- 4. Update withdraw_wallet_money to enforce KYC
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

  -- ENFORCE KYC
  PERFORM public.check_kyc_verified(v_user_id);

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

-- 5. FIX RLS for bank_accounts and upi_ids (Ensure they point to profiles correctly)
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_bank" ON bank_accounts;
CREATE POLICY "select_own_bank" ON bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_bank" ON bank_accounts;
CREATE POLICY "insert_own_bank" ON bank_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_bank" ON bank_accounts;
CREATE POLICY "update_own_bank" ON bank_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_bank" ON bank_accounts;
CREATE POLICY "delete_own_bank" ON bank_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.upi_ids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_upi" ON upi_ids;
CREATE POLICY "select_own_upi" ON upi_ids FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_upi" ON upi_ids;
CREATE POLICY "insert_own_upi" ON upi_ids FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_upi" ON upi_ids;
CREATE POLICY "update_own_upi" ON upi_ids FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_upi" ON upi_ids;
CREATE POLICY "delete_own_upi" ON upi_ids FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Trigger to sync status for mobile app direct updates if any
-- (We already have sync_kyc_status_to_profile from previous turns)
