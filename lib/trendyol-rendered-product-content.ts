import { runPythonJson } from "@/lib/python-runner";

type RenderedProductContent = {
  description_text: string | null;
  description_length: number | null;
  view_count_24h: number | null;
};

const PYTHON_SCRIPT = String.raw`
import asyncio
import json
import re
import sys
from playwright.async_api import async_playwright

url = sys.argv[1]

def clean_text(value):
    if not value:
        return None
    value = re.sub(r"\s+", " ", value).strip()
    return value or None

def parse_compact_count(value):
    cleaned = clean_text(value)
    if not cleaned:
        return None
    lowered = cleaned.lower()
    lowered = re.sub(r"(kişi|kisi|görüntüledi|goruntuledi|son\s*24\s*saatte|saatte)", "", lowered)
    lowered = re.sub(r"\s+", "", lowered)
    match = re.search(r"(\d+(?:[.,]\d+)?)([a-z]+)?", lowered)
    if not match:
        return None
    number = float(match.group(1).replace(",", "."))
    unit = (match.group(2) or "").lower()
    multiplier = 1
    if unit in ("b", "bin"):
        multiplier = 1000
    elif unit in ("m", "mn", "milyon"):
        multiplier = 1000000
    return int(round(number * multiplier))

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            locale="tr-TR",
            service_workers="block",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/146.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)

        payload = await page.evaluate(
            """() => {
                const cleanText = (value) => {
                    if (!value) return null;
                    const normalized = String(value).replace(/\\s+/g, " ").trim();
                    return normalized || null;
                };
                const parseCompactCount = (value) => {
                    const text = cleanText(value);
                    if (!text) return null;
                    const normalized = text
                        .toLocaleLowerCase('tr-TR')
                        .replace(/kişi|kisi|görüntüledi|goruntuledi|son\\s*24\\s*saatte|saatte/g, '')
                        .replace(/\\s+/g, '')
                        .trim();
                    const match = normalized.match(/(\\d+(?:[.,]\\d+)?)([a-zğıüşöç]*)/i);
                    if (!match) return null;
                    const base = Number(match[1].replace(',', '.'));
                    if (!Number.isFinite(base)) return null;
                    const unit = (match[2] || '').toLocaleLowerCase('tr-TR');
                    const multiplier =
                        unit === 'b' || unit === 'bin'
                            ? 1000
                            : unit === 'm' || unit === 'mn' || unit === 'milyon'
                                ? 1000000
                                : 1;
                    return Math.round(base * multiplier);
                };

                const bodyText = cleanText(document.body?.innerText || '') || '';
                const viewCandidates = Array.from(
                    document.querySelectorAll('[data-testid*="view"], [data-testid*="popular"], [class*="popular"], [class*="view"], [class*="social-proof"]')
                )
                    .map((node) => cleanText(node.textContent))
                    .filter((text) => text && (/son\\s*24\\s*saatte|g[oö]r[uü]nt[uü]ledi/i.test(text)) && !/favori/i.test(text));
                const bodyMatch = bodyText.match(/Son\\s*24\\s*saatte\\s*([^.!\\n]+)/i);
                const viewCount = parseCompactCount(bodyMatch?.[0] || viewCandidates[0] || null);

                const headingNodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
                const descHeading = headingNodes.find((node) => /Ürün Açıklaması|Urun Aciklamasi/i.test(node.textContent || ''));
                if (!descHeading) {
                    return { description_text: null, description_length: null, view_count_24h: viewCount };
                }

                const container =
                    descHeading.closest('section, article, div')?.parentElement ||
                    descHeading.parentElement;
                const paragraphs = [];
                const nodes = Array.from(container?.querySelectorAll('p, li') || []);
                for (const node of nodes) {
                    if (node === descHeading) continue;
                    const text = cleanText(node.textContent);
                    if (!text || /Ek Bilgiler/i.test(text)) continue;
                    paragraphs.push(text);
                }

                const deduped = [];
                const seen = new Set();
                for (const text of paragraphs) {
                    const key = text.toLocaleLowerCase('tr-TR');
                    if (seen.has(key)) continue;
                    seen.add(key);
                    deduped.push(text);
                }

                const description = cleanText(deduped.join('\\n\\n'));
                return {
                    description_text: description,
                    description_length: description ? description.length : null,
                    view_count_24h: viewCount,
                };
            }"""
        )
        if payload.get("view_count_24h") is None:
            body_text = await page.text_content("body") or ""
            match = re.search(r"Son\s*24\s*saatte\s*([^.!\\n]+)", body_text, re.IGNORECASE)
            payload["view_count_24h"] = parse_compact_count(match.group(0) if match else None)
        await browser.close()

    print(json.dumps(payload, ensure_ascii=False))

asyncio.run(main())
`;

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function shouldFetchRenderedProductContent(params: {
  platform: string | null | undefined;
  description_text: string | null | undefined;
  description_length: number | null | undefined;
  view_count_24h?: number | null | undefined;
}) {
  if (String(params.platform || "").toLocaleLowerCase("tr-TR") !== "trendyol") {
    return false;
  }

  const descriptionText = cleanText(params.description_text);
  const descriptionLength =
    typeof params.description_length === "number" && Number.isFinite(params.description_length)
      ? params.description_length
      : descriptionText?.length ?? null;
  const viewCount24h =
    typeof params.view_count_24h === "number" && Number.isFinite(params.view_count_24h)
      ? params.view_count_24h
      : null;

  return (
    !descriptionText ||
    descriptionText.length < 180 ||
    descriptionLength == null ||
    viewCount24h == null
  );
}

export async function fetchRenderedProductContent(
  url: string
): Promise<RenderedProductContent | null> {
  try {
    const payload = (await runPythonJson({
      script: PYTHON_SCRIPT,
      args: [url],
      cwd: process.cwd(),
    })) as Record<string, unknown> | null;

    if (!payload || typeof payload !== "object") return null;

    const descriptionText = cleanText(payload.description_text as string | null);
    const descriptionLength =
      typeof payload.description_length === "number" && Number.isFinite(payload.description_length)
        ? payload.description_length
        : descriptionText?.length ?? null;
    const viewCount24h =
      typeof payload.view_count_24h === "number" && Number.isFinite(payload.view_count_24h)
        ? payload.view_count_24h
        : null;

    if ((!descriptionText || descriptionText.length < 60) && viewCount24h == null) return null;

    return {
      description_text: descriptionText,
      description_length: descriptionLength,
      view_count_24h: viewCount24h,
    };
  } catch {
    return null;
  }
}

const trendyolRenderedProductContent = {
  shouldFetchRenderedProductContent,
  fetchRenderedProductContent,
};

export default trendyolRenderedProductContent;
