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

    const AZURE_ENDPOINT = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT");
    const AZURE_KEY = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_KEY");

    if (!AZURE_ENDPOINT || !AZURE_KEY) {
      throw new Error("Azure Document Intelligence credentials not configured");
    }

    // Different handling for PDF upload vs simple categorization
    if (pdfData) {
      console.log("Processing PDF invoice with Azure Document Intelligence:", fileName);
      
      // Convert base64 data URL to raw base64
      const base64Data = pdfData.replace(/^data:image\/[a-z]+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Submit document to Azure for analysis using prebuilt-invoice model
      const analyzeUrl = `${AZURE_ENDPOINT}/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`;
      
      console.log("Submitting to Azure:", analyzeUrl);
      
      const analyzeResponse = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Ocp-Apim-Subscription-Key": AZURE_KEY,
        },
        body: binaryData,
      });

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.error("Azure submit error:", analyzeResponse.status, errorText);
        throw new Error(`Azure Document Intelligence error: ${analyzeResponse.status}`);
      }

      // Get the operation location to poll for results
      const operationLocation = analyzeResponse.headers.get("operation-location");
      if (!operationLocation) {
        throw new Error("No operation-location header in Azure response");
      }

      console.log("Polling Azure results:", operationLocation);

      // Poll for results (max 30 seconds)
      let result: any = null;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const resultResponse = await fetch(operationLocation, {
          headers: {
            "Ocp-Apim-Subscription-Key": AZURE_KEY,
          },
        });

        if (!resultResponse.ok) {
          throw new Error(`Failed to get Azure results: ${resultResponse.status}`);
        }

        const resultData = await resultResponse.json();
        console.log("Azure status:", resultData.status);

        if (resultData.status === "succeeded") {
          result = resultData;
          break;
        } else if (resultData.status === "failed") {
          throw new Error("Azure Document Intelligence analysis failed");
        }

        attempts++;
      }

      if (!result) {
        throw new Error("Azure analysis timed out");
      }

      console.log("Azure analysis complete:", JSON.stringify(result, null, 2));

      // Parse Azure results
      const document = result.analyzeResult?.documents?.[0];
      if (!document) {
        throw new Error("No document found in Azure results");
      }

      const fields = document.fields || {};
      
      // Extract vendor name
      const vendorName = fields.VendorName?.content || 
                        fields.VendorName?.valueString || 
                        issuer || 
                        "Unknown";
      
      // Extract amounts - try InvoiceTotal first, then fall back to AmountDue
      let amountCents = 0;
      const invoiceTotal = fields.InvoiceTotal?.valueCurrency?.amount || 
                          fields.InvoiceTotal?.valueNumber ||
                          fields.AmountDue?.valueCurrency?.amount ||
                          fields.AmountDue?.valueNumber;
      
      if (invoiceTotal) {
        amountCents = Math.round(invoiceTotal * 100);
      }

      // Extract dates
      const dueDate = fields.DueDate?.valueDate || fields.DueDate?.content || null;
      const issueDate = fields.InvoiceDate?.valueDate || fields.InvoiceDate?.content || null;
      
      // Extract contract number
      const contractNumber = fields.CustomerAccountId?.content || 
                            fields.CustomerId?.content || 
                            fields.InvoiceId?.content || 
                            null;

      // Try to find Multibanco details in custom fields or key-value pairs
      let multibancoEntity = null;
      let multibancoReference = null;

      // Search through all fields for Multibanco info
      const allContent = result.analyzeResult?.content || "";
      
      // Look for Entity (5 digits)
      const entityMatch = allContent.match(/(?:entidade|entity)[:\s]*(\d{5})/i);
      if (entityMatch) {
        multibancoEntity = entityMatch[1];
      }

      // Look for Reference (9 digits, possibly with spaces)
      const refMatch = allContent.match(/(?:referência|referencia|reference)[:\s]*([\d\s]{9,13})/i);
      if (refMatch) {
        multibancoReference = refMatch[1].replace(/\s/g, "");
      }

      // Determine category based on vendor name
      let category = "Telecomunicações"; // default
      const normalizedVendor = normalize(vendorName);
      
      if (normalizedVendor.includes("edp") || normalizedVendor.includes("energia") || 
          normalizedVendor.includes("electricity") || normalizedVendor.includes("eletricidade")) {
        category = "Eletricidade";
      } else if (normalizedVendor.includes("agua") || normalizedVendor.includes("water") || 
                normalizedVendor.includes("epal") || normalizedVendor.includes("adp")) {
        category = "Água";
      } else if (normalizedVendor.includes("gas") || normalizedVendor.includes("galp") || 
                normalizedVendor.includes("repsol")) {
        category = "Gás";
      } else if (normalizedVendor.includes("meo") || normalizedVendor.includes("nos") || 
                normalizedVendor.includes("vodafone") || normalizedVendor.includes("digi") || 
                normalizedVendor.includes("nowo") || normalizedVendor.includes("internet")) {
        category = "Internet";
      } else if (normalizedVendor.includes("seguro") || normalizedVendor.includes("insurance")) {
        category = "Seguro";
      }

      // Get logo URL
      const logoUrl = logoUrlFor(vendorName);
      console.log(`Logo URL for ${vendorName}: ${logoUrl}`);

      const parsedResult = {
        issuer: vendorName,
        category,
        amount_cents: amountCents,
        due_date: dueDate,
        issue_date: issueDate,
        contract_number: contractNumber,
        multibanco_entity: multibancoEntity,
        multibanco_reference: multibancoReference,
        logo_url: logoUrl,
        parsed_fields: {
          multibanco_entity: multibancoEntity,
          multibanco_reference: multibancoReference,
        },
      };

      console.log("Parsed invoice:", parsedResult);

      return new Response(JSON.stringify(parsedResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else {
      // Simple categorization without Azure (for existing services)
      console.log("Categorizing invoice for issuer:", issuer);
      
      let category = "Telecomunicações"; // default
      const normalizedIssuer = normalize(issuer);
      
      if (normalizedIssuer.includes("edp") || normalizedIssuer.includes("energia") || 
          normalizedIssuer.includes("electricity") || normalizedIssuer.includes("eletricidade")) {
        category = "Eletricidade";
      } else if (normalizedIssuer.includes("agua") || normalizedIssuer.includes("water") || 
                normalizedIssuer.includes("epal") || normalizedIssuer.includes("adp")) {
        category = "Água";
      } else if (normalizedIssuer.includes("gas") || normalizedIssuer.includes("galp") || 
                normalizedIssuer.includes("repsol")) {
        category = "Gás";
      } else if (normalizedIssuer.includes("meo") || normalizedIssuer.includes("nos") || 
                normalizedIssuer.includes("vodafone") || normalizedIssuer.includes("digi") || 
                normalizedIssuer.includes("nowo") || normalizedIssuer.includes("internet")) {
        category = "Internet";
      } else if (normalizedIssuer.includes("seguro") || normalizedIssuer.includes("insurance")) {
        category = "Seguro";
      }

      return new Response(
        JSON.stringify({
          category,
          description: `${issuer} - ${category}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
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
