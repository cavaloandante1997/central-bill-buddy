// Dynamic logo mapping - logos are fetched from company websites by AI
const LOGO_MAP: Record<string, string> = {
  "edp": "https://www.edp.pt/sites/default/files/2021-09/logo-edp.svg",
  "meo": "https://www.meo.pt/_layouts/images/meo-logo.svg",
  "nos": "https://www.nos.pt/Style%20Library/img/logos/nos-logo.svg",
  "vodafone": "https://www.vodafone.pt/content/dam/vodafone/images/logos/vodafone-logo.svg",
  "epal": "https://www.epal.pt/EPAL/media/Images/logo-epal.png",
  "galp": "https://www.galp.com/corp/Portals/0/Recursos/Imagens/logotipo.png",
};

export function getServiceLogo(issuer: string, category?: string | null, logoUrl?: string | null): string | null {
  // If a logo URL was stored by AI, use it
  if (logoUrl) return logoUrl;

  // Otherwise try to match from our known providers
  const issuerLower = issuer.toLowerCase();
  
  for (const [key, url] of Object.entries(LOGO_MAP)) {
    if (issuerLower.includes(key)) {
      return url;
    }
  }

  // Return null if no logo found - component should show placeholder
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
