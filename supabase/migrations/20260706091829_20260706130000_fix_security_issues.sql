/*
# Fix security issues: mutable search_path and public EXECUTE on SECURITY DEFINER functions

## Summary
This migration addresses two categories of security findings:
1. Function Search Path Mutable — 9 SECURITY DEFINER functions had a role-mutable search_path, allowing a caller to influence which schema objects the function resolves. We pin each to `public`.
2. Public Can Execute SECURITY DEFINER Function — 19 SECURITY DEFINER functions were executable by the `anon` role. Since this app requires sign-in (login screen exists) and every function already checks `auth.uid()` internally, anon execution is never legitimate. We REVOKE EXECUTE FROM `anon` on all of them. `authenticated` retains EXECUTE.

Note: Leaked password protection (HaveIBeenPwned) is an Auth config toggle that cannot be set via SQL in this environment; it must be enabled in the Supabase dashboard under Authentication > Settings.

## Changes
### 1. Pin search_path on 9 functions
- `update_ticket_status(p_ticket_id uuid, p_status text)`
- `set_default_bank_account(p_account_id uuid)`
- `set_default_upi(p_upi_id uuid)`
- `generate_referral_code()`
- `submit_kyc(p_pan text, p_aadhaar text)`
- `add_support_message(p_ticket_id uuid, p_message text)`
- `toggle_project_active(p_project_id uuid)`
- `approve_kyc(p_kyc_id uuid)`
- `reject_kyc(p_kyc_id uuid, p_reason text)`

Each gets `ALTER FUNCTION ... SET search_path TO public`, which pins the schema lookup path so a caller cannot redirect unqualified object references to a malicious schema. This is a non-destructive metadata change — function bodies are untouched.

### 2. Revoke EXECUTE from anon on all 19 SECURITY DEFINER functions
Functions (all in public schema):
- add_support_message, add_to_investment, add_wallet_money, approve_kyc,
  confirm_razorpay_payment, create_profile_on_signup, exit_investment,
  fail_razorpay_payment, generate_referral_code, insert_payment_order,
  invest_in_project, mark_all_notifications_read, reject_kyc,
  set_default_bank_account, set_default_upi, submit_kyc,
  toggle_project_active, update_ticket_status, withdraw_wallet_money

`REVOKE EXECUTE ON FUNCTION ... FROM anon;` for each. `authenticated` keeps default EXECUTE so signed-in users can still call them. Each function body already validates `auth.uid()` and raises 'Not authenticated' when null, so this is defense-in-depth, not a behavior change for the app.

## Security impact
- No data is modified or deleted.
- No function bodies change — only metadata (search_path, grants).
- anon role can no longer invoke any SECURITY DEFINER RPC; only authenticated users can.
*/

-- 1. Pin search_path on the 9 flagged functions
ALTER FUNCTION public.update_ticket_status(p_ticket_id uuid, p_status text) SET search_path TO public;
ALTER FUNCTION public.set_default_bank_account(p_account_id uuid) SET search_path TO public;
ALTER FUNCTION public.set_default_upi(p_upi_id uuid) SET search_path TO public;
ALTER FUNCTION public.generate_referral_code() SET search_path TO public;
ALTER FUNCTION public.submit_kyc(p_pan text, p_aadhaar text) SET search_path TO public;
ALTER FUNCTION public.add_support_message(p_ticket_id uuid, p_message text) SET search_path TO public;
ALTER FUNCTION public.toggle_project_active(p_project_id uuid) SET search_path TO public;
ALTER FUNCTION public.approve_kyc(p_kyc_id uuid) SET search_path TO public;
ALTER FUNCTION public.reject_kyc(p_kyc_id uuid, p_reason text) SET search_path TO public;

-- 2. Revoke EXECUTE from anon on all 19 SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.add_support_message(p_ticket_id uuid, p_message text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_to_investment(p_investment_id uuid, p_amount numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_wallet_money(p_amount numeric, p_method text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_kyc(p_kyc_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_razorpay_payment(p_razorpay_order_id text, p_razorpay_payment_id text, p_razorpay_signature text, p_amount numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_profile_on_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.exit_investment(p_investment_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fail_razorpay_payment(p_razorpay_order_id text, p_error_code text, p_error_desc text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_payment_order(p_razorpay_order_id text, p_amount numeric, p_receipt text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invest_in_project(p_project_id uuid, p_amount numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_kyc(p_kyc_id uuid, p_reason text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_default_bank_account(p_account_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_default_upi(p_upi_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_kyc(p_pan text, p_aadhaar text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_project_active(p_project_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_ticket_status(p_ticket_id uuid, p_status text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_wallet_money(p_amount numeric) FROM anon;
