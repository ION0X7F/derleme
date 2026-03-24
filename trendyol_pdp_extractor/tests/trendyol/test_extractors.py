from __future__ import annotations

import unittest

from .helpers import load_fixture_case, run_fixture_case


class TrendyolExtractorParserTests(unittest.TestCase):
    def test_html_parser_extracts_primary_price_from_pdp(self) -> None:
        result = run_fixture_case("delta-mat")
        html_data = result["html_data"]
        self.assertEqual(html_data["price"], 497.89)
        self.assertEqual(html_data["normalized_price"], 497.89)
        self.assertEqual(html_data["extracted_sources"]["price"]["source"], "html")

    def test_embedded_parser_extracts_seller_and_core_fields(self) -> None:
        result = run_fixture_case("royal-canin")
        embedded = result["embedded_data"]
        self.assertEqual(embedded["brand"], "Royal Canin")
        self.assertEqual(embedded["merchant_id"], 776130)
        self.assertEqual(embedded["listing_id"], "7a3633b207a0868f0fed52c3539077a4")

    def test_runtime_parser_extracts_questions_reviews_and_similar(self) -> None:
        result = run_fixture_case("regal-washer")
        runtime = result["runtime_data"]
        self.assertEqual(runtime["question_count"], 80)
        self.assertTrue(len(runtime["qa_snippets"]) > 0)
        self.assertTrue(len(runtime["similar_product_candidates"]) > 0)

    def test_embedded_fixture_files_exist_for_all_cases(self) -> None:
        for name in ("royal-canin", "delta-mat", "regal-washer", "banyo-seti-campaign"):
            case = load_fixture_case(name)
            self.assertIsInstance(case.embedded_fixture, dict)
            self.assertTrue(case.html.strip().startswith("<html"))


if __name__ == "__main__":
    unittest.main()

