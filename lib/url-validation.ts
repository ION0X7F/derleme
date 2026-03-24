import { detectPlatform, type SupportedPlatform } from "@/lib/detect-platform";

type DetectedPlatform = Exclude<SupportedPlatform, null>;

type ValidateProductUrlOptions = {
  allowedPlatforms?: DetectedPlatform[];
  allowShortTrendyolLinks?: boolean;
};

export type ProductUrlValidationResult =
  | {
      ok: true;
      normalizedUrl: string;
      platform: DetectedPlatform;
      hostname: string;
    }
  | {
      ok: false;
      code: "URL_REQUIRED" | "URL_INVALID" | "PLATFORM_NOT_SUPPORTED";
      message: string;
    };

function normalizeInputUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isPrivateOrLocalHostname(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    const [a, b] = hostname.split(".").map((part) => Number(part));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  return false;
}

function isShortTrendyolLink(hostname: string) {
  return hostname === "ty.gl" || hostname.endsWith(".ty.gl");
}

export function validateProductUrl(
  rawUrl: string,
  options?: ValidateProductUrlOptions
): ProductUrlValidationResult {
  if (!rawUrl.trim()) {
    return {
      ok: false,
      code: "URL_REQUIRED",
      message: "URL zorunlu.",
    };
  }

  const parsed = normalizeInputUrl(rawUrl);

  if (!parsed) {
    return {
      ok: false,
      code: "URL_INVALID",
      message: "Gecerli bir URL girin.",
    };
  }

  const normalizedUrl = parsed.toString();
  const hostname = normalizeHostname(parsed.hostname);

  if (isPrivateOrLocalHostname(hostname)) {
    return {
      ok: false,
      code: "URL_INVALID",
      message: "Lokal veya ozel ag URL'leri desteklenmiyor.",
    };
  }

  const platform = detectPlatform(normalizedUrl);

  if (!platform) {
    return {
      ok: false,
      code: "PLATFORM_NOT_SUPPORTED",
      message: "Bu URL desteklenen bir pazar yerine ait degil.",
    };
  }

  if (
    options?.allowedPlatforms &&
    !options.allowedPlatforms.includes(platform)
  ) {
    return {
      ok: false,
      code: "PLATFORM_NOT_SUPPORTED",
      message: "Bu surumde girilen platform desteklenmiyor.",
    };
  }

  if (
    platform === "trendyol" &&
    options?.allowShortTrendyolLinks === false &&
    isShortTrendyolLink(hostname)
  ) {
    return {
      ok: false,
      code: "URL_INVALID",
      message: "Kisaltma link yerine dogrudan Trendyol urun linki kullanin.",
    };
  }

  if (platform === "trendyol") {
    const pathname = parsed.pathname.toLocaleLowerCase("tr-TR");
    const isLikelyProductPath =
      pathname.includes("-p-") ||
      pathname.includes("/p/") ||
      /\/p-\d+/.test(pathname);

    if (!isLikelyProductPath) {
      return {
        ok: false,
        code: "URL_INVALID",
        message: "Lutfen dogrudan Trendyol urun sayfasi URL'si girin.",
      };
    }
  }

  return {
    ok: true,
    normalizedUrl,
    platform,
    hostname,
  };
}
