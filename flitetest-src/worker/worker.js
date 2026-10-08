export default {
  async fetch(request, env, ctx) {
    // Universal CORS headers to eliminate preflight mismatches
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 1. Handle browser preflight checks (OPTIONS requests)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 2. Handle POST requests from the "Ask AI" chat widget
    if (request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));

        // Accept prompt, message, or chat message array payloads
        const prompt =
          body.prompt ||
          body.message ||
          (Array.isArray(body.messages)
            ? body.messages[body.messages.length - 1]?.content
            : null);

        if (!prompt) {
          return new Response(
            JSON.stringify({ error: "Missing prompt or message in request body." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        let answerText = "";

        // Query Cloudflare Workers AI binding if present
        if (env.AI) {
          const modelName = env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

          const aiResponse = await env.AI.run(modelName, {
            messages: [
              {
                role: "system",
                content:
                  "You are an AI assistant for the Brunswick High School ARC 2027 flight test and OpenRocket dashboard. Provide concise, helpful responses on rocket stability, apogee, flight profiles, and competition rules.",
              },
              { role: "user", content: prompt },
            ],
          });

          answerText = aiResponse.response || "No response text returned from AI model.";
        } else {
          // Fallback message if AI binding is not configured in wrangler.toml/dashboard
          answerText = "Worker received prompt successfully! (Note: 'AI' binding is missing in wrangler.toml or dashboard).";
        }

        return new Response(
          JSON.stringify({ answer: answerText, status: "success" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message || "Internal Worker error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 3. Status endpoint for standard GET requests
    return new Response(
      JSON.stringify({ status: "Worker is live!", service: "flitetest" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  },
};
