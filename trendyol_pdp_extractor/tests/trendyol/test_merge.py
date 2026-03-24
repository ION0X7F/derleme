from __future__ import annotations

import unittest

from .helpers import run_fixture_case


class TrendyolExtractorMergeTests(unittest.TestCase):
    def test_html_price_is_not_overridden_by_embedded_variant_price(self) -> None:
        result = run_fixture_case("royal-canin")
        merged = result["merged"]
        self.assertEqual(merged["price"], 6136.0)
        self.assertEqual(merged["normalized_price"], 6136.0)
        self.assertEqual(merged["extracted_sources"]["price"]["source"], "html")

    def test_other_seller_offers_are_normalized(self) -> None:
        result = run_fixture_case("delta-mat")
        merged = result["merged"]
        self.assertEqual(merged["other_sellers_count"], 3)
        self.assertEqual(len(merged["other_seller_offers"]), 3)
        self.assertIsInstance(merged["other_seller_offers"][0]["merchant_id"], int)
        self.assertTrue(merged["other_seller_offers"][0]["url"])

    def test_single_seller_case_keeps_null_discipline_and_uses_similar_candidates(self) -> None:
        result = run_fixture_case("regal-washer")
        merged = result["merged"]
        self.assertIsNone(merged["other_sellers_count"])
        self.assertEqual(merged["extracted_sources"]["other_sellers_count"]["source"], "not_found")
        self.assertGreater(len(merged["similar_product_candidates"]), 0)

    def test_coupon_and_cross_promotion_payloads_do_not_break_merge(self) -> None:
        result = run_fixture_case("banyo-seti-campaign")
        merged = result["merged"]
        self.assertTrue(merged["has_campaign"])
        self.assertGreater(len(merged["coupon_offers"]), 0)
        self.assertGreater(len(merged["cross_promotions"]), 0)


if __name__ == "__main__":
    unittest.main()

