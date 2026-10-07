"""TOPIK reading practice sets and durable, server-graded reviews."""

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import ReadingAttemptRecord


_bank = json.loads(
    (Path(__file__).parent / "data/reading_practice/questions.json").read_text(
        encoding="utf-8"
    )
)
TOPICS = ("기술", "환경", "도시", "문화")
_questions_by_topic = {
    topic: [question for question in _bank["questions"] if question["topic"] == topic]
    for topic in TOPICS
}
READING_SETS = {
    f"reading-28-31-{index + 1:02d}": {
        "id": f"reading-28-31-{index + 1:02d}",
        "practice_type": "28-31",
        "title": f"읽기 28–31 · {index + 1}세트",
        "instruction": _bank["instruction"],
        "notice": _bank["notice"],
        "points_per_question": _bank["points_per_question"],
        "questions": [_questions_by_topic[topic][index] for topic in TOPICS],
    }
    for index in range(5)
}
_additional_sets = json.loads(
    (Path(__file__).parent / "data/reading_practice/additional-sets.json").read_text(
        encoding="utf-8"
    )
)
for practice_set in _additional_sets:
    READING_SETS[practice_set["id"]] = {
        "practice_type": "28-31",
        "instruction": _bank["instruction"],
        "notice": _bank["notice"],
        "points_per_question": _bank["points_per_question"],
        **practice_set,
    }

_reading_19_bank = json.loads(
    (Path(__file__).parent / "data/reading_practice/reading-19.json").read_text(
        encoding="utf-8"
    )
)
_reading_19_questions = {
    question["id"]: question for question in _reading_19_bank["questions"]
}
for practice_set in _reading_19_bank["sets"]:
    READING_SETS[practice_set["id"]] = {
        "id": practice_set["id"],
        "title": practice_set["title"],
        "practice_type": "19",
        "instruction": _reading_19_bank["instruction"],
        "notice": _reading_19_bank["notice"],
        "guidance": _reading_19_bank["guidance"],
        "points_per_question": _reading_19_bank["points_per_question"],
        "questions": [
            _reading_19_questions[question_id]
            for question_id in practice_set["question_ids"]
        ],
    }

ReadingPracticeType = Literal["28-31", "19"]
router = APIRouter(prefix="/api", tags=["reading practice"])


class ReadingAnswerInput(BaseModel):
    question_id: str = Field(min_length=1, max_length=120)
    selected_option: int = Field(ge=1, le=4, strict=True)


class ReadingAttemptInput(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    set_id: str = Field(min_length=1, max_length=120)
    answers: list[ReadingAnswerInput] = Field(min_length=4, max_length=6)


def set_summary(practice_set: dict[str, Any]) -> dict[str, Any]:
    return {
        key: practice_set[key]
        for key in ("id", "title", "practice_type", "notice", "points_per_question")
    } | {
        "guidance": practice_set.get("guidance"),
        "topics": [question["topic"] for question in practice_set["questions"]],
        "question_count": len(practice_set["questions"]),
    }


def public_set(practice_set: dict[str, Any]) -> dict[str, Any]:
    return set_summary(practice_set) | {
        "instruction": practice_set["instruction"],
        "questions": [
            {key: question[key] for key in ("id", "topic", "prompt", "options")}
            for question in practice_set["questions"]
        ],
    }


def attempt_summary(record: ReadingAttemptRecord) -> dict[str, Any]:
    snapshot = record.attempt_json
    question_count = len(snapshot["questions"])
    points = snapshot["points_per_question"]
    return {
        "id": record.id,
        "set_id": record.set_id,
        "set_title": record.set_title,
        "practice_type": snapshot.get("practice_type", "28-31"),
        "completed_at": record.completed_at.replace(tzinfo=timezone.utc)
        .isoformat().replace("+00:00", "Z"),
        "correct_count": record.correct_count,
        "question_count": question_count,
        "score": record.correct_count * points,
        "max_score": question_count * points,
    }


def attempt_review(record: ReadingAttemptRecord) -> dict[str, Any]:
    return attempt_summary(record) | record.attempt_json


def existing_attempt(
    record: ReadingAttemptRecord, payload: ReadingAttemptInput, response: Response
) -> dict[str, Any]:
    saved = {
        question["id"]: question["selected_option"]
        for question in record.attempt_json["questions"]
    }
    submitted = {answer.question_id: answer.selected_option for answer in payload.answers}
    if (
        record.set_id != payload.set_id
        or len(submitted) != len(payload.answers)
        or saved != submitted
    ):
        raise HTTPException(status_code=409, detail="Attempt id already used for different answers")
    response.status_code = 200
    return attempt_review(record)


@router.get("/reading-sets")
def list_reading_sets(
    practice_type: ReadingPracticeType = "28-31",
) -> list[dict[str, Any]]:
    return [
        set_summary(practice_set)
        for practice_set in READING_SETS.values()
        if practice_set["practice_type"] == practice_type
    ]


@router.get("/reading-sets/{set_id}")
def get_reading_set(set_id: str) -> dict[str, Any]:
    practice_set = READING_SETS.get(set_id)
    if practice_set is None:
        raise HTTPException(status_code=404, detail="Reading set not found")
    return public_set(practice_set)


@router.post("/reading-attempts", status_code=201)
def submit_reading_attempt(
    payload: ReadingAttemptInput, response: Response, db: Session = Depends(get_db)
) -> dict[str, Any]:
    existing = db.get(ReadingAttemptRecord, payload.id)
    if existing is not None:
        return existing_attempt(existing, payload, response)

    practice_set = READING_SETS.get(payload.set_id)
    if practice_set is None:
        raise HTTPException(status_code=404, detail="Reading set not found")
    submitted = {answer.question_id: answer.selected_option for answer in payload.answers}
    expected = {question["id"] for question in practice_set["questions"]}
    if len(submitted) != len(payload.answers) or set(submitted) != expected:
        raise HTTPException(status_code=422, detail="Answer each question in this set exactly once")

    questions = [
        deepcopy(question) | {
            "selected_option": submitted[question["id"]],
            "correct": submitted[question["id"]] == question["correct_option"],
        }
        for question in practice_set["questions"]
    ]
    record = ReadingAttemptRecord(
        id=payload.id,
        set_id=practice_set["id"],
        set_title=practice_set["title"],
        completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        correct_count=sum(question["correct"] for question in questions),
        attempt_json={
            "practice_type": practice_set["practice_type"],
            "instruction": practice_set["instruction"],
            "points_per_question": practice_set["points_per_question"],
            "questions": questions,
        },
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.get(ReadingAttemptRecord, payload.id)
        if existing is None:
            raise
        return existing_attempt(existing, payload, response)
    db.refresh(record)
    return attempt_review(record)


@router.get("/reading-attempts")
def list_reading_attempts(
    practice_type: ReadingPracticeType = "28-31",
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    records = db.query(ReadingAttemptRecord).order_by(
        ReadingAttemptRecord.completed_at.desc(), ReadingAttemptRecord.id.desc()
    ).all()
    return [
        attempt_summary(record)
        for record in records
        if record.attempt_json.get("practice_type", "28-31") == practice_type
    ]


@router.get("/reading-attempts/{attempt_id}")
def get_reading_attempt(attempt_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    record = db.get(ReadingAttemptRecord, attempt_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Reading attempt not found")
    return attempt_review(record)
