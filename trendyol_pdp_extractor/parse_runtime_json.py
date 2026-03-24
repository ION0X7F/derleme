from __future__ import annotations

from typing import Any

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
    text = "".join(char for char in str(value) if char.isdigit() or char in ",.-")
    if not text:
        return None
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def _iter_nodes(node: Any):
    yield node
    if isinstance(node, dict):
        for value in node.values():
            yield from _iter_nodes(value)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_nodes(item)


def _badge_list(node: Any) -> list[str]:
    if not isinstance(node, list):
        return []
    values: list[str] = []
    for item in node:
        if isinstance(item, str):
            values.append(item)
        elif isinstance(item, dict):
            values.append(item.get("type") or item.get("name") or item.get("text"))
    return ensure_string_list(values)


def _seller_offer_from_node(node: dict[str, Any], source_url: str) -> dict[str, Any] | None:
    name = _clean_text(node.get("name") or node.get("storeName") or node.get("sellerName"))
    if not name:
        return None

    price_record = node.get("price") if isinstance(node.get("price"), dict) else {}
    discounted = _normalize_price(
        price_record.get("discountedPrice")
        or price_record.get("sellingPrice")
        or node.get("price")
    )
    original_price = _normalize_price(
        price_record.get("originalPrice")
        or price_record.get("listPrice")
        or node.get("originalPrice")
    )
    discount_rate = None
    if discounted is not None and original_price is not None and original_price > discounted:
        discount_rate = round(((original_price - discounted) / original_price) * 100)

    shipping_days = None
    delivery_type = None
    if node.get("isFastDelivery") or node.get("fastDelivery"):
        shipping_days = 1
        delivery_type = "fast_delivery"

    return {
        "seller_name": name,
        "merchant_id": node.get("sellerId") or node.get("id"),
        "listing_id": _clean_text(node.get("listingId")),
        "price": discounted,
        "original_price": original_price,
        "discount_rate": discount_rate,
        "seller_score": node.get("sellerScore") or node.get("score"),
        "official_seller": bool(node.get("isOfficial")),
        "badges": _badge_list(node.get("sellerBadges") or node.get("merchantBadges")),
        "shipping_days": shipping_days,
        "delivery_type": delivery_type,
        "url": _clean_text(node.get("url")) or source_url,
        "source": "xhr",
        "confidence": "high",
    }


def _build_summary(offers: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not offers:
        return None
    prices = [offer["price"] for offer in offers if isinstance(offer.get("price"), (int, float))]
    scores = [offer["seller_score"] for offer in offers if isinstance(offer.get("seller_score"), (int, float))]
    return {
        "count": len(offers),
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "avg_price": round(sum(prices) / len(prices), 2) if prices else None,
        "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
        "top_score": max(scores) if scores else None,
        "seller_names": ensure_string_list([offer["seller_name"] for offer in offers])[:3],
    }


def _extract_review_payload(node: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any] | None, list[str]]:
    result = node.get("result") if isinstance(node.get("result"), dict) else node
    reviews = result.get("reviews") if isinstance(result, dict) else None
    summary = result.get("summary") if isinstance(result, dict) else None

    snippets: list[dict[str, Any]] = []
    if isinstance(reviews, list):
        for review in reviews:
            if not isinstance(review, dict):
                continue
            text = _clean_text(review.get("comment") or review.get("text"))
            if not text:
                continue
            snippets.append(
                {
                    "text": text,
                    "rating": review.get("rate") or review.get("rating"),
                    "seller_name": _clean_text((review.get("seller") or {}).get("name"))
                    if isinstance(review.get("seller"), dict)
                    else None,
                }
            )

    parsed_summary = None
    themes: list[str] = []
    if isinstance(summary, dict):
        rating_counts = summary.get("ratingCounts") if isinstance(summary.get("ratingCounts"), list) else []
        tags = summary.get("tags") if isinstance(summary.get("tags"), list) else []
        themes = ensure_string_list(
            [
                tag.get("name")
                for tag in tags
                if isinstance(tag, dict) and _clean_text(tag.get("name")) not in {"Tümü", "tümü", "Hepsi", "hepsi"}
            ]
        )
        parsed_summary = {
            "average_rating": summary.get("averageRating"),
            "total_comment_count": summary.get("totalCommentCount"),
            "total_rating_count": summary.get("totalRatingCount"),
            "total_image_review_count": summary.get("totalImageReviewCount"),
            "rating_counts": rating_counts,
        }
        if not any(
            parsed_summary.get(key) not in (None, [], {})
            for key in ("average_rating", "total_comment_count", "total_rating_count", "total_image_review_count", "rating_counts")
        ):
            parsed_summary = None

    return snippets, parsed_summary, themes


