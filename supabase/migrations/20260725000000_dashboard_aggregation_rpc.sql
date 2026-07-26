-- aggregation function for admin dashboard to avoid pulling large datasets
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users bigint;
  v_active_projects bigint;
  v_total_investments numeric;
  v_pending_kyc bigint;
  v_total_withdrawals numeric;
  v_successful_payments numeric;
  v_failed_payments bigint;
  v_active_investors bigint;
BEGIN
  -- 1. Counts
  SELECT count(*) INTO v_total_users FROM public.profiles;
  SELECT count(*) INTO v_active_projects FROM public.land_projects WHERE is_active = true;
  SELECT count(*) INTO v_pending_kyc FROM public.kyc_documents WHERE status = 'Pending';

  -- 2. Sums
  SELECT COALESCE(sum(amount), 0) INTO v_total_investments FROM public.investments WHERE status = 'Active';

  SELECT COALESCE(sum(amount), 0) INTO v_total_withdrawals
  FROM public.wallet_transactions
  WHERE type = 'debit' AND status = 'Completed';

  SELECT COALESCE(sum(amount), 0) / 100 INTO v_successful_payments
  FROM public.payment_orders
  WHERE status = 'paid';

  SELECT count(*) INTO v_failed_payments FROM public.payment_orders WHERE status = 'failed';

  -- 3. Uniques
  SELECT count(DISTINCT user_id) INTO v_active_investors FROM public.investments WHERE status = 'Active';

  RETURN json_build_object(
    'totalUsers', v_total_users,
    'activeProjects', v_active_projects,
    'totalInvestments', v_total_investments,
    'pendingKYC', v_pending_kyc,
    'totalWithdrawals', v_total_withdrawals,
    'successfulPayments', v_successful_payments,
    'failedPayments', v_failed_payments,
    'activeInvestors', v_active_investors
  );
END;
$$;
