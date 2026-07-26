-- ============================================================
-- Support Tickets Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

-- Schema Reload
NOTIFY pgrst, 'reload schema';
