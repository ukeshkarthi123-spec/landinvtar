-- ==========================================
-- CLEAN SCHEMA CONFLICTS & AMBIGUOUS FKEYS
-- ==========================================

-- This migration removes all duplicate or ambiguous foreign keys
-- and establishes a single, standard naming convention for all relationships.

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- 1. Identify and drop all foreign key constraints on user-owned tables
    -- that might be duplicates or pointing to auth.users instead of public.profiles
    FOR constraint_record IN
        SELECT
            conname,
            relname
        FROM
            pg_constraint c
        JOIN
            pg_class t ON c.conrelid = t.oid
        JOIN
            pg_namespace s ON t.relnamespace = s.oid
        WHERE
            s.nspname = 'public'
            AND c.contype = 'f'
            AND t.relname IN (
                'investments',
                'wallet_transactions',
                'payment_orders',
                'notifications',
                'kyc_documents',
                'bank_accounts',
                'upi_ids',
                'support_tickets',
                'referrals',
                'tax_reports'
            )
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', constraint_record.relname, constraint_record.conname);
    END LOOP;
END $$;

-- 2. RE-ESTABLISH CLEAN, SINGLE RELATIONSHIPS

-- INVESTMENTS
ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT investments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.land_projects(id) ON DELETE CASCADE;

-- WALLET TRANSACTIONS
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- PAYMENT ORDERS
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- NOTIFICATIONS
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- KYC DOCUMENTS
ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- FEATURE TABLES
ALTER TABLE public.bank_accounts ADD CONSTRAINT bank_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.upi_ids ADD CONSTRAINT upi_ids_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.tax_reports ADD CONSTRAINT tax_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
