from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from .capture_network import capture_runtime_requests
from .fetch_page import fetch_html, replay_runtime_requests
from .normalize import merge_product_data
from .parse_embedded_json import extract_embedded_json
from .parse_html import extract_html_data
from .parse_runtime_json import extract_runtime_data


async def _run_async(url: str) -> dict[str, Any]:
    html = fetch_html(url)
    html_data = extract_html_data(html, url)
    embedded_data = extract_embedded_json(html)

    request_logs = await capture_runtime_requests(url)
    runtime_data = extract_runtime_data(request_logs)

    replay_logs = replay_runtime_requests(request_logs)
    if replay_logs:
        replay_runtime = extract_runtime_data(replay_logs)
        runtime_data = merge_product_data(runtime_data, {}, replay_runtime)

    result = merge_product_data(html_data, embedded_data, runtime_data)
    result["product_url"] = url
    return result


def run(url: str) -> dict[str, Any]:
    return asyncio.run(_run_async(url))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python -m trendyol_pdp_extractor.extractor <trendyol-product-url>")
    print(json.dumps(run(sys.argv[1]), ensure_ascii=False, indent=2))
