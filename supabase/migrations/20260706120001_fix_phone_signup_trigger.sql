-- Migration: Fix signup trigger for phone and email auth users
-- Ensures auth.users inserts can create a valid profiles row for phone-based signups.

CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, row_security = off
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_avatar text;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NULLIF(split_part(v_email, '@', 1), ''),
    NULLIF(v_phone, ''),
    'User'
  );
  v_avatar := upper(left(v_name, 2));

  INSERT INTO public.profiles (
    id,
    name,
    email,
    phone,
    avatar,
    kyc_status,
    wallet_balance
  ) VALUES (
    NEW.id,
    v_name,
    v_email,
    v_phone,
    v_avatar,
    'Verified',
    10000
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_on_signup();
