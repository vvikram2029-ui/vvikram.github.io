export default {
  async fetch(request, env, ctx) {
    // Read origin setting from wrangler.toml or fall back to production domain
    const allowedOrigin = env.ALLOWED_ORIGINS || "https://omarsalmon.pages.dev";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 1. Handle browser CORS preflight checks
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
        
        // Support prompt, message, or chat message array payloads
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

        // Check if Cloudflare Workers AI binding is configured
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
          // Fallback if AI binding is not yet attached in dashboard
          answerText = "Worker received prompt successfully! (Note: 'AI' binding is missing in wrangler.toml/dashboard).";
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

    // 3. Default GET response for status check
    return new Response(
      JSON.stringify({ status: "Worker is live!", service: "flitetest" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  },
};
