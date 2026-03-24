from __future__ import annotations

import unittest

from .helpers import assert_expected_subset, run_fixture_case


class TrendyolRegressionSnapshotTests(unittest.TestCase):
    def test_expected_snapshots(self) -> None:
        for name in ("royal-canin", "delta-mat", "regal-washer", "banyo-seti-campaign"):
            result = run_fixture_case(name)
            assert_expected_subset(self, result["merged"], result["case"].expected)


if __name__ == "__main__":
    unittest.main()
