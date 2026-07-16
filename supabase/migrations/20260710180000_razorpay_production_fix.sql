/*
# Production-Ready Razorpay Integration Schema

## Tables
- `payment_orders`: Tracks Razorpay order attempts
- `wallet_transactions`: Records all credits/debits for audit

## RPCs
- `confirm_razorpay_payment`: Atomic verification and wallet credit
*/

-- 1. Payment Orders table (if not exists)
CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  receipt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON payment_orders FOR SELECT USING (auth.uid() = user_id);

-- 2. Wallet Transactions (if not exists)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text,
  amount numeric NOT NULL,
  status text DEFAULT 'Completed',
  reference_id uuid, -- links to payment_orders.id
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- 3. Atomic confirmation function
CREATE OR REPLACE FUNCTION public.confirm_razorpay_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- bypass RLS for internal updates
AS $$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_new_balance numeric;
BEGIN
  -- Get user ID from the order
  SELECT user_id, id INTO v_user_id, v_order_id
  FROM payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id AND status = 'created';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active order not found or already processed';
  END IF;

  -- 1. Update order status
  UPDATE payment_orders
  SET razorpay_payment_id = p_razorpay_payment_id,
      razorpay_signature = p_razorpay_signature,
      status = 'paid',
      updated_at = now()
  WHERE id = v_order_id;

  -- 2. Update profile balance
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- 3. Record transaction
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (v_user_id, 'credit', 'Added via Razorpay', p_amount, 'Completed', v_order_id);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance
  );
END;
$$;
