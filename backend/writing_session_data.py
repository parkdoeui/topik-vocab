"""Build and read the durable JSON snapshot for a writing session."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping
from urllib.parse import urljoin


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def question_image_urls(
    question: Mapping[str, Any], question_asset_base_url: str
) -> list[str]:
    """Return absolute URLs for every image belonging to the test question."""
    paths = _string_list(question.get("image_urls"))
    singular = question.get("image_url")
    if isinstance(singular, str) and singular:
        paths.insert(0, singular)

    base = f"{question_asset_base_url.rstrip('/')}/"
    return list(dict.fromkeys(urljoin(base, path.lstrip("/")) for path in paths))


def test_snapshot(test: Mapping[str, Any], question_asset_base_url: str) -> dict[str, Any]:
    """Copy a test definition and normalize its per-question image URL lists."""
    snapshot = deepcopy(dict(test))
    questions = snapshot.get("questions")
    if not isinstance(questions, list):
        snapshot["questions"] = []
        return snapshot

    for question in questions:
        if isinstance(question, dict):
            question["image_urls"] = question_image_urls(
                question, question_asset_base_url
            )
    return snapshot


def empty_session_payload(
    test: Mapping[str, Any], question_asset_base_url: str
) -> dict[str, Any]:
    return {
        "test": test_snapshot(test, question_asset_base_url),
        "answers": {},
    }


def saved_answers(payload: object) -> dict[str, Any]:
    """Read answers from the current envelope or the legacy flat mapping."""
    if not isinstance(payload, dict):
        return {}
    answers = payload.get("answers")
    if isinstance(answers, dict):
        return answers
    return payload


def saved_test(payload: object) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    test = payload.get("test")
    return test if isinstance(test, dict) else None


def build_session_payload(
    test: Mapping[str, Any],
    submitted_answers: Mapping[str, Mapping[str, Any]],
    question_asset_base_url: str,
) -> dict[str, Any]:
    """Combine a server-owned test snapshot with normalized submitted answers."""
    snapshot = test_snapshot(test, question_asset_base_url)
    questions = {
        str(question.get("number")): question
        for question in snapshot.get("questions", [])
        if isinstance(question, dict) and question.get("number") is not None
    }

    answers: dict[str, dict[str, Any]] = {}
    for question_id, submitted in submitted_answers.items():
        question = questions.get(str(question_id), {})
        prompt_images = _string_list(question.get("image_urls"))
        answer_images = _string_list(submitted.get("answer_image_urls"))

        # Before answer_image_urls existed, image_urls represented uploaded answers.
        # Preserve any non-question URL when upgrading a legacy payload.
        legacy_images = _string_list(submitted.get("image_urls"))
        answer_images.extend(url for url in legacy_images if url not in prompt_images)
        answer_images = list(dict.fromkeys(answer_images))

        answers[str(question_id)] = {
            "image_urls": list(dict.fromkeys([*prompt_images, *answer_images])),
            "question_image_urls": prompt_images,
            "answer_image_urls": answer_images,
            "transcription": str(submitted.get("transcription", "")),
            "char_count": int(submitted.get("char_count", 0)),
        }

    return {"test": snapshot, "answers": answers}
