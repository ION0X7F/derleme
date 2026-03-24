import { NextResponse } from "next/server";
import { PythonRunnerError, runPythonJson } from "@/lib/python-runner";

export const dynamic = "force-dynamic";

const PYTHON_SCRIPT = `
import json
import sys
import time
from trendyol_pdp_extractor.search_visibility import check_keyword_visibility

keyword = sys.argv[1]
url = sys.argv[2]

started = time.perf_counter()
result = check_keyword_visibility(keyword, url)
elapsed = time.perf_counter() - started

print(json.dumps({
    "timingSeconds": round(elapsed, 3),
    "data": result
}, ensure_ascii=False))
`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    keyword?: string;
  };

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

  if (!url || !keyword) {
    return NextResponse.json({ error: "URL ve anahtar kelime gerekli." }, { status: 400 });
  }

  try {
    const payload = await runPythonJson({
      script: PYTHON_SCRIPT,
      args: [keyword, url],
      cwd: process.cwd(),
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof PythonRunnerError ? error.message : "Keyword visibility calistirilamadi.";
    const details = error instanceof PythonRunnerError ? error.details : undefined;

    return NextResponse.json(
      {
        error: message,
        details,
      },
      { status: 500 }
    );
  }
}
