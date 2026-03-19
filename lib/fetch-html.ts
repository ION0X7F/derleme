export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTML_FETCH_FAILED: ${response.status}`);
  }

  return await response.text();
}