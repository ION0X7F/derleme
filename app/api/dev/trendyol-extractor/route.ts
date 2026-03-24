import { NextResponse } from "next/server";
import { buildMarketComparisonInsights } from "@/lib/competitor-summary";
import {
  createDebugTrace,
  finalizeDebugTrace,
  traceEvent,
  traceMissingField,
} from "@/lib/debug-observability";
import { analyzeSeoContent } from "@/lib/seo-content-analysis";
import { runPythonJson, PythonRunnerError } from "@/lib/python-runner";
import type { ExtractedProductFields } from "@/types/analysis";

export const dynamic = "force-dynamic";

const PYTHON_SCRIPT = `
import asyncio
import json
import time
import sys
from trendyol_pdp_extractor.fetch_page import fetch_html
from trendyol_pdp_extractor.parse_html import extract_html_data
from trendyol_pdp_extractor.parse_embedded_json import extract_embedded_json
from trendyol_pdp_extractor.capture_network import capture_runtime_requests
from trendyol_pdp_extractor.parse_runtime_json import extract_runtime_data
from trendyol_pdp_extractor.normalize import merge_product_data

url = sys.argv[1]
marks = []

def add(name, started):
    marks.append((name, time.perf_counter() - started))

s = time.perf_counter()
html = fetch_html(url)
add("fetch_html", s)

s = time.perf_counter()
html_data = extract_html_data(html, url)
add("parse_html", s)

s = time.perf_counter()
embedded_data = extract_embedded_json(html)
add("parse_embedded_json", s)

async def phase():
    s = time.perf_counter()
    logs = await capture_runtime_requests(url)
    runtime_capture = time.perf_counter() - s
    s2 = time.perf_counter()
    runtime_data = extract_runtime_data(logs)
    runtime_parse = time.perf_counter() - s2
    return runtime_data, runtime_capture, runtime_parse

runtime_data, runtime_capture, runtime_parse = asyncio.run(phase())
marks.append(("capture_runtime_requests", runtime_capture))
marks.append(("parse_runtime_json", runtime_parse))

s = time.perf_counter()
merged = merge_product_data(html_data, embedded_data, runtime_data)
add("merge_product_data", s)

print(json.dumps({
    "timings": {k: round(v, 3) for k, v in marks},
    "totalSeconds": round(sum(v for _, v in marks), 3),
    "data": merged,
}, ensure_ascii=False))
`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; keyword?: string };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

  if (!url) {
    return NextResponse.json({ error: "URL gerekli." }, { status: 400 });
  }

  const debugTrace = createDebugTrace({
    pipeline: "dev-trendyol-extractor",
    url,
    platform: "trendyol",
  });

  try {
    const payload = (await runPythonJson({
      script: PYTHON_SCRIPT,
      args: [url],
      cwd: process.cwd(),
    })) as {
      timings: Record<string, number>;
      totalSeconds: number;
      data: Record<string, unknown>;
    };

    const payloadData = payload.data;
    const payloadDataRecord = payloadData as Record<string, unknown>;
    const mergedData = payload.data as unknown as ExtractedProductFields;
    traceEvent(debugTrace, {
      stage: "fetch",
      code: "python_stage_timings",
      message: "Python extractor stage sureleri alindi.",
      meta: {
        timings: payload.timings,
        totalSeconds: payload.totalSeconds,
      },
    });

    for (const field of ["normalized_price", "review_count", "rating_value", "question_count"]) {
      if ((mergedData as Record<string, unknown>)[field] == null) {
        traceMissingField(debugTrace, field, "missing in merged extractor output", true);
      }
    }

    const marketComparison = buildMarketComparisonInsights(mergedData, debugTrace);
    const seoAnalysis = analyzeSeoContent({
      title: mergedData.title ?? mergedData.product_name,
      description: (payloadData.description as string | null | undefined) ?? null,
      bulletPoints: Array.isArray(payloadDataRecord.bullet_points)
        ? (payloadDataRecord.bullet_points as string[])
        : [],
      brand: mergedData.brand,
      productName: mergedData.product_name,
      keyword,
    });

    return NextResponse.json({
      ...payload,
      debugTrace: finalizeDebugTrace(debugTrace),
      data: {
        ...payloadData,
        marketComparison,
        seoAnalysis,
      },
    });
  } catch (error) {
    const message =
      error instanceof PythonRunnerError ? error.message : "Python extractor calistirilamadi.";
    const details = error instanceof PythonRunnerError ? error.details : undefined;

    traceEvent(debugTrace, {
      stage: "fetch",
      level: "warn",
      code: "python_runner_failed",
      message: "Python extractor calistirilamadi.",
      meta: {
        message,
        details,
      },
    });

    return NextResponse.json(
      {
        error: message,
        details,
        debugTrace: finalizeDebugTrace(debugTrace),
      },
      { status: 500 }
    );
  }
}
