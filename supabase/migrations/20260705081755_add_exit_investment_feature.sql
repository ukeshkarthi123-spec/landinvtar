/*
# Add Exit Investment Feature

## Overview
Adds the ability for users to exit (withdraw) from an active land investment.
The exit credits the current market value of the investment to the user's wallet,
records a wallet transaction, marks the investment as 'Exited', and sends a notification.

## Changes

### 1. investments table — new column
- `lock_in_period` (integer, NOT NULL, DEFAULT 90): lock-in period in days from the
  investment creation date. An investment cannot be exited until this many days have
  passed. 90 days is a sensible default for a land investment platform.
- `exit_charge_pct` (numeric, NOT NULL, DEFAULT 1.0): percentage of the current market
  value deducted as an exit charge when the user exits. 1% is the platform default.

### 2. New RPC function: exit_investment(p_investment_id uuid)
SECURITY DEFINER function that atomically:
  a) Validates the investment belongs to the caller and is 'Active'.
  b) Checks the lock-in period has elapsed (raises a clear error if not).
  c) Computes the current market value using linear ROI accrual:
     current_value = amount * (1 + (roi_rate / 100) * years_elapsed)
  d) Computes the exit charge = current_value * exit_charge_pct / 100.
  e) Credits (current_value - exit_charge) to the user's wallet.
  f) Marks the investment status as 'Exited' and sets updated_at.
  g) Creates a 'credit' wallet_transactions record with a descriptive message.
  h) Updates the land_project: reduces raised_funding and investors_count.
  i) Creates a 'success' notification confirming the exit.
  j) Returns jsonb: { success, exit_amount, exit_charge, current_value, original_amount, new_balance, project_name }

### 3. RLS — no policy changes
The investments table already has owner-scoped SELECT and INSERT policies.
The exit operation runs through a SECURITY DEFINER function, so no new UPDATE
policy is needed on investments — the function bypasses RLS to update the row.
The wallet_transactions table already has an owner-scoped INSERT policy, but the
SECURITY DEFINER function bypasses RLS for the insert, so no changes are needed.

## Important Notes
1. The lock-in period is enforced server-side — the client cannot bypass it.
2. The exit charge is deducted from the market value, not the original principal.
3. The function uses FOR UPDATE locking on both the investment and the profile row
   to prevent race conditions (e.g., double-exit).
4. The current market value formula matches the client-side computeCurrentValue()
   helper in types/database.ts, ensuring the UI and backend agree on the value.
5. Existing investments get the default 90-day lock-in and 1% exit charge, so
   they are immediately eligible for exit if they were created more than 90 days ago.
*/

-- ============================================================
-- Add lock_in_period and exit_charge_pct to investments
-- ============================================================
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS lock_in_period integer NOT NULL DEFAULT 90;

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS exit_charge_pct numeric NOT NULL DEFAULT 1.0;

-- ============================================================
-- RPC FUNCTION: exit_investment
-- Atomically exits an active investment, credits wallet, records transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.exit_investment(
  p_investment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_investment investments%ROWTYPE;
  v_project land_projects%ROWTYPE;
  v_years_elapsed double precision;
  v_current_value numeric;
  v_exit_charge numeric;
  v_exit_amount numeric;
  v_new_balance numeric;
  v_lock_end_date timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock and get the investment row
  SELECT * INTO v_investment
  FROM investments
  WHERE id = p_investment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment not found';
  END IF;

  IF v_investment.user_id != v_user_id THEN
    RAISE EXCEPTION 'You do not own this investment';
  END IF;

  IF v_investment.status != 'Active' THEN
    RAISE EXCEPTION 'This investment has already been exited';
  END IF;

  -- Check lock-in period
  v_lock_end_date := v_investment.created_at + make_interval(days => v_investment.lock_in_period);
  IF now() < v_lock_end_date THEN
    RAISE EXCEPTION 'Lock-in period active. You can exit this investment after %',
      to_char(v_lock_end_date, 'DD Mon YYYY');
  END IF;

  -- Get project details
  SELECT * INTO v_project
  FROM land_projects
  WHERE id = v_investment.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated project not found';
  END IF;

  -- Compute current market value (linear ROI accrual, matching client-side helper)
  v_years_elapsed := EXTRACT(EPOCH FROM (now() - v_investment.created_at)) / (365.25 * 24 * 60 * 60);
  v_current_value := v_investment.amount * (1 + (v_investment.roi_rate / 100.0) * v_years_elapsed);

  -- Compute exit charge and final exit amount
  v_exit_charge := ROUND(v_current_value * (v_investment.exit_charge_pct / 100.0), 2);
  v_exit_amount := ROUND(v_current_value - v_exit_charge, 2);

  -- Lock and update wallet balance
  UPDATE profiles
  SET wallet_balance = wallet_balance + v_exit_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Mark investment as exited
  UPDATE investments
  SET status = 'Exited',
      updated_at = now()
  WHERE id = p_investment_id;

  -- Create wallet credit transaction
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (
    v_user_id,
    'credit',
    'Exit from ' || v_project.name,
    v_exit_amount,
    'Completed',
    p_investment_id
  );

  -- Update project funding stats
  UPDATE land_projects
  SET raised_funding = GREATEST(0, raised_funding - v_investment.amount),
      investors_count = GREATEST(0, investors_count - 1),
      funding_progress = CASE
        WHEN total_funding > 0 THEN LEAST(100, ROUND(GREATEST(0, raised_funding - v_investment.amount) / total_funding * 100, 1))
        ELSE 0
      END
  WHERE id = v_investment.project_id;

  -- Create success notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    'Investment Exited',
    'You exited ' || v_project.name || '. ₹' || to_char(v_exit_amount, 'FM999,999,999.00') || ' credited to your wallet.',
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'exit_amount', v_exit_amount,
    'exit_charge', v_exit_charge,
    'current_value', ROUND(v_current_value, 2),
    'original_amount', v_investment.amount,
    'new_balance', v_new_balance,
    'project_name', v_project.name
  );
END;
$$;