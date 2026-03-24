const DEFAULT_CALLBACK_PATH = "/dashboard";

const ALLOWED_CALLBACK_PREFIXES = [
  "/dashboard",
  "/analyze",
  "/reports",
  "/reports/",
  "/report/",
  "/account",
  "/admin",
  "/admin/",
  "/login",
  "/register",
];

function isAllowedInternalPath(pathname: string) {
  if (pathname === DEFAULT_CALLBACK_PATH) return true;
  return ALLOWED_CALLBACK_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix
  );
}

export function sanitizeAuthCallbackPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_CALLBACK_PATH;

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    try {
      const parsed = new URL(raw, "http://localhost");
      const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return isAllowedInternalPath(parsed.pathname)
        ? candidate
        : DEFAULT_CALLBACK_PATH;
    } catch {
      return DEFAULT_CALLBACK_PATH;
    }
  }

  try {
    const parsed = new URL(raw, "http://localhost");
    if (parsed.origin !== "http://localhost") return DEFAULT_CALLBACK_PATH;

    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isAllowedInternalPath(parsed.pathname)
      ? candidate
      : DEFAULT_CALLBACK_PATH;
  } catch {
    return DEFAULT_CALLBACK_PATH;
  }
}

export function resolveAuthRedirectUrl(url: string, baseUrl: string): string {
  if (!url) return `${baseUrl}${DEFAULT_CALLBACK_PATH}`;

  try {
    const parsed = new URL(url, baseUrl);
    if (parsed.origin !== baseUrl) {
      return `${baseUrl}${DEFAULT_CALLBACK_PATH}`;
    }

    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return `${baseUrl}${sanitizeAuthCallbackPath(path)}`;
  } catch {
    return `${baseUrl}${DEFAULT_CALLBACK_PATH}`;
  }
}

export function extractSafeCallbackPathFromUrl(
  url: string | null | undefined
): string {
  if (!url) return DEFAULT_CALLBACK_PATH;

  if (url.startsWith("/")) {
    return sanitizeAuthCallbackPath(url);
  }

  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return sanitizeAuthCallbackPath(path);
  } catch {
    return sanitizeAuthCallbackPath(url);
  }
}
