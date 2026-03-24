from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .schemas import ensure_string_list, make_empty_product, set_field


def _text(node: Any) -> str | None:
    if node is None:
        return None
    text = " ".join(str(node.get_text(" ", strip=True) if hasattr(node, "get_text") else node).split()).strip()
    return text or None


def _normalize_price(value: str | None) -> float | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d,.\-]", "", value)
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _short_url(url: str | None) -> str | None:
    if not url:
        return None
    cleaned = url.strip()
    if cleaned.startswith("https://www.trendyol.com"):
        cleaned = cleaned.replace("https://www.trendyol.com", "", 1)
    if cleaned.startswith("http://www.trendyol.com"):
        cleaned = cleaned.replace("http://www.trendyol.com", "", 1)
    return cleaned if cleaned.startswith("/") else f"/{cleaned}"


def _thumbnail_url(url: str | None) -> str | None:
    if not url:
        return None
    cleaned = url.strip()
    if "cdn.dsmcdn.com" not in cleaned or "/mnresize/" in cleaned:
        return cleaned
    marker = ".com/"
    idx = cleaned.find(marker)
    if idx == -1:
        return cleaned
    path = cleaned[idx + len(marker) :]
    return f"https://cdn.dsmcdn.com/mnresize/120/120/{path.lstrip('/')}"


def _extract_datalayer_payload(html: str) -> dict[str, Any] | None:
    match = re.search(
        r'__PRODUCT_DETAIL__DATALAYER",\s*(\{.*?\})\);</script>',
        html,
        re.DOTALL,
    )
    if not match:
        return None
    raw = match.group(1)
    try:
        import json

        return json.loads(raw)
    except Exception:
        return None


def _extract_similar_candidates(soup: BeautifulSoup, product_url: str | None) -> list[dict[str, Any]]:
    current_short = None
    if product_url:
        parsed = urlparse(product_url)
        current_short = parsed.path

    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    for anchor in soup.select("a[href*='/p-']"):
        href = anchor.get("href")
        if not href:
            continue
        short = _short_url(href)
        if not short or short == current_short or "/sr?" in short:
            continue

        img = anchor.select_one("img[src], img[data-src]")
        title = _text(anchor.get("title")) or _text(img.get("alt")) if img else None
        if not title:
          title = _text(anchor)
        title = title[:180] if title else None

        img_url = None
        if img:
            img_url = img.get("src") or img.get("data-src")
            if img_url and "http" not in img_url:
                img_url = None

        price = None
        price_text = None
        for node in anchor.select("[class*='price'], [class*='prc'], [class*='amount'], span, div"):
            text = _text(node)
            if not text:
                continue
            if "TL" in text or "₺" in text:
                price_text = text
                break
        if price_text:
            price = _normalize_price(price_text)

        key = short or title or ""
        if not key or key in seen:
            continue
        seen.add(key)

        if not title and not img_url:
            continue

        candidates.append(
            {
                "title": title,
                "url": f"https://www.trendyol.com{short}" if short else None,
                "short_url": short,
                "price": price,
                "currency": "TRY" if price is not None else None,
                "thumbnail": _thumbnail_url(img_url),
                "image": img_url,
                "source_section": "html_related_products",
                "confidence": "low",
            }
        )

    return candidates[:12]


