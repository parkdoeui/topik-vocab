"""Read-only Q53/Q54 source export for language-review curation.

Run from the backend directory:
    python scripts/export_language_review_sources.py --output /tmp/review-sources.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal
from models import WritingSessionRecord
from writing_session_data import saved_answers, saved_test
from writing_tests import get_test


def _question_for(test: dict[str, Any] | None, question_number: str) -> dict[str, Any]:
    for question in (test or {}).get("questions", []):
        if str(question.get("number")) == question_number:
            return question
    return {}


def _question_images(answer: dict[str, Any], question: dict[str, Any]) -> list[str]:
    saved = answer.get("question_image_urls")
    if isinstance(saved, list):
        return [str(url) for url in saved if str(url).strip()]
    image_url = question.get("image_url")
    return [str(image_url)] if isinstance(image_url, str) and image_url.strip() else []


def build_source(record: WritingSessionRecord, question_number: str) -> dict[str, Any] | None:
    answers = saved_answers(record.answers_json)
    answer = answers.get(question_number, {})
    transcription = str(answer.get("transcription", "")).strip() if isinstance(answer, dict) else ""
    if not transcription:
        return None

    test = saved_test(record.answers_json) or get_test(record.test_id)
    question = _question_for(test, question_number)
    grading_questions = (record.grading_json or {}).get("questions", {})
    grading = grading_questions.get(question_number, {}) if isinstance(grading_questions, dict) else {}
    details = grading.get("detailed_improvement_points", {}) if isinstance(grading, dict) else {}
    language_feedback = details.get("언어사용", []) if isinstance(details, dict) else []
    return {
        "sourceAnswerId": f"{record.id}:{question_number}",
        "sessionId": record.id,
        "testId": record.test_id,
        "examRound": (test or {}).get("round"),
        "questionNumber": int(question_number),
        "question": question.get("prompt", ""),
        "questionImageUrls": _question_images(answer, question) if isinstance(answer, dict) else [],
        "answer": transcription,
        "modelAnswer": grading.get("sample_answer", "") if isinstance(grading, dict) else "",
        "languageFeedback": language_feedback if isinstance(language_feedback, list) else [],
    }


def export_sources() -> list[dict[str, Any]]:
    """Return completed Q53/Q54 source rows without modifying the database."""
    db = SessionLocal()
    try:
        records = (
            db.query(WritingSessionRecord)
            .filter(WritingSessionRecord.status == "completed")
            .order_by(WritingSessionRecord.completed_at.asc())
            .all()
        )
        return [
            source
            for record in records
            for question_number in ("53", "54")
            if (source := build_source(record, question_number)) is not None
        ]
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sources = export_sources()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(sources)} Q53/Q54 sources to {args.output}")


if __name__ == "__main__":
    main()
