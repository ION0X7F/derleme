from __future__ import annotations

import unittest

from .helpers import run_fixture_case


class TrendyolExtractorConfidenceTests(unittest.TestCase):
    def test_high_confidence_fields_have_expected_sources(self) -> None:
        merged = run_fixture_case("delta-mat")["merged"]
        self.assertEqual(merged["extracted_sources"]["price"]["source"], "html")
        self.assertEqual(merged["extracted_sources"]["price"]["confidence"], "high")
        self.assertEqual(merged["extracted_sources"]["seller_name"]["source"], "embedded_json")
        self.assertEqual(merged["extracted_sources"]["seller_name"]["confidence"], "high")

    def test_similar_product_fallback_never_gets_high_confidence(self) -> None:
        merged = run_fixture_case("regal-washer")["merged"]
        self.assertEqual(
            merged["extracted_sources"]["similar_product_candidates"]["source"],
            "runtime_xhr",
        )
        self.assertIn(
            merged["extracted_sources"]["similar_product_candidates"]["confidence"],
            {"medium", "low"},
        )

    def test_missing_or_unreliable_fields_are_none_or_low_confidence(self) -> None:
        merged = run_fixture_case("royal-canin")["merged"]
        self.assertIsNone(merged["model_code"])
        self.assertEqual(merged["extracted_sources"]["model_code"]["source"], "not_found")
        self.assertEqual(merged["extracted_sources"]["model_code"]["confidence"], "none")

    def test_parser_inference_fields_do_not_get_high_confidence(self) -> None:
        merged = run_fixture_case("delta-mat")["merged"]
        self.assertEqual(
            merged["extracted_sources"]["other_sellers_count"]["source"],
            "parser_inference",
        )
        self.assertNotEqual(
            merged["extracted_sources"]["other_sellers_count"]["confidence"],
            "high",
        )


if __name__ == "__main__":
    unittest.main()