def extract_html_data(html: str, product_url: str | None = None) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    result = make_empty_product(product_url)
    datalayer = _extract_datalayer_payload(html)

    title = _text(soup.find("title"))
    if title:
        set_field(result, "title", title, "html", "medium")

    h1 = _text(soup.select_one("h1"))
    if h1:
        set_field(result, "product_name", h1, "html", "medium")

    brand = _text(
        soup.select_one('[data-testid="product-brand-name"]')
        or soup.select_one(".product-brand-name")
        or soup.select_one("a[href*='/brand/']")
    )
    if brand:
        set_field(result, "brand", brand, "html", "medium")

    category_nodes = soup.select('[data-testid="breadcrumb"] a, nav[aria-label*="breadcrumb"] a')
    categories = ensure_string_list([_text(node) for node in category_nodes])
    if categories:
        set_field(result, "category", "/".join(categories), "html", "medium")

    price_text = _text(
        soup.select_one('[data-testid="price-current-price"]')
        or soup.select_one('[class*="price-current"]')
        or soup.select_one('[class*="prc-dsc"]')
    )
    if price_text:
        price = _normalize_price(price_text)
        if price is not None:
            set_field(result, "price", price, "html", "medium")
            set_field(result, "normalized_price", price, "html", "medium")

    original_price_text = _text(
        soup.select_one('[data-testid="price-original-price"]')
        or soup.select_one('[class*="original-price"]')
        or soup.select_one('[class*="prc-org"]')
    )
    original_price = _normalize_price(original_price_text)
    if original_price is not None:
        set_field(result, "original_price", original_price, "html", "medium")

    if isinstance(datalayer, dict):
        datalayer_price = _normalize_price(datalayer.get("product_discounted_price") or datalayer.get("product_price"))
        datalayer_original = _normalize_price(datalayer.get("product_original_price"))
        if datalayer_price is not None:
            set_field(result, "price", datalayer_price, "html", "high")
            set_field(result, "normalized_price", datalayer_price, "html", "high")
        if datalayer_original is not None:
            set_field(result, "original_price", datalayer_original, "html", "high")
        seller_from_datalayer = _text(datalayer.get("product_merchant"))
        if seller_from_datalayer:
            set_field(result, "seller_name", seller_from_datalayer, "html", "high")

    images = []
    for node in soup.select("img[src], img[data-src], img[data-image]"):
        candidate = node.get("src") or node.get("data-src") or node.get("data-image")
        if not candidate:
            continue
        candidate = " ".join(str(candidate).split())
        if "http" not in candidate:
            continue
        if candidate in images:
            continue
        images.append(candidate)
    if images:
        set_field(result, "images", images, "html", "medium")
        set_field(result, "image_count", len(images), "heuristic", "medium")

    description_nodes = soup.select("#product-description, [class*='description']")
    description = None
    for node in description_nodes:
        text = _text(node)
        if text and (description is None or len(text) > len(description)):
            description = text
    if description:
        set_field(result, "description", description, "html", "medium")
        set_field(result, "description_length", len(description), "heuristic", "medium")

    bullet_points = ensure_string_list(
        [_text(node) for node in soup.select("#product-description li, [class*='description'] li")]
    )
    if bullet_points:
        set_field(result, "bullet_points", bullet_points, "html", "medium")
        set_field(result, "bullet_point_count", len(bullet_points), "heuristic", "medium")

    seller_name = _text(
        soup.select_one('[data-testid="seller-name"]')
        or soup.select_one('[class*="seller-name"]')
        or soup.select_one('[class*="merchant-name"]')
    )
    if seller_name:
        set_field(result, "seller_name", seller_name, "html", "medium")

    campaign_nodes = soup.select("[class*='campaign'], [class*='coupon'], [data-testid*='campaign']")
    promotions = ensure_string_list([_text(node) for node in campaign_nodes])
    if promotions:
        set_field(result, "has_campaign", True, "html", "medium")
        set_field(result, "promotion_labels", promotions, "html", "medium")
        set_field(result, "campaign_label", promotions[0], "html", "medium")

    if "kargo bedava" in html.lower():
        set_field(result, "has_free_shipping", True, "heuristic", "medium")

    similar_candidates = _extract_similar_candidates(soup, product_url)
    if similar_candidates:
        set_field(result, "similar_product_candidates", similar_candidates, "html", "low")
        set_field(
            result,
            "similar_product_links",
            ensure_string_list([item.get("url") for item in similar_candidates if isinstance(item, dict)]),
            "heuristic",
            "low",
        )

    return result
