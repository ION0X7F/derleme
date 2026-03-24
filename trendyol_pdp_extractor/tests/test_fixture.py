from __future__ import annotations

import json
import unittest
from pathlib import Path

from trendyol_pdp_extractor.normalize import merge_product_data
from trendyol_pdp_extractor.parse_embedded_json import extract_embedded_json
from trendyol_pdp_extractor.parse_html import extract_html_data
from trendyol_pdp_extractor.parse_runtime_json import extract_runtime_data


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "royal_canin_fixture.json"


class RoyalCaninFixtureTest(unittest.TestCase):
    def test_fixture_merge(self) -> None:
        fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

        html_data = extract_html_data(fixture["html"], fixture["url"])
        embedded_data = extract_embedded_json(fixture["html"])
        runtime_data = extract_runtime_data(fixture["request_logs"])
        merged = merge_product_data(html_data, embedded_data, runtime_data)

        self.assertEqual(merged["brand"], "Royal Canin")
        self.assertEqual(merged["seller_name"], "RIOBONGO")
        self.assertEqual(merged["merchant_id"], 776130)
        self.assertEqual(merged["listing_id"], "7a3633b207a0868f0fed52c3539077a4")
        self.assertEqual(merged["other_sellers_count"], 2)
        self.assertEqual(len(merged["other_seller_offers"]), 2)
        self.assertEqual(merged["other_seller_offers"][0]["seller_name"], "Er pet")
        self.assertEqual(merged["question_count"], 12)
        self.assertEqual(merged["normalized_price"], 6136.0)
        self.assertEqual(merged["extracted_sources"]["seller_name"]["source"], "runtime_xhr")


if __name__ == "__main__":
    unittest.main()