def _extract_question_payload(node: dict[str, Any]) -> tuple[int | None, list[dict[str, Any]]]:
    total_count = None
    snippets: list[dict[str, Any]] = []

    questions_block = node.get("questions")
    if isinstance(questions_block, dict):
        total_count = questions_block.get("totalElements") or questions_block.get("totalCount")
        contents = questions_block.get("content")
        if isinstance(contents, list):
            for item in contents:
                if not isinstance(item, dict):
                    continue
                question = _clean_text(item.get("text") or item.get("question") or item.get("originalText"))
                answer_obj = item.get("answer")
                answer = None
                if isinstance(answer_obj, dict):
                    answer = _clean_text(answer_obj.get("text") or answer_obj.get("originalText"))
                else:
                    answer = _clean_text(item.get("answer") or item.get("answerText"))
                if question:
                    snippets.append({"question": question, "answer": answer})

    content_summary = node.get("contentSummary")
    if total_count is None and isinstance(content_summary, dict):
        total_count = content_summary.get("totalCount")

    return int(total_count) if total_count is not None else None, snippets


def _extract_recommendation_products(node: dict[str, Any], source_url: str) -> list[dict[str, Any]]:
    result = node.get("result") if isinstance(node.get("result"), dict) else node
    products = result.get("products") if isinstance(result, dict) else None
    if not isinstance(products, list):
        return []

    source_section = "runtime_recommendation"
    lowered_url = source_url.lower()
    if "reco-products" in lowered_url and "recoType=similar".lower() in lowered_url:
        source_section = "runtime_similar_products"
    elif "reco-products" in lowered_url and "recoType=cross".lower() in lowered_url:
        source_section = "runtime_cross_products"
    elif "reco-slider" in lowered_url:
        source_section = "runtime_reco_slider"
    elif "collection-recommendation" in lowered_url:
        source_section = "runtime_collection_recommendation"

    candidates: list[dict[str, Any]] = []
    for product in products[:12]:
        if not isinstance(product, dict):
            continue
        prices = product.get("prices") if isinstance(product.get("prices"), dict) else {}
        rating_score = product.get("ratingScore") if isinstance(product.get("ratingScore"), dict) else {}
        social_proof = product.get("socialProof") if isinstance(product.get("socialProof"), dict) else {}
        url = _clean_text(product.get("url"))
        if url and url.startswith("/"):
            url = f"https://www.trendyol.com{url}"

        image = None
        images = product.get("images")
        if isinstance(images, list) and images:
            image = _clean_text(images[0])

        candidates.append(
            {
                "title": _clean_text(product.get("name")),
                "url": url,
                "short_url": _clean_text(product.get("url")),
                "price": _normalize_price(
                    (prices.get("discountedPrice") or {}).get("value")
                    if isinstance(prices.get("discountedPrice"), dict)
                    else prices.get("discountedPrice")
                ),
                "currency": _clean_text(prices.get("currency")),
                "brand": _clean_text((product.get("brand") or {}).get("name"))
                if isinstance(product.get("brand"), dict)
                else _clean_text(product.get("brand")),
                "sku": _clean_text(product.get("id")),
                "image": image,
                "thumbnail": image,
                "review_count": product.get("orderCount")
                or rating_score.get("totalCount")
                or social_proof.get("favoriteCount"),
                "rating_value": rating_score.get("averageRating"),
                "question_count": social_proof.get("basketCount"),
                "source_section": source_section,
                "confidence": "medium",
            }
        )
    return candidates


