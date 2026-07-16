-- Enable Realtime for land_projects table
-- Note: This is usually done via the dashboard, but can be done via SQL
ALTER publication supabase_realtime ADD TABLE land_projects;

-- Refine invest_in_project to handle "Fully Funded" logic and unique investors
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
  v_is_new_investor boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock profile to prevent race conditions on wallet
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

  -- Lock project to prevent over-funding
  SELECT * INTO v_project
  FROM land_projects
  WHERE id = p_project_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or inactive';
  END IF;

  IF v_project.raised_funding >= v_project.total_funding THEN
    RAISE EXCEPTION 'This project is already fully funded.';
  END IF;

  IF (v_project.raised_funding + p_amount) > v_project.total_funding THEN
    RAISE EXCEPTION 'Investment exceeds remaining funding goal. Remaining: ₹%', (v_project.total_funding - v_project.raised_funding);
  END IF;

  IF p_amount < v_project.min_investment THEN
    RAISE EXCEPTION 'Amount % is below minimum investment of %', p_amount, v_project.min_investment;
  END IF;

  -- Check if user is already an investor in this project
  SELECT NOT EXISTS (
    SELECT 1 FROM investments
    WHERE user_id = v_user_id AND project_id = p_project_id AND status = 'Active'
  ) INTO v_is_new_investor;

  -- 1. Deduct wallet balance
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- 2. Create investment record
  INSERT INTO investments (user_id, project_id, amount, roi_rate, status)
  VALUES (v_user_id, p_project_id, p_amount, v_project.expected_roi, 'Active')
  RETURNING id INTO v_investment_id;

  -- 3. Create wallet debit transaction
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (v_user_id, 'debit', 'Invested in ' || v_project.name, p_amount, 'Completed', v_investment_id);

  -- 4. Update project funding stats
  UPDATE land_projects
  SET raised_funding = raised_funding + p_amount,
      investors_count = CASE WHEN v_is_new_investor THEN investors_count + 1 ELSE investors_count END,
      funding_progress = ROUND(((raised_funding + p_amount) / total_funding) * 100, 1)
  WHERE id = p_project_id;

  -- 5. Create success notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    'Investment Confirmed!',
    'Your investment of ₹' || to_char(p_amount, 'FM999,999,999') || ' in ' || v_project.name || ' has been confirmed.',
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
