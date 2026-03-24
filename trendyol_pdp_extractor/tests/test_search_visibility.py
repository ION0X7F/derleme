import unittest

from trendyol_pdp_extractor.search_visibility import _extract_product_id, _normalize_product_path


class SearchVisibilityHelpersTest(unittest.TestCase):
    def test_normalize_product_path(self) -> None:
        url = "https://www.trendyol.com/delta/konfor-zemin-10-mm-tasima-askili-pilates-minderi-yoga-mati-mor-p-3701455?boutiqueId=61"
        self.assertEqual(
            _normalize_product_path(url),
            "/delta/konfor-zemin-10-mm-tasima-askili-pilates-minderi-yoga-mati-mor-p-3701455",
        )

    def test_extract_product_id(self) -> None:
        self.assertEqual(_extract_product_id("/delta/test-p-3701455"), "3701455")


if __name__ == "__main__":
    unittest.main()
