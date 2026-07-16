/*
# Razorpay Payment Integration

## New Tables

### 1. payment_orders
Stores Razorpay order details for payment tracking.
- id (uuid): primary key
- user_id (uuid): references auth.users
- razorpay_order_id (text): Razorpay order ID
- razorpay_payment_id (text): Razorpay payment ID (after payment)
- razorpay_signature (text): Payment signature (for verification)
- amount (numeric): Order amount in INR
- currency (text): Default 'INR'
- status (text): 'created', 'paid', 'failed', 'refunded'
- notes (jsonb): Additional metadata
- created_at / updated_at timestamps

## Server Functions
- create_razorpay_order(p_amount): Creates a Razorpay order via Edge Function
- verify_razorpay_payment(p_order_id, p_payment_id, p_signature): Verifies payment and credits wallet
- handle_payment_failure(p_order_id): Records failed payment
*/

-- ============================================================
-- PAYMENT ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' 
    CHECK (status IN ('created', 'paid', 'failed', 'refunded', 'attempted')),
  receipt text,
  notes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payment_orders" ON payment_orders;
CREATE POLICY "select_own_payment_orders" ON payment_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payment_orders" ON payment_orders;
CREATE POLICY "insert_own_payment_orders" ON payment_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payment_orders" ON payment_orders;
CREATE POLICY "update_own_payment_orders" ON payment_orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at DESC);

-- ============================================================
-- SERVER FUNCTION: confirm_razorpay_payment
-- Called after successful payment verification to credit wallet
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_razorpay_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_order payment_orders%ROWTYPE;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the order and lock it
  SELECT * INTO v_order
  FROM payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  -- Verify amount matches
  IF v_order.amount != p_amount THEN
    RAISE EXCEPTION 'Amount mismatch. Order: %, Provided: %', v_order.amount, p_amount;
  END IF;

  -- Check if already paid
  IF v_order.status = 'paid' THEN
    RAISE EXCEPTION 'Payment already processed';
  END IF;

  -- Update payment order with payment details
  UPDATE payment_orders
  SET razorpay_payment_id = p_razorpay_payment_id,
      razorpay_signature = p_razorpay_signature,
      status = 'paid',
      updated_at = now()
  WHERE id = v_order.id;

  -- Credit wallet
  UPDATE profiles
  SET wallet_balance = wallet_balance + p_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Create wallet transaction
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (v_user_id, 'credit', 'Added via Razorpay', p_amount, 'Completed', v_order.id)
  RETURNING id INTO v_transaction_id;

  -- Create success notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_user_id,
    'Money Added Successfully!',
    '₹' || to_char(p_amount, 'FM999,999,999') || ' has been credited to your wallet.',
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- ============================================================
-- SERVER FUNCTION: fail_razorpay_payment
-- Records failed payment attempt
-- ============================================================
CREATE OR REPLACE FUNCTION public.fail_razorpay_payment(
  p_razorpay_order_id text,
  p_error_code text DEFAULT NULL,
  p_error_desc text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_order payment_orders%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the order
  SELECT * INTO v_order
  FROM payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  -- Update payment order status
  UPDATE payment_orders
  SET status = 'failed',
      notes = jsonb_set(
        COALESCE(notes, '{}'::jsonb),
        '{error}',
        jsonb_build_object(
          'code', p_error_code,
          'description', p_error_desc,
          'timestamp', now()
        )
      ),
      updated_at = now()
  WHERE id = v_order.id;

  -- Create failed transaction record
  INSERT INTO wallet_transactions (user_id, type, description, amount, status, reference_id)
  VALUES (v_user_id, 'credit', 'Failed payment attempt', v_order.amount, 'Failed', v_order.id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment failure recorded'
  );
END;
$$;

-- ============================================================
-- SERVER FUNCTION: insert_payment_order
-- Creates a payment order record after Razorpay order creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_payment_order(
  p_razorpay_order_id text,
  p_amount numeric,
  p_receipt text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO payment_orders (
    user_id,
    razorpay_order_id,
    amount,
    receipt,
    status
  )
  VALUES (
    v_user_id,
    p_razorpay_order_id,
    p_amount,
    p_receipt,
    'created'
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'razorpay_order_id', p_razorpay_order_id
  );
END;
$$;
