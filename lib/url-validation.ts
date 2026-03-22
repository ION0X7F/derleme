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

  return {
    ok: true,
    normalizedUrl,
    platform,
    hostname,
  };
}