def _extract_coupon_offers(node: dict[str, Any]) -> list[dict[str, Any]]:
    result = node.get("result")
    if not isinstance(result, list):
        return []

    offers: list[dict[str, Any]] = []
    for item in result[:12]:
        if not isinstance(item, dict):
            continue
        offers.append(
            {
                "collect_id": _clean_text(item.get("collectId")),
                "discount": item.get("discount"),
                "discount_type": _clean_text(item.get("discountType")),
                "lower_limit": item.get("lowerLimit"),
                "end_date": _clean_text(item.get("endDate")),
                "created_by": _clean_text(item.get("createdBy")),
                "link": _clean_text(item.get("link")),
                "messages": ensure_string_list(
                    [
                        message.get("message")
                        for message in item.get("userMessages", [])
                        if isinstance(message, dict)
                    ]
                ),
                "is_mega_coupon": bool(item.get("isMegaCoupon")),
            }
        )
    return offers


def _extract_cross_promotions(node: dict[str, Any]) -> list[dict[str, Any]]:
    result = node.get("result") if isinstance(node.get("result"), dict) else None
    promotions = result.get("crossPromotions") if isinstance(result, dict) else None
    if not isinstance(promotions, list):
        return []

    items: list[dict[str, Any]] = []
    for promotion in promotions[:12]:
        if not isinstance(promotion, dict):
            continue
        selection = promotion.get("selectionContent") if isinstance(promotion.get("selectionContent"), dict) else {}
        award = promotion.get("awardContent") if isinstance(promotion.get("awardContent"), dict) else {}
        items.append(
            {
                "id": promotion.get("id"),
                "selection_product_name": _clean_text(selection.get("productName")),
                "selection_listing_id": _clean_text(selection.get("listingId")),
                "selection_price": _normalize_price((selection.get("price") or {}).get("discountedPrice")),
                "award_product_name": _clean_text(award.get("productName")),
                "award_listing_id": _clean_text(award.get("listingId")),
                "award_price": _normalize_price((award.get("price") or {}).get("discountedPrice")),
                "award_amount": promotion.get("awardAmount"),
                "award_amount_text": _clean_text(promotion.get("awardAmountText")),
                "total_order_amount": promotion.get("totalOrderAmount"),
                "total_order_amount_text": _clean_text(promotion.get("totalOrderAmountText")),
                "award_type": _clean_text(promotion.get("awardType")),
            }
        )
    return items


