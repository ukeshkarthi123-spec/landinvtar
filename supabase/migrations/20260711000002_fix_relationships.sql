-- ==========================================
-- FIX RELATIONSHIPS FOR POSTGREST (SUPABASE)
-- ==========================================

-- Direct foreign keys to profiles table allow Supabase to detect
-- relationships in the public schema, enabling joins like .select('*, profiles(*)')

-- 1. wallet_transactions
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. investments
ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. payment_orders
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_user_id_fkey;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. notifications
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. kyc_documents
ALTER TABLE public.kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_fkey;
ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. bank_accounts
ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_user_id_fkey;
ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 7. upi_ids
ALTER TABLE public.upi_ids DROP CONSTRAINT IF EXISTS upi_ids_user_id_fkey;
ALTER TABLE public.upi_ids
  ADD CONSTRAINT upi_ids_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 8. support_tickets
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 9. referrals
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_user_id_fkey;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 10. tax_reports
ALTER TABLE public.tax_reports DROP CONSTRAINT IF EXISTS tax_reports_user_id_fkey;
ALTER TABLE public.tax_reports
  ADD CONSTRAINT tax_reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
