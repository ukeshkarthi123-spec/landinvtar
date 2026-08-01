-- ============================================================
-- FIX ADMIN RELATIONSHIPS
-- ============================================================

-- Ensure Support Tickets have a robust relationship to Profiles
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure Investments have robust relationships
ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_user_id_profiles_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_project_id_land_projects_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_project_id_land_projects_fkey
  FOREIGN KEY (project_id) REFERENCES public.land_projects(id) ON DELETE CASCADE;

-- Ensure KYC Documents have robust relationship
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_profiles_fkey;
ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure Payment Orders have robust relationship
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_user_id_profiles_fkey;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure Wallet Transactions have robust relationship
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_profiles_fkey;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- FORCE SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
