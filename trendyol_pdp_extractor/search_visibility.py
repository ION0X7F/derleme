from __future__ import annotations

import asyncio
import json
import re
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse

from playwright.async_api import async_playwright

from .capture_network import capture_runtime_requests


def _normalize_product_path(url: str | None) -> str | None:
    if not url:
        return None
    cleaned = str(url).strip()
    if not cleaned:
        return None
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        parsed = urlparse(cleaned)
        path = parsed.path or ""
    else:
        path = cleaned
    if not path.startswith("/"):
        path = f"/{path}"
    match = re.search(r"(/[^?#]*-p-\d+)", path)
    return match.group(1) if match else path


def _extract_product_id(url: str | None) -> str | None:
    normalized = _normalize_product_path(url)
    if not normalized:
        return None
    match = re.search(r"-p-(\d+)", normalized)
    return match.group(1) if match else None


def _detect_block(title: str, html: str) -> bool:
    lowered_title = (title or "").lower()
    lowered_html = (html or "").lower()
    return (
        "cloudflare" in lowered_title
        or "attention required" in lowered_title
        or "you have been blocked" in lowered_html
        or "cf-error-details" in lowered_html
    )


def _extract_rank_from_network_logs(logs: list[dict[str, Any]], target_product_id: str | None) -> dict[str, Any] | None:
    if not target_product_id:
        return None

    for log in logs:
        raw_url = log.get("url") or ""
        lowered = str(raw_url).lower()
        if "discovery-sfint-search-service/api/social-proof/" not in lowered:
            continue

        parsed = urlparse(str(raw_url))
        params = parse_qs(parsed.query)
        content_ids_raw = params.get("contentIds", [])
        if not content_ids_raw:
            continue

        flattened: list[str] = []
        for item in content_ids_raw:
            flattened.extend([part.strip() for part in item.split(",") if part.strip()])

        for index, product_id in enumerate(flattened, start=1):
            if product_id != target_product_id:
                continue
            return {
                "rank": index,
                "page": ((index - 1) // 24) + 1,
                "product_id": product_id,
                "path": None,
                "href": None,
                "label": None,
                "source": "search_service_social_proof",
            }

    return None


async def _capture_search_page(keyword: str) -> dict[str, Any]:
    search_url = f"https://www.trendyol.com/sr?q={quote_plus(keyword)}"

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            locale="tr-TR",
            service_workers="block",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(3000)

        title = await page.title()
        html = await page.content()

        if _detect_block(title, html):
            await browser.close()
            return {
                "keyword": keyword,
                "search_url": search_url,
                "status": "blocked",
                "reason": "cloudflare_block",
                "title": title,
                "rank": None,
                "page": None,
                "found": False,
                "results": [],
            }

        hrefs = await page.eval_on_selector_all(
            'a[href*="/p-"]',
            """els => els.map((e, index) => ({
                href: e.getAttribute("href"),
                text: (e.textContent || "").trim(),
                index
            }))""",
        )
        await browser.close()

    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    position = 0
    for item in hrefs:
        href = item.get("href")
        normalized_path = _normalize_product_path(href)
        product_id = _extract_product_id(href)
        if not normalized_path or product_id is None:
            continue
        if normalized_path in seen:
            continue
        seen.add(normalized_path)
        position += 1
        results.append(
            {
                "rank": position,
                "page": ((position - 1) // 24) + 1,
                "path": normalized_path,
                "product_id": product_id,
                "href": href,
                "label": " ".join(str(item.get("text") or "").split()) or None,
            }
        )

    return {
        "keyword": keyword,
        "search_url": search_url,
        "status": "ok",
        "reason": None,
        "title": title,
        "results": results,
    }


async def _run_async(keyword: str, product_url: str) -> dict[str, Any]:
    target_path = _normalize_product_path(product_url)
    target_product_id = _extract_product_id(product_url)
    payload = await _capture_search_page(keyword)

    if payload["status"] != "ok":
        payload.update(
            {
                "target_product_url": product_url,
                "target_product_path": target_path,
                "target_product_id": target_product_id,
            }
        )
        return payload

    match = None
    for result in payload["results"]:
        if target_product_id and result.get("product_id") == target_product_id:
            match = result
            break
        if target_path and result.get("path") == target_path:
            match = result
            break

    if not match and not payload["results"]:
        network_logs = await capture_runtime_requests(payload["search_url"])
        match = _extract_rank_from_network_logs(network_logs, target_product_id)

    payload.update(
        {
            "target_product_url": product_url,
            "target_product_path": target_path,
            "target_product_id": target_product_id,
            "found": bool(match),
            "rank": match.get("rank") if match else None,
            "page": match.get("page") if match else None,
            "matched_result": match,
            "total_results_scanned": len(payload["results"]),
        }
    )
    return payload


def check_keyword_visibility(keyword: str, product_url: str) -> dict[str, Any]:
    return asyncio.run(_run_async(keyword, product_url))


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        raise SystemExit(
            "Usage: python -m trendyol_pdp_extractor.search_visibility <keyword> <trendyol-product-url>"
        )
    print(json.dumps(check_keyword_visibility(sys.argv[1], sys.argv[2]), ensure_ascii=False, indent=2))
