from __future__ import annotations

import json
import re
from typing import Any

from bs4 import BeautifulSoup

from .schemas import ensure_string_list, make_empty_product, set_field


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split()).strip()
    return text or None


def _normalize_price(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = re.sub(r"[^\d,.\-]", "", str(value))
    if not text:
        return None
    last_comma = text.rfind(",")
    last_dot = text.rfind(".")
    normalized = text
    if last_comma > -1 and last_dot > -1:
        if last_comma > last_dot:
            normalized = text.replace(".", "").replace(",", ".")
        else:
            normalized = text.replace(",", "")
    elif last_comma > -1:
        normalized = text.replace(".", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return None


def _build_short_url(url: str | None) -> str | None:
    cleaned = _clean_text(url)
    if not cleaned:
        return None
    if cleaned.startswith("https://www.trendyol.com/"):
        cleaned = cleaned.replace("https://www.trendyol.com", "", 1)
    if cleaned.startswith("http://www.trendyol.com/"):
        cleaned = cleaned.replace("http://www.trendyol.com", "", 1)
    return cleaned if cleaned.startswith("/") else f"/{cleaned}"


def _build_thumbnail_url(url: str | None) -> str | None:
    cleaned = _clean_text(url)
    if not cleaned:
        return None
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


def _search_paths(node: Any, *paths: tuple[Any, ...]) -> Any:
    for path in paths:
        current = node
        ok = True
        for key in path:
            if isinstance(current, list) and isinstance(key, int):
                if key >= len(current):
                    ok = False
                    break
                current = current[key]
                continue
            if not isinstance(current, dict) or key not in current:
                ok = False
                break
            current = current[key]
        if ok and current is not None:
            return current
    return None


def _parse_json_from_script(raw: str) -> list[Any]:
    results: list[Any] = []
    patterns = [
        r"window\.__NEXT_DATA__\s*=\s*(\{.*\})",
        r"window\.__INITIAL_STATE__\s*=\s*(\{.*\})",
        r'window\["__envoy_product-detail__PROPS"\]\s*=\s*(\{.*\})',
        r"window\.__PRODUCT_DETAIL_APP_INITIAL_STATE__\s*=\s*(\{.*\})",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, re.DOTALL)
        if not match:
            continue
        try:
            results.append(json.loads(match.group(1)))
        except json.JSONDecodeError:
            continue
    return results


def _collect_json_blobs(html: str) -> list[Any]:
    soup = BeautifulSoup(html, "lxml")
    blobs: list[Any] = []
    for script in soup.find_all("script"):
        raw = script.string or script.get_text(strip=False)
        if not raw:
            continue
        script_type = (script.get("type") or "").lower()
        if "application/ld+json" in script_type:
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                continue
            blobs.extend(parsed if isinstance(parsed, list) else [parsed])
            continue
        blobs.extend(_parse_json_from_script(raw))
    return blobs


def _extract_basic_product(product: dict[str, Any], target: dict[str, Any]) -> None:
    name = _clean_text(_search_paths(product, ("name",), ("productName",), ("title",)))
    if name:
        set_field(target, "title", name, "embedded_json", "high")
        set_field(target, "product_name", name, "embedded_json", "high")

    brand = _search_paths(product, ("brand", "name"), ("brand",))
    if brand:
        set_field(target, "brand", _clean_text(brand), "embedded_json", "high")

    sku = _clean_text(_search_paths(product, ("sku",), ("stockCode",), ("productCode",)))
    if sku:
        set_field(target, "sku", sku, "embedded_json", "high")

    model_code = _clean_text(_search_paths(product, ("modelCode",), ("merchantSku",), ("mpn",)))
    if model_code:
        set_field(target, "model_code", model_code, "embedded_json", "medium")

    category = _search_paths(
        product,
        ("category", "hierarchy"),
        ("category", "name"),
        ("navigation", "categoryName"),
        ("breadcrumb",),
    )
    if isinstance(category, list):
        category = "/".join(_clean_text(item) or "" for item in category if _clean_text(item))
    if category:
        set_field(target, "category", _clean_text(category), "embedded_json", "medium")

    price = _normalize_price(
        _search_paths(
            product,
            ("offers", "price"),
            ("price", "discountedPrice", "value"),
            ("price", "sellingPrice", "value"),
            ("price", "discountedPrice"),
            ("price", "sellingPrice"),
        )
    )
    if price is not None:
        set_field(target, "normalized_price", price, "embedded_json", "high")
        set_field(target, "price", price, "embedded_json", "high")

    original_price = _normalize_price(
        _search_paths(
            product,
            ("price", "originalPrice", "value"),
            ("price", "originalPrice"),
            ("price", "listPrice"),
        )
    )
    if original_price is not None:
        set_field(target, "original_price", original_price, "embedded_json", "medium")
        if price is not None and original_price > price:
            set_field(
                target,
                "discount_rate",
                round(((original_price - price) / original_price) * 100),
                "heuristic",
                "medium",
            )

    currency = _clean_text(_search_paths(product, ("offers", "priceCurrency"), ("price", "currency")))
    if currency:
        set_field(target, "currency", currency, "embedded_json", "high")

    images = _search_paths(product, ("images",), ("image",), ("media", "images"))
    image_urls: list[str] = []
    if isinstance(images, list):
        for item in images:
            if isinstance(item, str):
                image_urls.append(item)
            elif isinstance(item, dict):
                for key in ("url", "src", "imageUrl", "bigImageUrl", "zoomableUrl"):
                    value = _clean_text(item.get(key))
                    if value:
                        image_urls.append(value)
                        break
    image_urls = ensure_string_list(image_urls)
    if image_urls:
        set_field(target, "images", image_urls, "embedded_json", "high")
        set_field(target, "image_count", len(image_urls), "heuristic", "high")
        set_field(target, "primary_image", image_urls[0], "embedded_json", "high")
        set_field(target, "primary_image_thumbnail", _build_thumbnail_url(image_urls[0]), "heuristic", "medium")

    rating_value = _search_paths(product, ("aggregateRating", "ratingValue"), ("ratingScore", "averageRating"))
    if rating_value is not None:
        set_field(target, "rating_value", float(rating_value), "embedded_json", "high")

    review_count = _search_paths(
        product,
        ("aggregateRating", "reviewCount"),
        ("ratingScore", "commentCount"),
        ("ratingScore", "totalCount"),
    )
    if review_count is not None:
        set_field(target, "review_count", int(review_count), "embedded_json", "high")

    favorite_count = _search_paths(product, ("favoriteCount",), ("product", "favoriteCount"))
    if favorite_count is not None:
        set_field(target, "favorite_count", int(favorite_count), "embedded_json", "medium")

    description = _clean_text(_search_paths(product, ("description",), ("fullDescription",)))
    if description:
        set_field(target, "description", description, "embedded_json", "medium")
        set_field(target, "description_length", len(description), "heuristic", "medium")

    bullet_points = _search_paths(product, ("bulletPoints",), ("highlights",), ("features",))
    if isinstance(bullet_points, list):
        normalized = ensure_string_list(
            [item.get("text") if isinstance(item, dict) else item for item in bullet_points]
        )
        if normalized:
            set_field(target, "bullet_points", normalized, "embedded_json", "medium")
            set_field(target, "bullet_point_count", len(normalized), "heuristic", "medium")

    similar_links, similar_candidates = _extract_similar_product_candidates(product)
    if similar_links:
        set_field(target, "similar_product_links", similar_links, "embedded_json", "medium")
    if similar_candidates:
        set_field(target, "similar_product_candidates", similar_candidates, "embedded_json", "medium")


def _parse_promotion_labels(promotions: Any) -> list[str]:
    if not isinstance(promotions, list):
        return []
    labels: list[str] = []
    for item in promotions:
        if isinstance(item, str):
            labels.append(item)
        elif isinstance(item, dict):
            labels.extend(
                [
                    item.get("name"),
                    item.get("shortName"),
                    item.get("label"),
                    item.get("promotionText"),
                    item.get("campaignText"),
                ]
            )
    return ensure_string_list(labels)


def _parse_badges(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    labels: list[str] = []
    for item in raw:
        if isinstance(item, str):
            labels.append(item)
        elif isinstance(item, dict):
            labels.extend([item.get("name"), item.get("type"), item.get("text")])
    return ensure_string_list(labels)


def _parse_offer_price(raw: Any) -> tuple[float | None, float | None, int | None]:
    if not isinstance(raw, dict):
        return None, None, None
    discounted = raw.get("discountedPrice") or raw.get("sellingPrice") or raw.get("value")
    original = raw.get("originalPrice") or raw.get("listPrice") or raw.get("priceBeforeDiscount")
    if isinstance(discounted, dict):
        discounted = discounted.get("value") or discounted.get("text")
    if isinstance(original, dict):
        original = original.get("value") or original.get("text")
    price = _normalize_price(discounted)
    original_price = _normalize_price(original)
    discount_rate = None
    if price is not None and original_price is not None and original_price > price:
        discount_rate = round(((original_price - price) / original_price) * 100)
    return price, original_price, discount_rate


def _build_attribute_bullets(attributes: Any) -> list[str]:
    if not isinstance(attributes, list):
        return []
    bullets: list[str] = []
    for item in attributes:
        if not isinstance(item, dict):
            continue
        key_name = _clean_text(_search_paths(item, ("key", "name")))
        value_name = _clean_text(_search_paths(item, ("value", "name"), ("value",)))
        if not key_name or not value_name:
            continue
        bullets.append(f"{key_name}: {value_name}")
    return ensure_string_list(bullets)


def _extract_similar_product_candidates(product: dict[str, Any]) -> tuple[list[str], list[dict[str, Any]]]:
    links: list[str] = []
    candidates: list[dict[str, Any]] = []

    related_urls = _search_paths(product, ("isRelatedTo",))
    if isinstance(related_urls, list):
        for item in related_urls:
            url = _clean_text(item)
            if url and "/p-" in url:
                links.append(url)

    variants = _search_paths(product, ("hasVariant",))
    if isinstance(variants, list):
        for variant in variants[:12]:
            if not isinstance(variant, dict):
                continue
            offer = variant.get("offers") if isinstance(variant.get("offers"), dict) else {}
            url = _clean_text(offer.get("url")) or _clean_text(variant.get("url"))
            name = _clean_text(variant.get("name"))
            price = _normalize_price(offer.get("price"))
            currency = _clean_text(offer.get("priceCurrency"))
            brand = _clean_text(_search_paths(variant, ("brand", "name"), ("brand",)))
            sku = _clean_text(variant.get("sku"))
            image = _clean_text(variant.get("image"))
            if url and "/p-" in url:
                links.append(url)
            if not url and not name:
                continue
            candidates.append(
                {
                    "title": name,
                    "url": url,
                    "short_url": _build_short_url(url),
                    "price": price,
                    "currency": currency,
                    "brand": brand,
                    "sku": sku,
                    "image": image,
                    "thumbnail": _build_thumbnail_url(image),
                    "source_section": "has_variant",
                    "confidence": "medium",
                }
            )

    normalized_links = ensure_string_list(links)
    deduped_candidates: list[dict[str, Any]] = []
    seen_candidate_urls: set[str] = set()
    for candidate in candidates:
        url = candidate.get("url")
        key = url or f"{candidate.get('title')}|{candidate.get('sku')}"
        if not key or key in seen_candidate_urls:
            continue
        seen_candidate_urls.add(key)
        deduped_candidates.append(candidate)

    return normalized_links[:20], deduped_candidates[:12]


def _extract_envoy_product(product: dict[str, Any], target: dict[str, Any]) -> None:
    _extract_basic_product(product, target)

    merchant_listing = _search_paths(product, ("merchantListing",))
    main_merchant = _search_paths(product, ("merchantListing", "merchant"), ("merchant",))
    winner_variant = _search_paths(product, ("merchantListing", "winnerVariant"))
    rating_score = _search_paths(product, ("ratingScore",))
    category = _search_paths(product, ("category", "hierarchy"), ("category", "name"))
    if category:
        set_field(target, "category", _clean_text(category), "embedded_json", "high")

    if isinstance(rating_score, dict):
        if rating_score.get("averageRating") is not None:
            set_field(target, "rating_value", float(rating_score["averageRating"]), "embedded_json", "high")
        review_count = rating_score.get("commentCount") or rating_score.get("totalCount")
        if review_count is not None:
            set_field(target, "review_count", int(review_count), "embedded_json", "high")

    favorite_count = _search_paths(product, ("favoriteCount",))
    if favorite_count is not None:
        set_field(target, "favorite_count", int(favorite_count), "embedded_json", "high")

    question_count = _search_paths(product, ("questionCount",), ("merchantListing", "questionCount"))
    if question_count is not None:
        set_field(target, "question_count", int(question_count), "embedded_json", "medium")

    attributes = _search_paths(product, ("attributes",), ("productAttributes",), ("descriptiveAttributes",))
    attribute_bullets = _build_attribute_bullets(attributes)
    if attribute_bullets:
        set_field(target, "bullet_points", attribute_bullets, "embedded_json", "medium")
        set_field(target, "bullet_point_count", len(attribute_bullets), "heuristic", "medium")

    similar_links, similar_candidates = _extract_similar_product_candidates(product)
    if similar_links:
        set_field(target, "similar_product_links", similar_links, "embedded_json", "medium")
    if similar_candidates:
        set_field(target, "similar_product_candidates", similar_candidates, "embedded_json", "medium")

    if isinstance(main_merchant, dict):
        seller_name = _clean_text(main_merchant.get("name"))
        if seller_name:
            set_field(target, "seller_name", seller_name, "embedded_json", "high")
        merchant_id = main_merchant.get("id") or main_merchant.get("sellerId")
        if merchant_id is not None:
            set_field(target, "merchant_id", int(merchant_id), "embedded_json", "high")
        seller_score = _search_paths(main_merchant, ("sellerScore", "value"), ("sellerScore",))
        if seller_score is not None:
            set_field(target, "seller_score", float(seller_score), "embedded_json", "high")
        badges = _parse_badges(main_merchant.get("merchantBadges")) + _parse_badges(main_merchant.get("merchantMarkers"))
        badges = ensure_string_list(badges)
        if badges:
            set_field(target, "seller_badges", badges, "embedded_json", "medium")
        official = bool(main_merchant.get("officialName")) or any("yetkili" in badge.lower() or "official" in badge.lower() for badge in badges)
        if official:
            set_field(target, "official_seller", True, "heuristic", "medium")

    if isinstance(winner_variant, dict):
        listing_id = _clean_text(winner_variant.get("listingId"))
        if listing_id:
            set_field(target, "listing_id", listing_id, "embedded_json", "high")
        variant_price = winner_variant.get("price")
        if isinstance(variant_price, dict):
            price, original_price, discount_rate = _parse_offer_price(variant_price)
            if price is not None:
                set_field(target, "price", price, "embedded_json", "high")
                set_field(target, "normalized_price", price, "embedded_json", "high")
            if original_price is not None:
                set_field(target, "original_price", original_price, "embedded_json", "high")
            if discount_rate is not None:
                set_field(target, "discount_rate", discount_rate, "heuristic", "medium")
        quantity = winner_variant.get("quantity")
        if quantity is not None:
            set_field(target, "stock_quantity", int(quantity), "embedded_json", "medium")
        if winner_variant.get("freeCargo") is not None or winner_variant.get("hasFreeCargo") is not None:
            set_field(
                target,
                "has_free_shipping",
                bool(winner_variant.get("freeCargo") or winner_variant.get("hasFreeCargo")),
                "embedded_json",
                "high",
            )
        rush_duration = winner_variant.get("rushDeliveryDuration")
        if rush_duration is not None:
            set_field(target, "shipping_days", 1, "embedded_json", "medium")
        fulfilment_type = _clean_text(winner_variant.get("fulfilmentType"))
        if fulfilment_type:
            set_field(target, "delivery_type", fulfilment_type.lower(), "embedded_json", "high")

    promotions = _search_paths(product, ("merchantListing", "promotions"), ("promotions",))
    promotion_labels = _parse_promotion_labels(promotions)
    if promotion_labels:
        set_field(target, "promotion_labels", promotion_labels, "embedded_json", "medium")
        set_field(target, "has_campaign", True, "heuristic", "medium")
        set_field(target, "campaign_label", promotion_labels[0], "heuristic", "medium")

    in_stock = _search_paths(product, ("inStock",))
    if in_stock is not None:
        set_field(target, "stock_status", "in_stock" if in_stock else "out_of_stock", "heuristic", "medium")

    rankings = _search_paths(product, ("categoryTopRankings",))
    if isinstance(rankings, list):
        for item in rankings:
            if not isinstance(item, dict):
                continue
            name = _clean_text(item.get("name"))
            if name and "best" in name.lower():
                order = item.get("order")
                if order is not None:
                    set_field(target, "best_seller_rank", int(order), "embedded_json", "medium")
                    set_field(target, "best_seller_badge", f"Best Seller #{int(order)}", "heuristic", "medium")
                    break

    other_merchants = _search_paths(
        product,
        ("merchantListing", "otherMerchants"),
        ("otherMerchants",),
        ("otherMerchantList",),
        ("otherSellers",),
    )
    offers: list[dict[str, Any]] = []
    if isinstance(other_merchants, list):
        for merchant in other_merchants[:10]:
            if not isinstance(merchant, dict):
                continue
            variant = merchant.get("variants", [{}])
            variant_record = variant[0] if isinstance(variant, list) and variant else {}
            price, original_price, discount_rate = _parse_offer_price(merchant.get("price"))
            if price is None and isinstance(variant_record, dict):
                price, original_price, discount_rate = _parse_offer_price(variant_record.get("price"))
            offer = {
                "seller_name": _clean_text(merchant.get("name")),
                "merchant_id": merchant.get("id") or merchant.get("sellerId"),
                "listing_id": _clean_text(
                    variant_record.get("listingId") if isinstance(variant_record, dict) else None
                )
                or _clean_text(merchant.get("listingId")),
                "price": price,
                "original_price": original_price,
                "discount_rate": discount_rate,
                "seller_score": _search_paths(merchant, ("sellerScore", "value"), ("sellerScore",)),
                "official_seller": False,
                "badges": ensure_string_list(
                    _parse_badges(merchant.get("merchantBadges")) + _parse_badges(merchant.get("merchantMarkers"))
                ),
                "shipping_days": 1 if merchant.get("rushDelivery") else None,
                "delivery_type": (
                    _clean_text(variant_record.get("fulfilmentType")) if isinstance(variant_record, dict) else None
                ) or ("fast_delivery" if merchant.get("rushDelivery") else None),
                "url": _clean_text(merchant.get("url")),
                "source": "embedded_json",
                "confidence": "high",
            }
            if offer["seller_name"]:
                offers.append(offer)
    if offers:
        set_field(target, "other_seller_offers", offers, "embedded_json", "high")
        set_field(target, "other_sellers_count", len(offers), "heuristic", "high")
        prices = [offer["price"] for offer in offers if isinstance(offer.get("price"), (int, float))]
        scores = [offer["seller_score"] for offer in offers if isinstance(offer.get("seller_score"), (int, float))]
        summary = {
            "count": len(offers),
            "min_price": min(prices) if prices else None,
            "max_price": max(prices) if prices else None,
            "avg_price": round(sum(prices) / len(prices), 2) if prices else None,
            "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
            "top_score": max(scores) if scores else None,
            "seller_names": ensure_string_list([offer["seller_name"] for offer in offers])[:3],
        }
        set_field(target, "other_sellers_summary", summary, "heuristic", "medium")


def extract_embedded_json(html: str) -> dict[str, Any]:
    result = make_empty_product()
    blobs = _collect_json_blobs(html)
    for blob in blobs:
        if not isinstance(blob, dict):
            continue
        _extract_basic_product(blob, result)
        product = _search_paths(blob, ("product",), ("props", "pageProps", "product"))
        if isinstance(product, dict):
            _extract_basic_product(product, result)
            _extract_envoy_product(product, result)
        if isinstance(_search_paths(blob, ("product",)), dict):
            _extract_envoy_product(_search_paths(blob, ("product",)), result)
    return result