def extract_runtime_data(request_logs: list[dict[str, Any]]) -> dict[str, Any]:
    result = make_empty_product()
    offers: list[dict[str, Any]] = []
    qa_snippets: list[dict[str, Any]] = []
    review_snippets: list[dict[str, Any]] = []
    similar_candidates: list[dict[str, Any]] = []
    coupon_offers: list[dict[str, Any]] = []
    cross_promotions: list[dict[str, Any]] = []

    for log in request_logs:
        payload = log.get("json")
        if payload is None:
            continue

        for node in _iter_nodes(payload):
            if not isinstance(node, dict):
                continue

            is_product_level_node = any(
                key in node
                for key in (
                    "otherSellers",
                    "favoriteCount",
                    "questionCount",
                    "ratingScore",
                    "seller",
                    "merchantListing",
                    "merchant",
                    "listingId",
                )
            )

            if node.get("otherSellers") and isinstance(node["otherSellers"], list):
                for seller in node["otherSellers"]:
                    if isinstance(seller, dict):
                        offer = _seller_offer_from_node(seller, log.get("url") or "")
                        if offer:
                            offers.append(offer)

            if any(key in node for key in ("seller", "merchant")) and not result.get("seller_name"):
                seller = node.get("seller") if isinstance(node.get("seller"), dict) else node
                seller_name = _clean_text(
                    seller.get("name") or seller.get("storeName") or seller.get("sellerName")
                )
                if seller_name:
                    set_field(result, "seller_name", seller_name, "xhr", "high")
                seller_score = seller.get("sellerScore") or seller.get("score")
                if seller_score is not None:
                    set_field(result, "seller_score", float(seller_score), "xhr", "high")
                seller_id = seller.get("sellerId") or seller.get("id")
                if seller_id is not None:
                    set_field(result, "merchant_id", int(seller_id), "xhr", "high")
                listing_id = _clean_text(seller.get("listingId"))
                if listing_id:
                    set_field(result, "listing_id", listing_id, "xhr", "high")
                badges = _badge_list(seller.get("sellerBadges") or seller.get("merchantBadges"))
                if badges:
                    set_field(result, "seller_badges", badges, "xhr", "medium")
                if seller.get("isOfficial") is not None:
                    set_field(result, "official_seller", bool(seller.get("isOfficial")), "xhr", "high")

            if node.get("questionCount") is not None:
                set_field(result, "question_count", int(node["questionCount"]), "xhr", "medium")

            question_count, extracted_questions = _extract_question_payload(node)
            if question_count is not None:
                set_field(result, "question_count", question_count, "xhr", "high")
            if extracted_questions:
                qa_snippets.extend(extracted_questions)

            if node.get("favoriteCount") is not None:
                set_field(result, "favorite_count", int(node["favoriteCount"]), "xhr", "medium")

            if isinstance(node.get("ratingScore"), dict):
                rating_score = node["ratingScore"]
                if rating_score.get("averageRating") is not None:
                    set_field(result, "rating_value", float(rating_score["averageRating"]), "xhr", "high")
                review_count = rating_score.get("commentCount") or rating_score.get("totalCount")
                if review_count is not None:
                    set_field(result, "review_count", int(review_count), "xhr", "high")

            extracted_reviews, review_summary, review_themes = _extract_review_payload(node)
            if extracted_reviews:
                review_snippets.extend(extracted_reviews)
            if review_summary:
                set_field(result, "review_summary", review_summary, "xhr", "medium")
                review_count = review_summary.get("total_comment_count") or review_summary.get("total_rating_count")
                if review_count is not None:
                    set_field(result, "review_count", int(review_count), "xhr", "high")
                average_rating = review_summary.get("average_rating")
                if average_rating is not None:
                    set_field(result, "rating_value", float(average_rating), "xhr", "high")
            if review_themes:
                set_field(result, "review_themes", review_themes[:10], "xhr", "medium")

            if node.get("comments") and isinstance(node["comments"], list):
                for comment in node["comments"]:
                    if not isinstance(comment, dict):
                        continue
                    text = _clean_text(comment.get("comment") or comment.get("text"))
                    if not text:
                        continue
                    review_snippets.append(
                        {
                            "text": text,
                            "rating": comment.get("rate") or comment.get("rating"),
                        }
                    )

            if node.get("questions") and isinstance(node["questions"], list):
                for item in node["questions"]:
                    if not isinstance(item, dict):
                        continue
                    question = _clean_text(item.get("text") or item.get("question"))
                    answer = _clean_text(item.get("answer") or item.get("answerText"))
                    if question:
                        qa_snippets.append({"question": question, "answer": answer})

            recommendation_candidates = _extract_recommendation_products(node, log.get("url") or "")
            if recommendation_candidates:
                similar_candidates.extend(recommendation_candidates)

            extracted_coupon_offers = _extract_coupon_offers(node)
            if extracted_coupon_offers:
                coupon_offers.extend(extracted_coupon_offers)

            extracted_cross_promotions = _extract_cross_promotions(node)
            if extracted_cross_promotions:
                cross_promotions.extend(extracted_cross_promotions)

            if is_product_level_node and isinstance(node.get("price"), dict):
                price_node = node["price"]
                discounted = _normalize_price(
                    price_node.get("discountedPrice") or price_node.get("sellingPrice")
                )
                original = _normalize_price(price_node.get("originalPrice") or price_node.get("listPrice"))
                if discounted is not None:
                    set_field(result, "price", discounted, "xhr", "high")
                    set_field(result, "normalized_price", discounted, "xhr", "high")
                if original is not None:
                    set_field(result, "original_price", original, "xhr", "medium")
                    if discounted is not None and original > discounted:
                        set_field(
                            result,
                            "discount_rate",
                            round(((original - discounted) / original) * 100),
                            "heuristic",
                            "medium",
                        )

    if offers:
        deduped: list[dict[str, Any]] = []
        seen: set[tuple[Any, Any]] = set()
        for offer in offers:
            key = (offer.get("merchant_id"), offer.get("listing_id"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(offer)
        set_field(result, "other_seller_offers", deduped, "xhr", "high")
        set_field(result, "other_sellers_count", len(deduped), "heuristic", "high")
        summary = _build_summary(deduped)
        if summary:
            set_field(result, "other_sellers_summary", summary, "heuristic", "medium")

    if qa_snippets:
        deduped_questions: list[dict[str, Any]] = []
        seen_questions: set[tuple[Any, Any]] = set()
        for item in qa_snippets:
            key = (item.get("question"), item.get("answer"))
            if key in seen_questions:
                continue
            seen_questions.add(key)
            deduped_questions.append(item)
        set_field(result, "qa_snippets", deduped_questions[:10], "xhr", "medium")
    if review_snippets:
        deduped_reviews: list[dict[str, Any]] = []
        seen_reviews: set[tuple[Any, Any, Any]] = set()
        for item in review_snippets:
            key = (item.get("text"), item.get("rating"), item.get("seller_name"))
            if key in seen_reviews:
                continue
            seen_reviews.add(key)
            deduped_reviews.append(item)
        set_field(result, "review_snippets", deduped_reviews[:10], "xhr", "medium")
        if not result.get("review_summary"):
            set_field(
                result,
                "review_summary",
                {"sampled_count": len(deduped_reviews)},
                "heuristic",
                "low",
            )

    if similar_candidates:
        deduped_candidates: list[dict[str, Any]] = []
        seen_candidates: set[str] = set()
        for item in similar_candidates:
            key = item.get("url") or item.get("short_url") or item.get("title")
            if not key or key in seen_candidates:
                continue
            seen_candidates.add(key)
            deduped_candidates.append(item)
        set_field(result, "similar_product_candidates", deduped_candidates[:12], "xhr", "medium")
        set_field(
            result,
            "similar_product_links",
            ensure_string_list([item.get("url") for item in deduped_candidates if isinstance(item, dict)]),
            "heuristic",
            "medium",
        )

    if coupon_offers:
        deduped_coupon_offers: list[dict[str, Any]] = []
        seen_coupon_ids: set[str] = set()
        for item in coupon_offers:
            key = item.get("collect_id") or f"{item.get('discount')}|{item.get('lower_limit')}|{item.get('created_by')}"
            if not key or key in seen_coupon_ids:
                continue
            seen_coupon_ids.add(key)
            deduped_coupon_offers.append(item)
        set_field(result, "coupon_offers", deduped_coupon_offers, "xhr", "high")
        set_field(result, "has_campaign", True, "heuristic", "high")

    if cross_promotions:
        deduped_cross_promotions: list[dict[str, Any]] = []
        seen_cross_ids: set[str] = set()
        for item in cross_promotions:
            key = str(item.get("id") or f"{item.get('selection_listing_id')}|{item.get('award_listing_id')}")
            if not key or key in seen_cross_ids:
                continue
            seen_cross_ids.add(key)
            deduped_cross_promotions.append(item)
        set_field(result, "cross_promotions", deduped_cross_promotions, "xhr", "high")
        set_field(result, "has_campaign", True, "heuristic", "high")

    return result
