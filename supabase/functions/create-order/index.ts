import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Razorpay from "npm:razorpay";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS Pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("[CreateOrder] Received request");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Authenticated User
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[CreateOrder] Auth Error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Authentication failed. Unauthorized access." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Request Body
    const { amount } = await req.json();
    const parsedAmount = Number(amount);
    console.log(`[CreateOrder] User: ${user.email}, Amount: ₹${parsedAmount}`);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 100) {
      throw new Error("Minimum investment/deposit amount is ₹100.");
    }

    // Check Razorpay Configuration
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();

    if (!keyId || !keySecret) {
      console.error("[CreateOrder] Razorpay server-side credentials missing");
      throw new Error("Razorpay integration is not fully configured on the server.");
    }

    // Initialize Razorpay
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const receiptId = `rzp_${user.id.slice(0, 8)}_${Date.now()}`;

    // 1. Create order in Razorpay System
    console.log("[CreateOrder] Calling Razorpay API...");
    const amountInPaise = Math.round(parsedAmount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
      payment_capture: 1,
    });

    console.log(`[CreateOrder] Order ID generated: ${order.id}`);

    // 2. Persist order in local Database for tracking/verification
    const { error: dbError } = await supabase
      .from("payment_orders")
      .insert({
        user_id: user.id,
        razorpay_order_id: order.id,
        amount: parsedAmount,
        currency: "INR",
        receipt: receiptId,
        status: "created"
      });

    if (dbError) {
      console.error("[CreateOrder] Database persistence error:", dbError.message);
      // We don't throw here since the Razorpay order is already created
    }

    // Return Order ID and Public Key to client
    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
        receipt: receiptId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[CreateOrder] Fatal Exception:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Could not initiate payment order." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
