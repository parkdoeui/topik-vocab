"""Load and normalize checked language-review JSON artifacts."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data" / "language_review"


def normalize_expression(value: str) -> str:
    return " ".join(value.strip().split()).rstrip(".!?")


def normalized_question(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]+", "", normalize_expression(value).lower())


def load_json(name: str) -> list[dict[str, Any]]:
    value = json.loads((DATA_DIR / name).read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"{name} must contain a JSON array")
    return [item for item in value if isinstance(item, dict)]


def load_patterns() -> list[dict[str, Any]]:
    return load_json("patterns.json")


def load_questions() -> list[dict[str, Any]]:
    return load_json("questions.json")


def load_review_sets() -> list[dict[str, Any]]:
    return load_json("review_sets.json")


def aggregate_patterns(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate reviewed extraction rows without losing distinct examples."""
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for error in errors:
        pattern = normalize_expression(str(error.get("pattern", "")))
        category = str(error.get("category", ""))
        if pattern and category:
            grouped[(pattern, category)].append(error)

    output: list[dict[str, Any]] = []
    for (pattern, category), items in sorted(grouped.items()):
        correct_examples = list(dict.fromkeys(
            normalize_expression(str(item.get("naturalExpression", "")))
            for item in items if item.get("naturalExpression")
        ))
        common_mistakes = list(dict.fromkeys(
            normalize_expression(str(item.get("incorrectExpression", "")))
            for item in items if item.get("incorrectExpression")
        ))
        output.append({
            "pattern": pattern,
            "category": category,
            "correctExamples": correct_examples,
            "commonMistakes": common_mistakes,
            "frequency": len(items),
        })
    return output
