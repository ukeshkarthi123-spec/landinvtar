-- ==========================================
-- COMPREHENSIVE ACTIVITY LOGGING SYSTEM
-- ==========================================

-- 1. Create the activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    email TEXT,
    role TEXT,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    ip_address TEXT,
    device TEXT,
    browser TEXT,
    status TEXT DEFAULT 'success',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- 3. RLS Policies
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs" ON public.activity_logs
FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can insert logs" ON public.activity_logs
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 4. Automatic Logging Triggers

-- Trigger Function for Profiles (User Created/Updated/Admin Actions)
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (user_id, email, role, module, action, description, status)
        VALUES (NEW.id, NEW.email, NEW.role, 'User Management', 'User Created', 'New user account created for ' || NEW.email, 'success');
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.kyc_status != NEW.kyc_status) THEN
            INSERT INTO public.activity_logs (user_id, email, role, module, action, description, status)
            VALUES (NEW.id, NEW.email, NEW.role, 'KYC', 'KYC Status Changed', 'KYC status updated from ' || OLD.kyc_status || ' to ' || NEW.kyc_status, 'success');
        ELSIF (OLD.role != NEW.role OR OLD.is_admin != NEW.is_admin) THEN
            INSERT INTO public.activity_logs (user_id, email, role, module, action, description, status)
            VALUES (NEW.id, NEW.email, NEW.role, 'Permissions', 'Role Updated', 'User role updated for ' || NEW.email, 'success');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_profile_changes
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_changes();

-- Trigger Function for Investments
CREATE OR REPLACE FUNCTION public.log_investment_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user public.profiles%ROWTYPE;
    v_project public.land_projects%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.profiles WHERE id = NEW.user_id;
    SELECT * INTO v_project FROM public.land_projects WHERE id = NEW.project_id;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (user_id, email, role, module, action, description, status)
        VALUES (NEW.user_id, v_user.email, v_user.role, 'Investments', 'New Investment', 'Invested ₹' || NEW.amount || ' in ' || v_project.name, 'success');
    ELSIF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        INSERT INTO public.activity_logs (user_id, email, role, module, action, description, status)
        VALUES (NEW.user_id, v_user.email, v_user.role, 'Investments', 'Investment Updated', 'Investment status for ' || v_project.name || ' changed to ' || NEW.status, 'success');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_investment_activity
AFTER INSERT OR UPDATE ON public.investments
FOR EACH ROW EXECUTE FUNCTION public.log_investment_activity();

-- Trigger Function for Payment Orders
CREATE OR REPLACE FUNCTION public.log_payment_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.profiles WHERE id = NEW.user_id;

    IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        INSERT INTO public.activity_logs (user_id, email, role, module, action, description, status)
        VALUES (NEW.user_id, v_user.email, v_user.role, 'Payments', 'Payment ' || INITCAP(NEW.status), 'Payment order ' || NEW.razorpay_order_id || ' status changed to ' || NEW.status,
                CASE WHEN NEW.status = 'failed' THEN 'failed' ELSE 'success' END);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_payment_activity
AFTER UPDATE ON public.payment_orders
FOR EACH ROW EXECUTE FUNCTION public.log_payment_activity();

-- Trigger Function for Land Projects
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (module, action, description, status)
        VALUES ('Projects', 'Project Created', 'New project created: ' || NEW.name, 'success');
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.is_active != NEW.is_active) THEN
            INSERT INTO public.activity_logs (module, action, description, status)
            VALUES ('Projects', 'Project Visibility', 'Project ' || NEW.name || ' is now ' || CASE WHEN NEW.is_active THEN 'Active' ELSE 'Inactive' END, 'success');
        ELSE
            INSERT INTO public.activity_logs (module, action, description, status)
            VALUES ('Projects', 'Project Updated', 'Project details updated for: ' || NEW.name, 'success');
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.activity_logs (module, action, description, status)
        VALUES ('Projects', 'Project Deleted', 'Project deleted: ' || OLD.name, 'success');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_project_activity
AFTER INSERT OR UPDATE OR DELETE ON public.land_projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_activity();

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs(module);
