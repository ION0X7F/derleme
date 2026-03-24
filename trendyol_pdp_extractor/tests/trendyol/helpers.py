from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from trendyol_pdp_extractor.normalize import merge_product_data
from trendyol_pdp_extractor.parse_embedded_json import extract_embedded_json
from trendyol_pdp_extractor.parse_html import extract_html_data
from trendyol_pdp_extractor.parse_runtime_json import extract_runtime_data


FIXTURE_ROOT = Path(__file__).resolve().parent.parent / "fixtures" / "trendyol"


@dataclass
class FixtureCase:
    name: str
    url: str
    html: str
    embedded_fixture: dict[str, Any]
    runtime_logs: list[dict[str, Any]]
    expected: dict[str, Any]


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_fixture_case(name: str) -> FixtureCase:
    case_dir = FIXTURE_ROOT / name
    html = (case_dir / "pdp.html").read_text(encoding="utf-8")
    embedded_fixture = _read_json(case_dir / "embedded.json")
    expected = _read_json(case_dir / "expected-normalized.json")

    runtime_logs: list[dict[str, Any]] = []
    for path in sorted(case_dir.glob("runtime-*.json")):
        payload = _read_json(path)
        if isinstance(payload, list):
            runtime_logs.extend(payload)
        else:
            runtime_logs.append(payload)

    return FixtureCase(
        name=name,
        url=expected["url"],
        html=html,
        embedded_fixture=embedded_fixture,
        runtime_logs=runtime_logs,
        expected=expected,
    )


def run_fixture_case(name: str) -> dict[str, Any]:
    case = load_fixture_case(name)
    html_data = extract_html_data(case.html, case.url)
    embedded_data = extract_embedded_json(case.html)
    runtime_data = extract_runtime_data(case.runtime_logs)
    merged = merge_product_data(html_data, embedded_data, runtime_data)
    return {
        "case": case,
        "html_data": html_data,
        "embedded_data": embedded_data,
        "runtime_data": runtime_data,
        "merged": merged,
    }


def get_by_path(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if isinstance(current, list):
            current = current[int(part)]
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def assert_expected_subset(testcase: Any, merged: dict[str, Any], expected: dict[str, Any]) -> None:
    for path, expected_value in expected.get("strict", {}).items():
        testcase.assertEqual(get_by_path(merged, path), expected_value, path)

    for path in expected.get("presence", []):
        value = get_by_path(merged, path)
        testcase.assertTrue(value not in (None, [], {}), path)

    for path in expected.get("absence", []):
        value = get_by_path(merged, path)
        testcase.assertTrue(value in (None, [], {}), path)

    for path, source_meta in expected.get("sources", {}).items():
        meta = get_by_path(merged, f"extracted_sources.{path}")
        testcase.assertIsInstance(meta, dict, path)
        testcase.assertEqual(meta.get("source"), source_meta["source"], f"{path}.source")
        testcase.assertEqual(meta.get("confidence"), source_meta["confidence"], f"{path}.confidence")

    for path in expected.get("null_or_low_confidence", []):
        value = get_by_path(merged, path)
        meta = get_by_path(merged, f"extracted_sources.{path}")
        testcase.assertTrue(value in (None, [], {}) or meta.get("confidence") in {"low", "none"}, path)

