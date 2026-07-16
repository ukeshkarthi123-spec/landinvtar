import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LandValueRequest {
  todayValue: number;
  growthRate: number;
}

interface LandValueResponse {
  success: boolean;
  data?: {
    todayValue: number;
    growthRate: number;
    tomorrowValue: number;
    growthAmount: number;
  };
  error?: string;
}

function calculateLandValue(todayValue: number, growthRate: number): LandValueResponse {
  // Validate inputs
  if (!Number.isFinite(todayValue) || todayValue < 0) {
    return {
      success: false,
      error: "Today's value must be a non-negative number",
    };
  }

  if (!Number.isFinite(growthRate)) {
    return {
      success: false,
      error: "Growth rate must be a valid number",
    };
  }

  // Calculate tomorrow's value using the formula: Tomorrow's Value = Today's Value × (1 + (Growth Rate / 100))
  const growthMultiplier = 1 + growthRate / 100;
  const tomorrowValue = todayValue * growthMultiplier;
  const growthAmount = tomorrowValue - todayValue;

  return {
    success: true,
    data: {
      todayValue: Number(todayValue.toFixed(2)),
      growthRate: Number(growthRate.toFixed(3)),
      tomorrowValue: Number(tomorrowValue.toFixed(2)),
      growthAmount: Number(growthAmount.toFixed(2)),
    },
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only POST requests are supported",
        }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as LandValueRequest;
    const { todayValue, growthRate } = body;

    // Validate required fields
    if (todayValue === undefined || todayValue === null) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "todayValue is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (growthRate === undefined || growthRate === null) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "growthRate is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate land value
    const result = calculateLandValue(todayValue, growthRate);

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error in calculate-land-value function:", errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
