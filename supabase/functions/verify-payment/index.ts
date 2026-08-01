import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
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
      console.error("[VerifyPayment] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

    console.log(`[VerifyPayment] Payload:`, payload);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("[VerifyPayment] Missing mandatory fields in request");
      throw new Error("Missing mandatory payment fields (order_id, payment_id, or signature)");
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
    if (!keySecret) {
      console.error("[VerifyPayment] RAZORPAY_KEY_SECRET is not set in Supabase Secrets");
      throw new Error("Razorpay integration is partially configured on server. Contact admin.");
    }

    // 1. Compute HMAC SHA256 Signature for verification
    const encoder = new TextEncoder();
    const verificationData = `${razorpay_order_id}|${razorpay_payment_id}`;

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(verificationData));
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (computedSignature !== razorpay_signature) {
      console.error("[VerifyPayment] Signature mismatch detected!");

      try {
        await supabase.rpc('fail_razorpay_payment', {
          p_razorpay_order_id: razorpay_order_id,
          p_error_code: 'SIGNATURE_MISMATCH',
          p_error_desc: 'Computed signature did not match provided Razorpay signature.'
        });
      } catch (rpcError: any) {
        console.error("[VerifyPayment] fail_razorpay_payment RPC failed:", rpcError?.message);
      }

      return new Response(
        JSON.stringify({ error: "Invalid payment signature. Verification failed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch original order to get the verified amount
    const { data: orderRecord, error: fetchError } = await supabase
      .from('payment_orders')
      .select('amount, status, user_id')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (fetchError || !orderRecord) {
      console.error("[VerifyPayment] Order record not found for ID:", razorpay_order_id);
      throw new Error("Payment order record could not be found in our database.");
    }

    if (orderRecord.status === 'paid') {
      console.log("[VerifyPayment] Order already marked as paid.");
      return new Response(
        JSON.stringify({ success: true, message: "Payment already verified." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Confirm Payment (Update Wallet + Transactions via RPC)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_razorpay_payment', {
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_razorpay_signature: razorpay_signature,
      p_amount: orderRecord.amount
    });

    if (rpcError) {
      console.error("[VerifyPayment] confirm_razorpay_payment failed:", rpcError.message);
      throw new Error("Wallet update failed: " + rpcError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified and wallet credited successfully.",
        new_balance: rpcResult.new_balance
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[VerifyPayment] Exception:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Internal verification error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
