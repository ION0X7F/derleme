export type SupportedPlatform =
  | "trendyol"
  | "hepsiburada"
  | "amazon"
  | "n11"
  | "idefix"
  | null;

function normalizeText(value: string | null | undefined) {
  if (!value) return "";
  return value.toLowerCase().trim();
}

function safeGetHostname(url: string | null | undefined) {
  if (!url) return "";

  try {
    const normalizedUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;

    return normalizeText(new URL(normalizedUrl).hostname);
  } catch {
    return "";
  }
}

function stripWww(hostname: string) {
  return hostname.replace(/^www\./, "");
}

function isTrendyolHost(hostname: string) {
  return (
    hostname === "trendyol.com" ||
    hostname.endsWith(".trendyol.com") ||
    hostname === "ty.gl" ||
    hostname.endsWith(".ty.gl")
  );
}

function isHepsiburadaHost(hostname: string) {
  return (
    hostname === "hepsiburada.com" ||
    hostname.endsWith(".hepsiburada.com")
  );
}

function isAmazonHost(hostname: string) {
  return (
    hostname === "amazon.com.tr" ||
    hostname.endsWith(".amazon.com.tr") ||
    hostname === "amazon.de" ||
    hostname.endsWith(".amazon.de") ||
    hostname === "amazon.com" ||
    hostname.endsWith(".amazon.com") ||
    hostname === "amzn.to" ||
    hostname.endsWith(".amzn.to")
  );
}

function isN11Host(hostname: string) {
  return hostname === "n11.com" || hostname.endsWith(".n11.com");
}

function isIdefixHost(hostname: string) {
  return hostname === "idefix.com" || hostname.endsWith(".idefix.com");
}

export function detectPlatform(url: string | null | undefined): SupportedPlatform {
  const hostname = stripWww(safeGetHostname(url));

  if (!hostname) return null;

  if (isTrendyolHost(hostname)) return "trendyol";
  if (isHepsiburadaHost(hostname)) return "hepsiburada";
  if (isAmazonHost(hostname)) return "amazon";
  if (isN11Host(hostname)) return "n11";
  if (isIdefixHost(hostname)) return "idefix";

  return null;
}