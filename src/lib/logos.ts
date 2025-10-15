import edpLogo from "@/assets/logos/edp.png";
import meoLogo from "@/assets/logos/meo.png";
import nosLogo from "@/assets/logos/nos.png";
import vodafoneLogo from "@/assets/logos/vodafone.png";
import waterLogo from "@/assets/logos/water.png";
import gasLogo from "@/assets/logos/gas.png";
import internetLogo from "@/assets/logos/internet.png";
import insuranceLogo from "@/assets/logos/insurance.png";

export function getServiceLogo(issuer: string, category?: string | null): string {
  const issuerLower = issuer.toLowerCase();
  const categoryLower = category?.toLowerCase() || "";

  // Check issuer first
  if (issuerLower.includes("edp")) return edpLogo;
  if (issuerLower.includes("meo")) return meoLogo;
  if (issuerLower.includes("nos")) return nosLogo;
  if (issuerLower.includes("vodafone")) return vodafoneLogo;

  // Check category
  if (categoryLower.includes("water") || categoryLower.includes("água")) return waterLogo;
  if (categoryLower.includes("gas") || categoryLower.includes("gás")) return gasLogo;
  if (categoryLower.includes("internet") || categoryLower.includes("telecomunicações")) return internetLogo;
  if (categoryLower.includes("electricity") || categoryLower.includes("eletricidade")) return edpLogo;
  if (categoryLower.includes("insurance") || categoryLower.includes("seguro")) return insuranceLogo;
  if (categoryLower.includes("phone") || categoryLower.includes("telefone") || categoryLower.includes("mobile")) return meoLogo;

  // Default to internet logo
  return internetLogo;
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
