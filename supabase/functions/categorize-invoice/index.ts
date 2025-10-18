import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_DEV_TOKEN = "live_6a1a28fd-6420-4492-aeb0-b297461d9de2";

type Company = { name: string; domain: string; aliases?: string[] };

const COMPANIES: Company[] = [
  { name: "EDP", domain: "edp.pt" },
  { name: "Galp", domain: "galp.com" },
  { name: "Iberdrola", domain: "iberdrola.pt" },
  { name: "Goldenergy", domain: "goldenergy.pt" },
  { name: "Endesa", domain: "endesa.pt" },
  { name: "Plenitude", domain: "plenitude.pt" },
  { name: "Repsol", domain: "repsol.pt" },
  { name: "ENGIE", domain: "engie.pt" },
  { name: "AdP", domain: "adp.pt", aliases: ["Águas de Portugal", "Aguas de Portugal"] },
  { name: "EPAL", domain: "epal.pt" },
  { name: "MEO", domain: "meo.pt" },
  { name: "NOS", domain: "nos.pt" },
  { name: "Vodafone", domain: "vodafone.pt", aliases: ["Vodafone Portugal"] },
  { name: "NOWO", domain: "nowo.pt" },
  { name: "DIGI", domain: "digi.pt", aliases: ["Digi Portugal"] },
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .trim();

function simpleScore(query: string, candidate: string): number {
  if (query === candidate) return 1;
  if (candidate.startsWith(query) || query.startsWith(candidate)) return 0.9;
  if (candidate.includes(query) || query.includes(candidate)) return 0.8;
  return 0;
}

function findCompanyDomain(ocrName: string): string | null {
  const q = normalize(ocrName);
  // exact/alias match first
  for (const c of COMPANIES) {
    const names = [c.name, ...(c.aliases ?? [])].map(normalize);
    if (names.includes(q)) return c.domain;
  }
  // fuzzy fallback
  let best: { domain: string; score: number } | null = null;
  for (const c of COMPANIES) {
    for (const n of [c.name, ...(c.aliases ?? [])]) {
      const score = simpleScore(q, normalize(n));
      if (!best || score > best.score) best = { domain: c.domain, score };
    }
  }
  return best && best.score >= 0.8 ? best.domain : null;
}

function logoUrlFor(ocrName: string): string | null {
  const domain = findCompanyDomain(ocrName);
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&format=webp&retina=true&size=128`;
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
You will receive an invoice image. Carefully examine ALL text visible in the document.

CRITICAL EXTRACTION RULES - FOLLOW EXACTLY:
1. Company/Issuer: Look at the TOP of the invoice for the main company logo/name (EDP, MEO, NOS, Vodafone, DIGI, Galp, EPAL, etc.)
2. Total Amount: Find the FINAL AMOUNT TO PAY:
   - Look for: "Total a Pagar", "Valor Total", "Montante", "Total Fatura"
   - This is usually the LARGEST number on the invoice
   - Convert to cents: 45.67€ becomes 4567 (multiply by 100, remove decimals)
   - DO NOT confuse with subtotals or previous amounts
3. Due Date: Look for "Data de Vencimento", "Data Limite de Pagamento", "Válido até", "Pagar até"
   - Format as YYYY-MM-DD
4. Issue Date: Look for "Data de Emissão", "Data da Fatura", "Emitido em"
   - Format as YYYY-MM-DD
5. Contract Number: Look for "Nº Contrato", "Nº Cliente", "Contrato", "Cliente"
6. Multibanco Entity: A 5-digit number labeled as "Entidade" or "Entity"
   - Example: 12345
7. Multibanco Reference: A 9-digit number labeled as "Referência" or "Reference"
   - Often formatted with spaces: 123 456 789
   - REMOVE all spaces: return as 123456789

IMPORTANT PARSING RULES:
- Amount: Convert euros to cents (multiply by 100): 123.45€ → 12345
- Multibanco Reference: Remove ALL spaces from the 9-digit number
- Be precise: Read the EXACT values from the document
- These are REAL invoices with REAL payment information - accuracy is critical`;

      userPrompt = `Analyze this Portuguese invoice and extract ALL payment information with maximum precision.
Document: ${fileName}

Extract EXACTLY:
1. Company name (from the top logo/header)
2. FINAL total amount to pay in cents (look for "Total a Pagar" - the biggest number)
3. Due date (Data de Vencimento) in YYYY-MM-DD
4. Issue date (Data de Emissão) in YYYY-MM-DD
5. Contract/Client number (Nº Contrato/Cliente)
6. Multibanco Entity (5 digits near "Entidade")
7. Multibanco Reference (9 digits near "Referência" - remove spaces)

Be thorough and precise - this is a real invoice with real payment data.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "parse_invoice",
          description: "Parse Portuguese invoice from document image with maximum precision",
          parameters: {
            type: "object",
            properties: {
              issuer: { 
                type: "string", 
                description: "Exact company name from top of invoice (e.g., EDP, MEO, NOS, Vodafone, DIGI)" 
              },
              category: {
                type: "string",
                enum: ["Eletricidade", "Água", "Gás", "Internet", "Telecomunicações", "Seguro"],
                description: "Service category based on the company type"
              },
              amount_cents: { 
                type: "integer", 
                description: "FINAL total amount in cents (euros × 100). Example: 45.67€ = 4567 cents" 
              },
              due_date: { 
                type: "string", 
                description: "Payment due date in YYYY-MM-DD format from 'Data de Vencimento'" 
              },
              issue_date: { 
                type: "string", 
                description: "Invoice issue date in YYYY-MM-DD format from 'Data de Emissão'" 
              },
              contract_number: { 
                type: "string", 
                description: "Contract or client number from 'Nº Contrato' or 'Nº Cliente'" 
              },
              multibanco_entity: { 
                type: "string", 
                description: "EXACTLY 5 digits from Multibanco 'Entidade' field" 
              },
              multibanco_reference: { 
                type: "string", 
                description: "EXACTLY 9 digits from Multibanco 'Referência' (spaces removed)" 
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

    // Add logo URL if parsing invoice using logo.dev
    if (pdfData && result.issuer) {
      const logoUrl = logoUrlFor(result.issuer);
      result.logo_url = logoUrl;
      console.log(`Logo URL for ${result.issuer}: ${logoUrl}`);
      
      // Store Multibanco details in parsed_fields
      if (result.multibanco_entity || result.multibanco_reference) {
        result.parsed_fields = {
          multibanco_entity: result.multibanco_entity || null,
          multibanco_reference: result.multibanco_reference || null,
        };
        console.log(`Multibanco details: Entity=${result.multibanco_entity}, Reference=${result.multibanco_reference}`);
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
