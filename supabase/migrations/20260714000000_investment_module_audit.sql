-- ============================================================
-- INVESTMENT MODULE AUDIT & FIXES
-- ============================================================

-- 1. Create investment_history table if it doesn't exist
-- This table tracks every state change of an investment for auditing.
CREATE TABLE IF NOT EXISTS public.investment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.investment_history ENABLE ROW LEVEL SECURITY;

-- Admins can do everything, users can only view their own history
CREATE POLICY "Admins can manage investment_history"
  ON public.investment_history FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users can view own investment_history"
  ON public.investment_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Add indexes for performance if missing
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_project_id ON public.investments(project_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_id ON public.wallet_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_investment_history_investment_id ON public.investment_history(investment_id);

-- 3. Ensure foreign keys and relationships are verified
-- (Already handled by REFERENCES in CREATE TABLE statements in previous migrations)

-- 4. Fix/Enhance is_admin logic to be more robust
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role IN ('admin', 'super_admin') OR is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to automatically record history on investment status change
CREATE OR REPLACE FUNCTION public.on_investment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.investment_history (investment_id, user_id, new_status, amount, description)
    VALUES (NEW.id, NEW.user_id, NEW.status, NEW.amount, 'Initial investment created');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.investment_history (investment_id, user_id, previous_status, new_status, amount, description)
    VALUES (NEW.id, NEW.user_id, OLD.status, NEW.status, NEW.amount, 'Status updated from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_investment_status_change ON public.investments;
CREATE TRIGGER tr_investment_status_change
  AFTER INSERT OR UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.on_investment_status_change();

-- 6. Grant permissions
GRANT ALL ON public.investment_history TO authenticated;
GRANT ALL ON public.investment_history TO service_role;
