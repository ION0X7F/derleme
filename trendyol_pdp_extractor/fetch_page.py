from __future__ import annotations

import json
import logging
from typing import Any

import httpx

LOGGER = logging.getLogger(__name__)
PSEUDO_HEADERS = {":authority", ":method", ":path", ":scheme", ":protocol"}


def _is_replay_candidate(log: dict[str, Any]) -> bool:
    url = str(log.get("url") or "").lower()
    content_type = str(log.get("content_type") or "").lower()
    if "apigw.trendyol.com" in url:
        return True
    if "json" in content_type:
        return True
    return False


def build_browser_headers(referer: str | None = None) -> dict[str, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    if referer:
        headers["Referer"] = referer
    return headers


def fetch_html(url: str) -> str:
    with httpx.Client(
        follow_redirects=True,
        timeout=httpx.Timeout(30.0, connect=20.0),
        headers=build_browser_headers("https://www.trendyol.com/"),
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        html = response.text
        if not html.strip():
            raise ValueError("Empty HTML response")
        return html


def replay_request(log: dict[str, Any]) -> dict[str, Any] | None:
    url = log.get("url")
    method = str(log.get("method") or "GET").upper()
    if not url or method != "GET" or not _is_replay_candidate(log):
        return None

    raw_headers = dict(log.get("request_headers") or {})
    headers: dict[str, str] = {}
    for key, value in raw_headers.items():
        lower = str(key).lower()
        if lower in PSEUDO_HEADERS:
            continue
        if lower in {"host", "content-length", "content-encoding", "transfer-encoding", "connection"}:
            continue
        headers[str(key)] = str(value)

    cookies = httpx.Cookies()

    raw_cookie = headers.pop("cookie", None) or headers.pop("Cookie", None)
    if raw_cookie:
        for pair in raw_cookie.split(";"):
            if "=" not in pair:
                continue
            name, value = pair.split("=", 1)
            cookies.set(name.strip(), value.strip())

    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=httpx.Timeout(20.0, connect=10.0),
            headers=headers or build_browser_headers("https://www.trendyol.com/"),
            cookies=cookies,
        ) as client:
            response = client.get(url)
            payload: Any = None
            text = response.text
            content_type = response.headers.get("content-type", "")
            if "json" in content_type.lower():
                try:
                    payload = response.json()
                except json.JSONDecodeError:
                    payload = None
            return {
                "url": url,
                "method": method,
                "status": response.status_code,
                "response_headers": dict(response.headers),
                "content_type": content_type,
                "body_text": text[:200000],
                "json": payload,
                "source": "xhr_replay",
            }
    except Exception as exc:  # pragma: no cover - network failure path
        LOGGER.warning("Replay failed for %s: %s", url, exc)
        return None


def replay_runtime_requests(request_logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    replayed: list[dict[str, Any]] = []
    for log in request_logs:
        item = replay_request(log)
        if item is not None:
            replayed.append(item)
    return replayed
