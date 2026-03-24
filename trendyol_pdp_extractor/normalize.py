from __future__ import annotations

from copy import deepcopy
from typing import Any

from .schemas import ensure_string_list, is_empty, make_empty_product, merge_source_meta, set_field

SOURCE_PRIORITY = {
    "not_found": 0,
    "parser_inference": 1,
    "derived_from_similar_products": 1,
    "keyword_search": 1,
    "heuristic": 1,
    "html": 2,
    "embedded_json": 3,
    "runtime_xhr": 4,
    "xhr": 4,
}


def _build_thumbnail_url(url: str | None) -> str | None:
    if not isinstance(url, str) or not url.strip():
        return None
    cleaned = url.strip()
    if "cdn.dsmcdn.com" not in cleaned:
        return cleaned
    if "/mnresize/" in cleaned:
        return cleaned
    marker = ".com/"
    idx = cleaned.find(marker)
    if idx == -1:
        return cleaned
    path = cleaned[idx + len(marker) :]
    return f"https://cdn.dsmcdn.com/mnresize/120/120/{path.lstrip('/')}"


PROTECTED_HTML_FIELDS = {
    "price",
    "normalized_price",
    "original_price",
}


def _should_replace(
    key: str,
    current_value: Any,
    incoming_value: Any,
    current_meta: dict[str, Any] | None,
    incoming_meta: dict[str, Any] | None,
) -> bool:
    if not incoming_meta:
        return False
    if not current_meta:
        return True
    if (
        key in PROTECTED_HTML_FIELDS
        and current_meta.get("source") == "html"
        and current_meta.get("confidence") in {"high", "medium"}
        and current_value not in (None, "", [])
        and incoming_value not in (None, "", [])
    ):
        return False
    current_priority = SOURCE_PRIORITY.get(current_meta.get("source"), 0)
    incoming_priority = SOURCE_PRIORITY.get(incoming_meta.get("source"), 0)
    return incoming_priority >= current_priority


def _apply_layer(target: dict[str, Any], layer: dict[str, Any]) -> None:
    layer_sources = layer.get("extracted_sources") or {}
    target_sources = target.setdefault("extracted_sources", {})
    for key, value in layer.items():
        if key == "extracted_sources":
            continue
        if is_empty(value):
            continue
        incoming_meta = layer_sources.get(key)
        current_meta = target_sources.get(key)
        if _should_replace(key, target.get(key), value, current_meta, incoming_meta):
            target[key] = deepcopy(value)
            if incoming_meta:
                target_sources[key] = deepcopy(incoming_meta)


def _derive_fields(target: dict[str, Any]) -> None:
    images = ensure_string_list(target.get("images"))
    if images and not target.get("image_count"):
        set_field(target, "image_count", len(images), "heuristic", "high")
    if images and not target.get("primary_image"):
        set_field(target, "primary_image", images[0], "heuristic", "high")
    if target.get("primary_image") and not target.get("primary_image_thumbnail"):
        thumbnail = _build_thumbnail_url(target.get("primary_image"))
        if thumbnail:
            set_field(target, "primary_image_thumbnail", thumbnail, "heuristic", "medium")

    description = target.get("description")
    if isinstance(description, str) and description.strip() and not target.get("description_length"):
        set_field(target, "description_length", len(description.strip()), "heuristic", "high")

    bullet_points = ensure_string_list(target.get("bullet_points"))
    if bullet_points and not target.get("bullet_point_count"):
        set_field(target, "bullet_point_count", len(bullet_points), "heuristic", "high")

    offers = target.get("other_seller_offers") or []
    if isinstance(offers, list) and offers and not target.get("other_sellers_count"):
        set_field(target, "other_sellers_count", len(offers), "heuristic", "high")

    similar_candidates = target.get("similar_product_candidates") or []
    if isinstance(similar_candidates, list) and similar_candidates and not target.get("similar_product_links"):
        links = ensure_string_list(
            [candidate.get("url") for candidate in similar_candidates if isinstance(candidate, dict)]
        )
        if links:
            set_field(target, "similar_product_links", links, "heuristic", "medium")

    if target.get("promotion_labels") and target.get("has_campaign") is None:
        set_field(target, "has_campaign", True, "heuristic", "medium")


def _fill_not_found_markers(target: dict[str, Any]) -> None:
    target_sources = target.setdefault("extracted_sources", {})
    for key in list(target.keys()):
        if key == "extracted_sources":
            continue
        value = target.get(key)
        value_is_empty = is_empty(value)
        target_sources.setdefault(
            key,
            {
                "source": "not_found" if value_is_empty else "parser_inference",
                "confidence": "none" if value_is_empty else "medium",
            },
        )


def merge_product_data(
    html_data: dict[str, Any],
    embedded_data: dict[str, Any],
    runtime_data: dict[str, Any],
) -> dict[str, Any]:
    merged = make_empty_product(html_data.get("product_url") or embedded_data.get("product_url"))
    merged = merge_source_meta(merged, html_data)
    _apply_layer(merged, html_data)
    _apply_layer(merged, embedded_data)
    _apply_layer(merged, runtime_data)
    _derive_fields(merged)
    _fill_not_found_markers(merged)
    return merged
