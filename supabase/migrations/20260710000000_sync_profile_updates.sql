-- Trigger to update profile when auth.users is updated (e.g. email/phone verified)
CREATE OR REPLACE FUNCTION public.sync_profile_on_auth_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, row_security = off
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = COALESCE(NEW.email, email),
    phone = COALESCE(NEW.phone, phone),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_on_auth_update();
