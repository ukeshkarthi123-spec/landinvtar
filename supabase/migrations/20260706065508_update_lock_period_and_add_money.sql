/*
# Update Lock Period to 24 Hours and Add Money Feature

## Changes
1. Change default lock_in_period from 90 days to 1 day (24 hours)
2. Update exit_investment RPC to use 1-day lock
3. Add new RPC: add_to_investment for adding more money to existing investment

## Business Rules
- After investing, the investment is locked for exactly 24 hours
- During 24 hours: can add money, cannot close investment
- After 24 hours: can both add money and close investment
*/

-- Update default lock_in_period to 1 day (24 hours)
ALTER TABLE investments 
  ALTER COLUMN lock_in_period SET DEFAULT 1;

-- Update existing active investments to 1 day lock
UPDATE investments 
SET lock_in_period = 1 
WHERE status = 'Active';

-- ============================================================
-- RPC FUNCTION: add_to_investment
-- Allows user to add more money to an existing active investment
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_to_investment(
  p_investment_id uuid,
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
  v_investment investments%ROWTYPE;
  v_project land_projects%ROWTYPE;
  v_new_balance numeric;
  v_new_amount numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
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

  -- Lock and get the investment
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
    RAISE EXCEPTION 'Cannot add to a closed investment';
  END IF;

  -- Get project details
  SELECT * INTO v_project
  FROM land_projects
  WHERE id = v_investment.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated project not found';
  END IF;

  -- Deduct from wallet
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Update investment amount
  v_new_amount := v_investment.amount + p_amount;
  
  UPDATE investments
  SET amount = v_new_amount,
      updated_at = now()
  WHERE id = p_investment_id;

  -- Create wallet debit transaction
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (v_user_id, 'debit', 'Added to investment in ' || v_project.name, p_amount, 'Completed', p_investment_id);

  -- Update project funding stats
  UPDATE land_projects
  SET raised_funding = raised_funding + p_amount,
      funding_progress = CASE
        WHEN total_funding > 0 THEN LEAST(100, ROUND((raised_funding + p_amount) / total_funding * 100, 1))
        ELSE 0
      END
  WHERE id = v_investment.project_id;

  -- Create success notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    'Investment Updated',
    'You added ₹' || to_char(p_amount, 'FM999,999,999') || ' to your investment in ' || v_project.name || '. Total: ₹' || to_char(v_new_amount, 'FM999,999,999'),
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_amount', v_new_amount,
    'new_balance', v_new_balance,
    'project_name', v_project.name
  );
END;
$$;
