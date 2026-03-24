from __future__ import annotations

from copy import deepcopy
from typing import Any, Literal

Source = Literal[
    "html",
    "embedded_json",
    "runtime_xhr",
    "parser_inference",
    "derived_from_similar_products",
    "keyword_search",
    "not_found",
    "xhr",
    "heuristic",
]
Confidence = Literal["high", "medium", "low", "none"]


def _normalize_source(value: Source) -> Literal[
    "html",
    "embedded_json",
    "runtime_xhr",
    "parser_inference",
    "derived_from_similar_products",
    "keyword_search",
    "not_found",
]:
    if value == "xhr":
        return "runtime_xhr"
    if value == "heuristic":
        return "parser_inference"
    return value


def _normalize_confidence(source: str, value: Confidence) -> Literal["high", "medium", "low", "none"]:
    if source == "not_found":
        return "none"
    if value == "none":
        return "none"
    if source in {"parser_inference", "derived_from_similar_products", "keyword_search"} and value == "high":
        return "medium"
    return value

DEFAULT_PRODUCT: dict[str, Any] = {
    "title": None,
    "brand": None,
    "product_name": None,
    "sku": None,
    "model_code": None,
    "category": None,
    "price": None,
    "normalized_price": None,
    "original_price": None,
    "discount_rate": None,
    "currency": None,
    "image_count": None,
    "images": [],
    "primary_image": None,
    "primary_image_thumbnail": None,
    "rating_value": None,
    "review_count": None,
    "favorite_count": None,
    "seller_name": None,
    "merchant_id": None,
    "listing_id": None,
    "seller_score": None,
    "official_seller": None,
    "seller_badges": [],
    "has_free_shipping": None,
    "has_campaign": None,
    "promotion_labels": [],
    "coupon_offers": [],
    "cross_promotions": [],
    "shipping_days": None,
    "delivery_type": None,
    "best_seller_rank": None,
    "best_seller_badge": None,
    "other_sellers_count": None,
    "other_seller_offers": [],
    "other_sellers_summary": None,
    "similar_product_links": [],
    "similar_product_candidates": [],
    "question_count": None,
    "qa_snippets": [],
    "review_snippets": [],
    "review_summary": None,
    "review_themes": [],
    "description": None,
    "description_length": None,
    "bullet_points": [],
    "bullet_point_count": None,
    "product_url": None,
    "extracted_sources": {},
}


def make_empty_product(product_url: str | None = None) -> dict[str, Any]:
    product = deepcopy(DEFAULT_PRODUCT)
    product["product_url"] = product_url
    return product


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return len(value) == 0
    return False


def set_field(
    target: dict[str, Any],
    key: str,
    value: Any,
    source: Source,
    confidence: Confidence,
) -> None:
    if is_empty(value):
        return
    target[key] = value
    normalized_source = _normalize_source(source)
    target.setdefault("extracted_sources", {})[key] = {
        "source": normalized_source,
        "confidence": _normalize_confidence(normalized_source, confidence),
    }


def mark_missing(target: dict[str, Any], key: str) -> None:
    target.setdefault("extracted_sources", {})[key] = {
        "source": "not_found",
        "confidence": "none",
    }


def ensure_string_list(values: list[Any] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value is None:
            continue
        text = " ".join(str(value).split()).strip()
        if not text:
            continue
        if text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def merge_source_meta(
    base: dict[str, Any],
    overlay: dict[str, Any],
) -> dict[str, Any]:
    merged = deepcopy(base)
    merged_sources = deepcopy(base.get("extracted_sources", {}))
    for key, meta in overlay.get("extracted_sources", {}).items():
        merged_sources[key] = meta
    merged.update({k: v for k, v in overlay.items() if k != "extracted_sources"})
    merged["extracted_sources"] = merged_sources
    return merged
