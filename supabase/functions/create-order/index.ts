import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Razorpay from "npm:razorpay";

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
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Razorpay credentials
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("[Razorpay] Credentials not configured in secrets");
      return new Response(
        JSON.stringify({ error: "Razorpay credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount } = await req.json();
    if (!amount || amount < 1) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const receipt = `rcpt_${user.id.slice(0, 8)}_${Date.now()}`;

    // Create Razorpay Order
    console.log(`[Razorpay] Creating order for ₹${amount}`);
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to paise
      currency: "INR",
      receipt: receipt,
      payment_capture: 1,
    });

    // Store in payment_orders table
    const { error: dbError } = await supabase
      .from("payment_orders")
      .insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        amount: amount,
        currency: "INR",
        receipt: receipt,
        status: "created"
      });

    if (dbError) {
      console.error("[Razorpay] Database log error:", dbError.message);
      // We continue as the order is already created in Razorpay
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: order.amount, // in paise
        currency: order.currency,
        key_id: razorpayKeyId, // Need this for frontend Checkout
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Razorpay] Create Order Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
