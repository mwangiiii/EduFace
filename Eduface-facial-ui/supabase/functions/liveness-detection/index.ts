import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    // Step 1: Authenticate to Aspect Face (with project in body—kept for now)
    const loginBody = new URLSearchParams({
      login: "DennisWanjiku_92812007",
      password: "679611920e344b4991f84727663da3ca",
      code_project: "app_fc685f43"
    });

    const loginResponse = await fetch("https://aspectface.com/api/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: loginBody
    });

    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.error("Login failed:", loginResponse.status, loginError);
      throw new Error(`Login HTTP ${loginResponse.status}: ${loginError}`);
    }

    const loginData = await loginResponse.json();
    console.log("Full login response:", JSON.stringify(loginData, null, 2));

    // Extract token—handles access_token as seen in your log
    let token;
    if (loginData.token) {
      token = loginData.token;
    } else if (loginData.access_token) {
      token = loginData.access_token;
    } else if (loginData.data && loginData.data.token) {
      token = loginData.data.token;
    } else if (loginData.auth && loginData.auth.token) {
      token = loginData.auth.token;
    } else {
      throw new Error(`No token found in response: ${JSON.stringify(loginData)}`);
    }

    if (!token) {
      throw new Error("Extracted token is empty");
    }
    console.log("Extracted token (first 20 chars):", token.substring(0, 20) + "...");

    // Step 2: Liveness API
    const authHeader = `Bearer ${token}`;
    console.log("Using auth header (first 30 chars):", authHeader.substring(0, 30) + "...");  // NEW: Confirm Bearer usage

    const livenessResponse = await fetch("https://aspectface.com/api/v1/liveness", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code_project: "app_fc685f43",
        images: [{ data: image }]
      })
    });

    if (!livenessResponse.ok) {
      const livenessError = await livenessResponse.text();
      console.error("Liveness failed:", livenessResponse.status, livenessError);
      throw new Error(`Liveness HTTP ${livenessResponse.status}: ${livenessError}`);
    }

    const result = await livenessResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});