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
      
      systemPrompt = `You are an expert at analyzing Portuguese utility bills and invoices from document images.
You will receive a PDF document as an image. Carefully examine ALL text visible in the document.

CRITICAL EXTRACTION RULES:
1. Company/Issuer: Look for the main company name at the top of the invoice
2. Total Amount: Find "Total a Pagar", "Valor Total", "Total" - this is usually the LARGEST number, convert to cents (multiply by 100)
3. Due Date: Look for "Data de Vencimento", "Data Limite", "Válido até" - format as YYYY-MM-DD
4. Issue Date: Look for "Data de Emissão", "Data da Fatura" - format as YYYY-MM-DD
5. Contract Number: Look for "Nº Contrato", "Nº Cliente", "Cliente"
6. Multibanco Entity: A 5-digit number near "Entidade" or "Entity" label
7. Multibanco Reference: A 9-digit number (with spaces like XXX XXX XXX) near "Referência" or "Reference" label

IMPORTANT: 
- The total amount is usually in euros with decimal (e.g., 123.45 €) - convert to cents (12345)
- Multibanco reference often has spaces (123 456 789) - remove spaces and return as 123456789
- Read carefully, these are REAL invoices with real payment information`;

      userPrompt = `Analyze this Portuguese invoice document image and extract all payment information.
Document: ${fileName}

Look carefully at the entire document and extract:
- The company name (top of document)
- Total amount to pay (usually the largest number, look for "Total")
- Payment due date
- Issue date
- Any contract/client numbers
- Multibanco payment details (Entity: 5 digits, Reference: 9 digits)`;

      toolDefinition = {
        type: "function",
        function: {
          name: "parse_invoice",
          description: "Parse Portuguese invoice from document image",
          parameters: {
            type: "object",
            properties: {
              issuer: { 
                type: "string", 
                description: "Company name found at the top of the invoice" 
              },
              category: {
                type: "string",
                enum: ["Eletricidade", "Água", "Gás", "Internet", "Telecomunicações", "Seguro"],
                description: "Service category based on the company"
              },
              amount_cents: { 
                type: "integer", 
                description: "Total amount in cents (euros × 100). Look for largest number or 'Total a Pagar'" 
              },
              due_date: { 
                type: "string", 
                description: "Payment due date in YYYY-MM-DD format" 
              },
              issue_date: { 
                type: "string", 
                description: "Invoice issue date in YYYY-MM-DD format" 
              },
              contract_number: { 
                type: "string", 
                description: "Contract or client number if visible" 
              },
              multibanco_entity: { 
                type: "string", 
                description: "5-digit Multibanco entity number" 
              },
              multibanco_reference: { 
                type: "string", 
                description: "9-digit Multibanco reference (remove spaces)" 
              },
            },
            required: ["issuer", "category", "amount_cents"],
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

    // Prepare messages - for PDF, send as vision/image input
    const messages: any[] = [{ role: "system", content: systemPrompt }];
    
    if (pdfData) {
      // Send PDF as image for vision analysis
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { 
            type: "image_url", 
            image_url: { url: pdfData }
          }
        ]
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
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
      
      // Store Multibanco details in parsed_fields
      if (result.multibanco_entity || result.multibanco_reference) {
        result.parsed_fields = {
          multibanco_entity: result.multibanco_entity || null,
          multibanco_reference: result.multibanco_reference || null,
        };
      }
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
