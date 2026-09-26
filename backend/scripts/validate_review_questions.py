"""Validate the shipped five-set language-review question bank."""

from __future__ import annotations

import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from language_review_data import load_patterns, load_questions, load_review_sets, normalize_expression, normalized_question

ALLOWED_CATEGORIES = {
    "particle", "verb_collocation", "noun_verb_collocation", "intransitive_transitive",
    "awkward_expression", "formal_writing", "spelling", "spacing",
}

QUESTION_TYPES = {
    "particle_choice": 30,
    "natural_sentence": 30,
    "error_correction": 20,
    "collocation_completion": 20,
}
SET_TYPES = {
    "particle_choice": 6,
    "natural_sentence": 6,
    "error_correction": 4,
    "collocation_completion": 4,
}


def validate_questions(
    questions: list[dict[str, Any]], patterns: list[dict[str, Any]] | None = None,
    review_sets: list[dict[str, Any]] | None = None,
) -> list[str]:
    errors: list[str] = []
    patterns = patterns if patterns is not None else load_patterns()
    review_sets = review_sets if review_sets is not None else load_review_sets()
    pattern_ids = {str(pattern.get("id")) for pattern in patterns}
    pattern_names = {str(pattern.get("pattern")) for pattern in patterns}
    expected_set_ids = {str(item.get("id")) for item in review_sets}

    if len(questions) != 100:
        errors.append(f"expected 100 questions, got {len(questions)}")
    if len(review_sets) != 5:
        errors.append(f"expected 5 review sets, got {len(review_sets)}")
    ids = [str(question.get("id", "")) for question in questions]
    if len(ids) != len(set(ids)):
        errors.append("question ids must be unique")

    counts = Counter(str(question.get("type")) for question in questions)
    if counts != Counter(QUESTION_TYPES):
        errors.append(f"unexpected global type counts: {dict(counts)}")
    by_set: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_normalized: set[str] = set()
    for question in questions:
        question_id = str(question.get("id", ""))
        qtype = str(question.get("type", ""))
        text = str(question.get("question", "")).strip()
        answer = str(question.get("answer", "")).strip()
        options = question.get("options")
        set_id = str(question.get("setId", ""))
        difficulty = question.get("difficulty")
        category = str(question.get("category", ""))
        source = str(question.get("source", ""))
        target_pattern = str(question.get("targetPattern", ""))
        pattern_id = str(question.get("patternId", ""))
        if not question_id or qtype not in QUESTION_TYPES or not text or not answer:
            errors.append(f"{question_id or '<missing id>'}: required question fields are missing")
        if not target_pattern or target_pattern not in pattern_names or pattern_id not in pattern_ids:
            errors.append(f"{question_id}: target pattern is missing or unknown")
        if not str(question.get("explanation", "")).strip():
            errors.append(f"{question_id}: explanation is missing")
        if category not in ALLOWED_CATEGORIES:
            errors.append(f"{question_id}: invalid category {category}")
        if source not in {"user_error", "general_topik"}:
            errors.append(f"{question_id}: invalid source {source}")
        if not isinstance(difficulty, int) or difficulty not in {1, 2, 3}:
            errors.append(f"{question_id}: difficulty must be 1, 2, or 3")
        if set_id not in expected_set_ids:
            errors.append(f"{question_id}: unknown setId {set_id}")
        by_set[set_id].append(question)
        signature = normalized_question(text + " " + " ".join(
            str(option) for option in (question.get("options") or [])
        ))
        if signature in seen_normalized:
            errors.append(f"{question_id}: normalized duplicate question")
        seen_normalized.add(signature)
        if not isinstance(options, list):
            errors.append(f"{question_id}: options must be an array")
            continue
        normalized_options = [normalize_expression(str(option)) for option in options]
        if len(normalized_options) != len(set(normalized_options)):
            errors.append(f"{question_id}: options must be unique")
        if len(options) != 4:
            errors.append(f"{question_id}: every question requires four options")
        if normalized_options.count(normalize_expression(answer)) != 1:
            errors.append(f"{question_id}: answer must match exactly one option")
        accepted = question.get("acceptedAnswers", [])
        if not isinstance(accepted, list) or len(accepted) != 1 or normalize_expression(str(accepted[0])) != normalize_expression(answer):
            errors.append(f"{question_id}: only the canonical choice answer may be accepted")

    if set(by_set) != expected_set_ids:
        errors.append("question set membership does not match review set definitions")
    for set_id, items in sorted(by_set.items()):
        if len(items) != 20:
            errors.append(f"{set_id}: expected 20 questions, got {len(items)}")
        positions = sorted(item.get("setPosition") for item in items)
        if positions != list(range(1, 21)):
            errors.append(f"{set_id}: setPosition must be contiguous from 1 through 20")
        type_counts = Counter(str(item.get("type")) for item in items)
        if type_counts != Counter(SET_TYPES):
            errors.append(f"{set_id}: unexpected type counts {dict(type_counts)}")
    for pattern_id, items in defaultdict(list, {
        pattern: [question for question in questions if question.get("patternId") == pattern]
        for pattern in pattern_ids
    }).items():
        types = {str(item.get("type")) for item in items}
        if len(items) > 5 or (items and len(types) < 4):
            errors.append(f"{pattern_id}: pattern repetition lacks required variation")
    return errors


def main() -> None:
    errors = validate_questions(load_questions())
    if errors:
        print("Review question validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        raise SystemExit(1)
    questions = load_questions()
    by_set = Counter(str(item["setId"]) for item in questions)
    type_counts = Counter(str(item["type"]) for item in questions)
    print(f"Valid: {len(questions)} questions across {len(by_set)} sets")
    print("Global: " + ", ".join(f"{name}={type_counts[name]}" for name in QUESTION_TYPES))
    for set_id in sorted(by_set):
        counts = Counter(item["type"] for item in questions if item["setId"] == set_id)
        print(f"{set_id}: {by_set[set_id]} (" + ", ".join(f"{name}={counts[name]}" for name in SET_TYPES) + ")")


if __name__ == "__main__":
    main()
