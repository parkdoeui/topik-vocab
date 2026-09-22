"""Insert the checked language-review artifacts without altering existing records."""

from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy.orm import Session

from language_review_data import load_json, load_patterns, load_questions, load_review_sets
from models import (
    LanguageErrorExampleRecord,
    LanguageErrorPatternRecord,
    ReviewQuestionRecord,
    ReviewSetRecord,
)


def _example_id(item: dict[str, Any]) -> str:
    source = (
        f"{item['sourceAnswerId']}|{item['originalSentence']}|"
        f"{item['incorrectExpression']}|{item['naturalExpression']}"
    )
    return "example-" + hashlib.sha256(source.encode("utf-8")).hexdigest()[:24]


def seed_language_review(db: Session) -> None:
    """Add only missing authored data. Learner progress and existing seed rows are untouched."""
    known_set_ids = {row[0] for row in db.query(ReviewSetRecord.id).all()}
    for item in load_review_sets():
        if item["id"] not in known_set_ids:
            db.add(ReviewSetRecord(
                id=item["id"],
                title=item["title"],
                description=item["description"],
                set_position=item["setPosition"],
                question_count=20,
            ))

    known_pattern_ids = {row[0] for row in db.query(LanguageErrorPatternRecord.id).all()}
    for item in load_patterns():
        if item["id"] not in known_pattern_ids:
            db.add(LanguageErrorPatternRecord(
                id=item["id"],
                pattern=item["pattern"],
                category=item["category"],
                explanation=item["explanation"],
                difficulty=item["difficulty"],
                frequency=item["frequency"],
                source=item["source"],
                examples_json={
                    "correctExamples": item["correctExamples"],
                    "commonMistakes": item["commonMistakes"],
                    "confidence": item["confidence"],
                },
            ))
    db.flush()

    pattern_ids_by_name = {
        pattern: pattern_id
        for pattern_id, pattern in db.query(
            LanguageErrorPatternRecord.id, LanguageErrorPatternRecord.pattern
        ).all()
    }
    known_example_ids = {row[0] for row in db.query(LanguageErrorExampleRecord.id).all()}
    for item in load_json("language_errors.json"):
        example_id = _example_id(item)
        pattern_id = pattern_ids_by_name.get(item["pattern"])
        if example_id not in known_example_ids and pattern_id:
            db.add(LanguageErrorExampleRecord(
                id=example_id,
                pattern_id=pattern_id,
                source_answer_id=item["sourceAnswerId"],
                example_json=item,
            ))

    known_question_ids = {row[0] for row in db.query(ReviewQuestionRecord.id).all()}
    for item in load_questions():
        if item["id"] not in known_question_ids:
            db.add(ReviewQuestionRecord(
                id=item["id"],
                set_id=item["setId"],
                set_position=item["setPosition"],
                pattern_id=item["patternId"],
                question_type=item["type"],
                question_json=item,
            ))
    db.commit()
