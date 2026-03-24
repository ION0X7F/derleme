from __future__ import annotations

import asyncio
import json
from typing import Any

from playwright.async_api import async_playwright

JSON_HINTS = (
    "seller",
    "merchant",
    "question",
    "review",
    "comment",
    "price",
    "promotion",
    "campaign",
    "product",
    "favorite",
    "similar",
    "reco",
    "recommend",
    "cross-products",
    "collection",
)


def _looks_relevant(url: str, content_type: str) -> bool:
    lowered = url.lower()
    if "json" in content_type.lower():
        return True
    return any(hint in lowered for hint in JSON_HINTS)


async def capture_runtime_requests(url: str) -> list[dict[str, Any]]:
    logs: list[dict[str, Any]] = []

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

        async def handle_response(response: Any) -> None:
            request = response.request
            headers = await response.all_headers()
            content_type = headers.get("content-type", "")
            request_headers = await request.all_headers()
            log_item = {
                "url": response.url,
                "method": request.method,
                "resource_type": request.resource_type,
                "status": response.status,
                "request_headers": request_headers,
                "response_headers": headers,
                "content_type": content_type,
                "post_data": request.post_data,
                "body_text": None,
                "json": None,
                "source": "xhr",
            }

            if _looks_relevant(response.url, content_type):
                body_text: str | None = None
                payload: Any = None
                try:
                    body_text = await response.text()
                except Exception:
                    body_text = None

                if body_text:
                    try:
                        payload = json.loads(body_text)
                    except json.JSONDecodeError:
                        payload = None

                log_item["body_text"] = body_text[:200000] if body_text else None
                log_item["json"] = payload

            logs.append(log_item)

        page.on("response", lambda response: asyncio.create_task(handle_response(response)))

        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)
        for step in (0.25, 0.5, 0.75, 1):
            try:
                await page.evaluate(
                    "(ratio) => window.scrollTo({ top: document.body.scrollHeight * ratio, behavior: 'instant' })",
                    step,
                )
                await page.wait_for_timeout(1200)
            except Exception:
                break
        await page.wait_for_timeout(4000)
        await browser.close()

    return logs
