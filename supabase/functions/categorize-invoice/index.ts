import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URLS: Record<string, string> = {
  "edp": "https://www.edp.pt/sites/default/files/2021-09/logo-edp.svg",
  "meo": "https://www.meo.pt/_layouts/images/meo-logo.svg",
  "nos": "https://www.nos.pt/Style%20Library/img/logos/nos-logo.svg",
  "vodafone": "https://www.vodafone.pt/content/dam/vodafone/images/logos/vodafone-logo.svg",
  "epal": "https://www.epal.pt/EPAL/media/Images/logo-epal.png",
  "galp": "https://www.galp.com/corp/Portals/0/Recursos/Imagens/logotipo.png",
};

function findLogoUrl(issuer: string): string | null {
  const issuerLower = issuer.toLowerCase();
  for (const [key, url] of Object.entries(LOGO_URLS)) {
    if (issuerLower.includes(key)) {
      return url;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { issuer, parsedFields, pdfData, fileName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    let toolDefinition: any;

    // Different handling for PDF upload vs simple categorization
    if (pdfData) {
      console.log("Processing PDF invoice:", fileName);
      systemPrompt = `You are an expert at parsing and categorizing Portuguese utility bills and invoices.
Analyze the invoice data and extract:
1. Company/issuer name
2. Invoice amount (in cents as integer)
3. Due date (YYYY-MM-DD format)
4. Issue date if available (YYYY-MM-DD format)
5. Contract/client number if available
6. Service category

Return accurate extracted data.`;

      userPrompt = `Parse this Portuguese invoice. The file is: ${fileName}
Extract all relevant billing information including company name, amounts, dates, and contract numbers.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "parse_invoice",
          description: "Parse and categorize a Portuguese invoice",
          parameters: {
            type: "object",
            properties: {
              issuer: { type: "string", description: "Company or service provider name (e.g., EDP, MEO, NOS, Vodafone)" },
              category: {
                type: "string",
                enum: ["Eletricidade", "Água", "Gás", "Internet", "Telecomunicações", "Seguro"],
              },
              amount_cents: { type: "integer", description: "Amount in cents" },
              due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
              issue_date: { type: "string", description: "Issue date in YYYY-MM-DD format" },
              contract_number: { type: "string", description: "Contract or client number" },
            },
            required: ["issuer", "category"],
            additionalProperties: false,
          },
        },
      };
    } else {
      console.log("Categorizing invoice for issuer:", issuer);
      const context = parsedFields ? JSON.stringify(parsedFields) : "No additional data";
      
      systemPrompt = `You are an expert at categorizing Portuguese utility bills and invoices.
Based on the company name, determine the service category and provide a description.`;

      userPrompt = `Categorize this Portuguese company/service:
Company name: ${issuer}
Additional context: ${context}`;

      toolDefinition = {
        type: "function",
        function: {
          name: "categorize_service",
          description: "Categorize a Portuguese utility or service provider",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["Eletricidade", "Água", "Gás", "Internet", "Telecomunicações", "Seguro"],
              },
              description: { type: "string", description: "Brief description" },
            },
            required: ["category", "description"],
            additionalProperties: false,
          },
        },
      };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: pdfData ? "parse_invoice" : "categorize_service" } },
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

    // Add logo URL if parsing invoice
    if (pdfData && result.issuer) {
      const logoUrl = findLogoUrl(result.issuer);
      result.logo_url = logoUrl;
    }

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
