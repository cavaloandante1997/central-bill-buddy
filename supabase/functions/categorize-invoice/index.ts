import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { issuer, parsedFields } = await req.json();
    console.log("Categorizing invoice for issuer:", issuer);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from parsed fields
    const context = parsedFields ? JSON.stringify(parsedFields) : "No additional data";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at categorizing Portuguese utility bills and invoices. 
Based on the company name and invoice data, determine:
1. The service category (one of: electricity, water, gas, internet, telecomunicações, telefone, seguro, insurance)
2. A brief description of what the company provides

Return ONLY a JSON object with this exact structure:
{
  "category": "category_name",
  "description": "brief description"
}`,
          },
          {
            role: "user",
            content: `Categorize this Portuguese company/service:
Company name: ${issuer}
Additional context: ${context}`,
          },
        ],
        temperature: 0.2,
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_service",
              description: "Categorize a Portuguese utility or service provider",
              parameters: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: [
                      "electricity",
                      "eletricidade",
                      "water",
                      "água",
                      "gas",
                      "gás",
                      "internet",
                      "telecomunicações",
                      "telefone",
                      "mobile",
                      "seguro",
                      "insurance",
                    ],
                  },
                  description: {
                    type: "string",
                    description: "Brief description of what the company provides",
                  },
                },
                required: ["category", "description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "categorize_service" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Categorization result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in categorize-invoice:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
