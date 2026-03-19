function ensureUrlProtocol(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeRequestUrl(rawUrl: string) {
  const withProtocol = ensureUrlProtocol(rawUrl);
  return new URL(withProtocol).toString();
}

function buildReferer(targetUrl: string) {
  const parsed = new URL(targetUrl);
  return `${parsed.protocol}//${parsed.host}/`;
}

function buildHeaders(targetUrl: string) {
  const hostname = new URL(targetUrl).hostname.toLowerCase();
  const isN11 = hostname.includes("n11.com");

  const base: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
  };

  if (isN11) {
    return {
      ...base,
      Referer: "https://www.n11.com/",
      "Sec-Fetch-Site": "same-origin",
      Cookie: "platform=web; lang=tr_TR",
    };
  }

  return {
    ...base,
    Referer: buildReferer(targetUrl),
    "Sec-Fetch-Site": "none",
  };
}

async function fetchOnce(targetUrl: string) {
  return fetch(targetUrl, {
    method: "GET",
    headers: buildHeaders(targetUrl),
    redirect: "follow",
    cache: "no-store",
  });
}

async function fetchWithFallbacks(targetUrl: string) {
  const hostname = new URL(targetUrl).hostname.toLowerCase();
  const isN11 = hostname.includes("n11.com");

  let response = await fetchOnce(targetUrl);
  if (response.ok) return response;

  if (isN11 && (response.status === 403 || response.status === 429)) {
    // 1. deneme: Google referer ile
    response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        ...buildHeaders(targetUrl),
        Referer: "https://www.google.com/search?q=n11+urun",
        "Sec-Fetch-Site": "cross-site",
        Cookie: "platform=web; lang=tr_TR; _gid=GA1.2.000000000.0000000000",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (response.ok) return response;

    // 2. deneme: kısa bekleme + tekrar
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await fetchOnce(targetUrl);
    if (response.ok) return response;
  }

  return response;
}

export async function fetchPageHtml(url: string): Promise<string> {
  const normalizedUrl = normalizeRequestUrl(url);
  const response = await fetchWithFallbacks(normalizedUrl);

  if (!response.ok) {
    throw new Error(`HTML_FETCH_FAILED:${response.status}`);
  }

  const html = await response.text();

  if (!html || html.trim().length === 0) {
    throw new Error("EMPTY_HTML");
  }

  return html;
}