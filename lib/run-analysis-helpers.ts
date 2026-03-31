import { buildPriorityActions } from "@/lib/build-analysis";
import { runPythonJson } from "@/lib/python-runner";
import type {
  AnalysisSuggestion,
  CategoryAverages,
  ExtractedFieldMetadata,
  ExtractedProductFields,
  LearningContext,
} from "@/types/analysis";
import type { DebugTraceHandle } from "@/lib/debug-observability";
import { traceEvent } from "@/lib/debug-observability";

const PYTHON_BACKFILL_FIELDS: Array<keyof ExtractedProductFields> = [
  "original_price",
  "discount_rate",
  "question_count",
  "qa_snippets",
  "other_sellers_count",
  "other_seller_offers",
  "other_sellers_summary",
  "review_snippets",
  "review_summary",
  "review_themes",
  "follower_count",
];

const PYTHON_BACKFILL_SCRIPT = `
import asyncio
import json
import sys
from trendyol_pdp_extractor.fetch_page import fetch_html
from trendyol_pdp_extractor.parse_html import extract_html_data
from trendyol_pdp_extractor.parse_embedded_json import extract_embedded_json
from trendyol_pdp_extractor.capture_network import capture_runtime_requests
from trendyol_pdp_extractor.parse_runtime_json import extract_runtime_data
from trendyol_pdp_extractor.normalize import merge_product_data

url = sys.argv[1]
html = fetch_html(url)
html_data = extract_html_data(html, url)
embedded_data = extract_embedded_json(html)
logs = asyncio.run(capture_runtime_requests(url))
runtime_data = extract_runtime_data(logs)
merged = merge_product_data(html_data, embedded_data, runtime_data)
print(json.dumps(merged, ensure_ascii=False))
`;

export function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function isMissingValue(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return !Number.isFinite(value);
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function shouldRunPythonBackfill(extracted: ExtractedProductFields) {
  return PYTHON_BACKFILL_FIELDS.some((field) => isMissingValue(extracted[field]));
}

export async function fetchPythonBackfill(
  url: string
): Promise<Partial<ExtractedProductFields> | null> {
  try {
    const payload = (await runPythonJson({
      script: PYTHON_BACKFILL_SCRIPT,
      args: [url],
      cwd: process.cwd(),
    })) as Record<string, unknown>;

    if (!payload || typeof payload !== "object") return null;
    return payload as Partial<ExtractedProductFields>;
  } catch {
    return null;
  }
}

export function applyPythonBackfill(params: {
  extracted: ExtractedProductFields;
  pythonData: Partial<ExtractedProductFields>;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
  trace: DebugTraceHandle;
}) {
  const { extracted, pythonData, fieldMetadata, trace } = params;

  for (const field of PYTHON_BACKFILL_FIELDS) {
    const currentValue = extracted[field];
    const incomingValue = pythonData[field];

    if (!isMissingValue(currentValue) || isMissingValue(incomingValue)) {
      continue;
    }

    extracted[field] = incomingValue as never;
    fieldMetadata[String(field)] = {
      source: "runtime_xhr",
      confidence: "medium",
      timestamp: Date.now(),
      reason: "python layered fallback",
    };

    traceEvent(trace, {
      stage: "merge",
      code: "python_backfill_field",
      message: `${String(field)} python fallback ile dolduruldu.`,
      field: String(field),
    });
  }
}

export function shouldUseAiScore(aiScore: number, fallbackScore: number) {
  if (!Number.isFinite(aiScore)) return false;
  if (aiScore <= 0 && fallbackScore > 0) return false;
  return true;
}

export function buildAiPriorityActionsFromSuggestions(
  suggestions: Array<{ title: string; detail: string }> | null | undefined
) {
  if (!Array.isArray(suggestions)) return [];

  return suggestions
    .filter(
      (item): item is { title: string; detail: string } =>
        !!item &&
        typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        typeof item.detail === "string" &&
        item.detail.trim().length > 0
    )
    .slice(0, 10)
    .map((item, index) => ({
      priority: index + 1,
      title: item.title.trim(),
      detail: item.detail.trim(),
    }));
}

export function buildCategoryAverages(
  learningContext: LearningContext | null | undefined
): CategoryAverages | null {
  const benchmark = learningContext?.benchmark;
  if (!benchmark || benchmark.sampleSize <= 0) return null;

  return {
    source: "learning_benchmark",
    sampleSize: benchmark.sampleSize,
    imageCount: benchmark.avgImageCount,
    descriptionLength: benchmark.avgDescriptionLength,
    ratingValue: benchmark.avgRatingValue,
    sellerScore: benchmark.avgSellerScore,
    price: benchmark.avgPrice,
    reviewCount: benchmark.avgReviewCount,
    favoriteCount: benchmark.avgFavoriteCount,
    shippingDays: benchmark.avgShippingDays,
    otherSellersCount: benchmark.avgOtherSellersCount,
    freeShippingRate: benchmark.freeShippingRate,
    fastDeliveryRate: benchmark.fastDeliveryRate,
    hasVideoRate: benchmark.hasVideoRate,
    officialSellerRate: benchmark.officialSellerRate,
  };
}

export function resolvePriorityActions(params: {
  extractedData: ExtractedProductFields;
  derivedMetrics: Parameters<typeof buildPriorityActions>[1];
  suggestions: AnalysisSuggestion[];
  marketComparison: Parameters<typeof buildPriorityActions>[3];
}) {
  const aiPriorityActions = buildAiPriorityActionsFromSuggestions(
    params.suggestions
  );

  return aiPriorityActions.length > 0
    ? aiPriorityActions
    : buildPriorityActions(
        params.extractedData,
        params.derivedMetrics,
        params.suggestions,
        params.marketComparison
      );
}
