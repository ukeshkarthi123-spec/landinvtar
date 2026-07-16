import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
    if (!razorpayKeySecret) throw new Error("Razorpay secret not configured");

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing payment verification details");
    }

    // 1. Verify HMAC Signature
    const encoder = new TextEncoder();
    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(razorpayKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (computedSignature !== razorpay_signature) {
      console.error("[Razorpay] Invalid signature detected");
      // Record failure in DB
      await supabase.rpc('fail_razorpay_payment', {
        p_razorpay_order_id: razorpay_order_id,
        p_error_code: 'INVALID_SIGNATURE',
        p_error_desc: 'Signature mismatch'
      });

      return new Response(
        JSON.stringify({ error: "Invalid payment signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch the original order to get amount
    const { data: orderData, error: fetchError } = await supabase
      .from('payment_orders')
      .select('amount')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (fetchError || !orderData) {
      throw new Error("Order records not found");
    }

    // 3. Confirm Payment (Update Wallet + Transactions via RPC)
    // We use the RPC defined in migrations for atomic transaction safety
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_razorpay_payment', {
      p_razorpay_order_id,
      p_razorpay_payment_id,
      p_razorpay_signature,
      p_amount: orderData.amount
    });

    if (rpcError) {
      console.error("[Razorpay] confirm RPC error:", rpcError.message);
      return new Response(
        JSON.stringify({ error: "Failed to update wallet: " + rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified and wallet credited",
        new_balance: rpcResult.new_balance
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Razorpay] Verify Payment Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
