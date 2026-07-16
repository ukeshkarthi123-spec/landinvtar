-- ============================================================
-- DEFINITIVE SCHEMA RELATIONSHIP FIX
-- ============================================================

-- This migration ensures that all user-related tables point to public.profiles
-- instead of auth.users. This allows Supabase/PostgREST to automatically
-- detect relationships for joins like .select('*, profiles(*)').

-- 1. REPAIR INVESTMENTS
ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_project_id_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_project_id_land_projects_fkey
  FOREIGN KEY (project_id) REFERENCES public.land_projects(id) ON DELETE CASCADE;

-- 2. REPAIR PAYMENT ORDERS
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_user_id_fkey;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. REPAIR WALLET TRANSACTIONS
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. REPAIR NOTIFICATIONS
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. REPAIR KYC DOCUMENTS
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_fkey;
ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. REPAIR OTHER FEATURE TABLES
ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_user_id_fkey;
ALTER TABLE public.bank_accounts ADD CONSTRAINT bank_accounts_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.upi_ids DROP CONSTRAINT IF EXISTS upi_ids_user_id_fkey;
ALTER TABLE public.upi_ids ADD CONSTRAINT upi_ids_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_user_id_fkey;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.tax_reports DROP CONSTRAINT IF EXISTS tax_reports_user_id_fkey;
ALTER TABLE public.tax_reports ADD CONSTRAINT tax_reports_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 7. FORCE SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
