export function getReadableReportTitle(params: {
  url: string;
  extractedData?: Record<string, unknown> | null;
  fallback?: string;
}) {
  const { url, extractedData, fallback = "Analiz edilen urun" } = params;

  if (extractedData && typeof extractedData === "object") {
    const candidates = [
      extractedData.title,
      extractedData.product_name,
      extractedData.h1,
      extractedData.product_title,
      extractedData.name,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  try {
    const parsed = new URL(url);
    const slug =
      parsed.pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/[-_]/g, " ")
        ?.replace(/\b\w/g, (char) => char.toUpperCase()) || "";

    if (slug.trim()) {
      return slug;
    }
  } catch {}

  return fallback;
}
