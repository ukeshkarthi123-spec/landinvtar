/*
# Fix anon EXECUTE on SECURITY DEFINER functions: revoke from PUBLIC, grant to authenticated only

## Summary
The previous migration correctly revoked EXECUTE from the `anon` role, but the functions still inherited
EXECUTE via the `PUBLIC` pseudo-role (the default grant PostgreSQL applies to all new functions).
This migration revokes EXECUTE from PUBLIC on all 19 SECURITY DEFINER functions, then re-grants EXECUTE
to `authenticated` so signed-in app users can still invoke them. This ensures unauthenticated callers
(anon key, public internet) cannot reach any SECURITY DEFINER RPC.

## Changes
For each of the 19 SECURITY DEFINER functions:
- REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;
- GRANT EXECUTE ON FUNCTION ... TO authenticated;

## Security impact
- No data is modified or deleted.
- No function bodies change — only privilege metadata.
- anon / public callers can no longer invoke any SECURITY DEFINER RPC.
- Signed-in users (authenticated role) retain full access.
*/

-- add_support_message
REVOKE EXECUTE ON FUNCTION public.add_support_message(p_ticket_id uuid, p_message text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_support_message(p_ticket_id uuid, p_message text) TO authenticated;

-- add_to_investment
REVOKE EXECUTE ON FUNCTION public.add_to_investment(p_investment_id uuid, p_amount numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_to_investment(p_investment_id uuid, p_amount numeric) TO authenticated;

-- add_wallet_money
REVOKE EXECUTE ON FUNCTION public.add_wallet_money(p_amount numeric, p_method text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_wallet_money(p_amount numeric, p_method text) TO authenticated;

-- approve_kyc
REVOKE EXECUTE ON FUNCTION public.approve_kyc(p_kyc_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_kyc(p_kyc_id uuid) TO authenticated;

-- confirm_razorpay_payment
REVOKE EXECUTE ON FUNCTION public.confirm_razorpay_payment(p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_amount numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_razorpay_payment(p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_amount numeric) TO authenticated;

-- create_profile_on_signup (trigger function, called by DB not users — but still lock it down)
REVOKE EXECUTE ON FUNCTION public.create_profile_on_signup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_on_signup() TO authenticated;

-- exit_investment
REVOKE EXECUTE ON FUNCTION public.exit_investment(p_investment_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exit_investment(p_investment_id uuid) TO authenticated;

-- fail_razorpay_payment
REVOKE EXECUTE ON FUNCTION public.fail_razorpay_payment(p_razorpay_order_id text, p_error_code text, p_error_desc text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_razorpay_payment(p_razorpay_order_id text, p_error_code text, p_error_desc text) TO authenticated;

-- generate_referral_code
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

-- insert_payment_order
REVOKE EXECUTE ON FUNCTION public.insert_payment_order(p_razorpay_order_id text, p_amount numeric, p_receipt text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_payment_order(p_razorpay_order_id text, p_amount numeric, p_receipt text) TO authenticated;

-- invest_in_project
REVOKE EXECUTE ON FUNCTION public.invest_in_project(p_project_id uuid, p_amount numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invest_in_project(p_project_id uuid, p_amount numeric) TO authenticated;

-- mark_all_notifications_read
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- reject_kyc
REVOKE EXECUTE ON FUNCTION public.reject_kyc(p_kyc_id uuid, p_reason text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_kyc(p_kyc_id uuid, p_reason text) TO authenticated;

-- set_default_bank_account
REVOKE EXECUTE ON FUNCTION public.set_default_bank_account(p_account_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_bank_account(p_account_id uuid) TO authenticated;

-- set_default_upi
REVOKE EXECUTE ON FUNCTION public.set_default_upi(p_upi_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_upi(p_upi_id uuid) TO authenticated;

-- submit_kyc
REVOKE EXECUTE ON FUNCTION public.submit_kyc(p_pan text, p_aadhaar text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_kyc(p_pan text, p_aadhaar text) TO authenticated;

-- toggle_project_active
REVOKE EXECUTE ON FUNCTION public.toggle_project_active(p_project_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_project_active(p_project_id uuid) TO authenticated;

-- update_ticket_status
REVOKE EXECUTE ON FUNCTION public.update_ticket_status(p_ticket_id uuid, p_status text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_ticket_status(p_ticket_id uuid, p_status text) TO authenticated;

-- withdraw_wallet_money
REVOKE EXECUTE ON FUNCTION public.withdraw_wallet_money(p_amount numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_wallet_money(p_amount numeric) TO authenticated;
