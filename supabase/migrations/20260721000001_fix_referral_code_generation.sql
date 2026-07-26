-- Fix referral code generation by removing dependency on pgcrypto's gen_random_bytes
-- This resolves the "function gen_random_bytes(integer) does not exist" error.

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check if the user already has a referral code
  -- We look for an entry where referred_email is NULL (this is the user's own code)
  SELECT referral_code INTO v_code
  FROM public.referrals
  WHERE user_id = v_user_id AND referred_email IS NULL
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- 2. Generate a new unique code if none exists
  -- Using md5 of a random number and timestamp to ensure randomness without pgcrypto
  -- Taking first 8 characters and making them uppercase
  LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    -- Ensure uniqueness in the referrals table
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referrals WHERE referral_code = v_code);
  END LOOP;

  -- 3. Insert the user's own referral code entry
  INSERT INTO public.referrals (user_id, referral_code, referred_email, status, reward_amount)
  VALUES (v_user_id, v_code, NULL, 'Pending', 0);

  RETURN v_code;
END;
$$;

-- Ensure only authenticated users can call this
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;
