export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 1. Handle browser preflight CORS checks
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // 2. Handle POST requests from the Ask AI chat prompt
    if (request.method === "POST") {
      try {
        const body = await request.json();
        // Process AI request or prompt using body.prompt / body.message

        const aiResponse = { answer: "Worker processed your request successfully!" };

        return new Response(JSON.stringify(aiResponse), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Return default response for GET
    return new Response(JSON.stringify({ status: "Worker is live!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
