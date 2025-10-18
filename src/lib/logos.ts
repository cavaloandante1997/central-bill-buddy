import edpLogo from "@/assets/logos/edp.png";
import meoLogo from "@/assets/logos/meo.png";
import nosLogo from "@/assets/logos/nos.png";
import vodafoneLogo from "@/assets/logos/vodafone.png";
import waterLogo from "@/assets/logos/water.png";
import gasLogo from "@/assets/logos/gas.png";
import internetLogo from "@/assets/logos/internet.png";
import insuranceLogo from "@/assets/logos/insurance.png";

const LOCAL_LOGO_MAP: Record<string, string> = {
  edp: edpLogo,
  meo: meoLogo,
  nos: nosLogo,
  vodafone: vodafoneLogo,
  epal: waterLogo,
  água: waterLogo,
  water: waterLogo,
  galp: gasLogo,
  gás: gasLogo,
  gas: gasLogo,
  internet: internetLogo,
  telecomunicações: internetLogo,
  seguro: insuranceLogo,
  insurance: insuranceLogo,
};

export function getServiceLogo(
  issuer: string,
  category?: string | null,
  logoUrl?: string | null
): string | null {
  // If we have a logo_url from the database, use it
  if (logoUrl) {
    return logoUrl;
  }

  const issuerLower = issuer.toLowerCase();
  
  // Check if issuer matches any known company
  for (const [key, logo] of Object.entries(LOCAL_LOGO_MAP)) {
    if (issuerLower.includes(key)) {
      return logo;
    }
  }

  // Fallback to category-based logos
  if (category) {
    const categoryLower = category.toLowerCase();
    for (const [key, logo] of Object.entries(LOCAL_LOGO_MAP)) {
      if (categoryLower.includes(key)) {
        return logo;
      }
    }
  }

  return null;
}

export function getCategoryColor(category?: string | null): string {
  const categoryLower = category?.toLowerCase() || "";

  if (categoryLower.includes("electricity") || categoryLower.includes("eletricidade")) return "text-blue-500";
  if (categoryLower.includes("water") || categoryLower.includes("água")) return "text-cyan-500";
  if (categoryLower.includes("gas") || categoryLower.includes("gás")) return "text-orange-500";
  if (categoryLower.includes("internet") || categoryLower.includes("telecomunicações")) return "text-purple-500";
  if (categoryLower.includes("phone") || categoryLower.includes("telefone") || categoryLower.includes("mobile")) return "text-pink-500";
  if (categoryLower.includes("insurance") || categoryLower.includes("seguro")) return "text-green-500";

  return "text-primary";
}
