function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  const withoutTrailing = pathname.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

function normalizeHostname(hostname: string) {
  return hostname.toLocaleLowerCase("tr-TR").replace(/^www\./, "");
}

function normalizeProtocol(protocol: string) {
  if (protocol === "http:" || protocol === "https:") return "https:";
  return protocol.toLocaleLowerCase("tr-TR");
}

export function canonicalizeUrlForAnalysisKey(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const protocol = normalizeProtocol(parsed.protocol);
    const hostname = normalizeHostname(parsed.hostname);
    const pathname = normalizePathname(parsed.pathname);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${protocol}//${hostname}${port}${pathname}`;
  } catch {
    return trimmed.toLocaleLowerCase("tr-TR");
  }
}

export function dedupeUrlsByCanonical(urls: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  let duplicatesCollapsed = 0;

  for (const url of urls) {
    const key = canonicalizeUrlForAnalysisKey(url);
    if (seen.has(key)) {
      duplicatesCollapsed += 1;
      continue;
    }
    seen.add(key);
    unique.push(url);
  }

  return {
    unique,
    duplicatesCollapsed,
  };
}
