"""Backend registry of TOPIK II writing tests.

The Railway deploy context is `backend/` only, so the test definitions are
kept here (mirroring `frontend/src/data/writing-tests/`) rather than read from
the frontend tree. The grader receives the full definition (prompts, 배점,
글자 수 limits) so it can score against the correct per-question max_points.
"""
from __future__ import annotations

import json
import pathlib
from functools import lru_cache
from typing import Any, Optional

_DATA_DIR = pathlib.Path(__file__).parent / "data" / "writing_tests"


@lru_cache(maxsize=1)
def _load_all() -> dict[str, dict[str, Any]]:
    tests: dict[str, dict[str, Any]] = {}
    if not _DATA_DIR.exists():
        return tests
    for path in sorted(_DATA_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        test_id = data.get("id")
        if test_id:
            tests[test_id] = data
    return tests


def get_test(test_id: str) -> Optional[dict[str, Any]]:
    return _load_all().get(test_id)


def max_score_for(test_id: str) -> int:
    test = get_test(test_id)
    if not test:
        return 0
    return sum(int(q.get("max_points", 0)) for q in test.get("questions", []))
