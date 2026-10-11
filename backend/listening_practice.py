"""Listening 43–44 sets and server-graded, immutable attempt reviews."""

import hashlib
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
from models import ListeningAttemptRecord
from listening_39_data import load_listening_39_sets

DATA = Path(__file__).parent / "data/listening_practice"
_bank = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
_config = json.loads((DATA / "audio-config.json").read_text(encoding="utf-8"))
_manifest = json.loads((DATA / "audio-manifest.json").read_text(encoding="utf-8"))
if _manifest["config_sha256"] != hashlib.sha256(json.dumps(_config, sort_keys=True).encode()).hexdigest():
    raise RuntimeError("Regenerate listening 43–44 audio after changing its settings")
_answers = {item["set_id"]: {answer["number"]: answer for answer in item["answers"]}
            for item in _bank["answer_key"]}
LISTENING_SETS = {}
for item in _bank["sets"]:
    track = _manifest["tracks"][item["id"]]
    if track["source_sha256"] != hashlib.sha256(item["passage"].encode()).hexdigest():
        raise RuntimeError(f"Regenerate listening audio for {item['id']}")
    LISTENING_SETS[item["id"]] = {
        **item,
        "practice_type": "43-44",
        "notice": "창작 연습 문제이며 실제 기출문제가 아닙니다.",
        "audio": {key: track[key] for key in ("path", "duration_seconds", "stages")},
        "questions": [
            {**question, "id": f"{item['id']}-{question['number']}",
             "options": [question["options"][str(index)] for index in range(1, 5)],
             **{key: _answers[item["id"]][question["number"]][key]
                for key in ("correct_option", "explanation")}}
            for question in item["questions"]
        ],
    }
LISTENING_SETS.update(load_listening_39_sets())

ListeningPracticeType = Literal["43-44", "39-40"]

router = APIRouter(prefix="/api", tags=["listening practice"])


class ListeningAnswerInput(BaseModel):
    question_id: str = Field(min_length=1, max_length=120)
    selected_option: int = Field(ge=1, le=4, strict=True)


class ListeningAttemptInput(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    set_id: str = Field(min_length=1, max_length=120)
    replay_count: int = Field(ge=0, le=1_000_000, strict=True)
    answers: list[ListeningAnswerInput] = Field(min_length=2, max_length=2)


def set_summary(item: dict[str, Any]) -> dict[str, Any]:
    return {key: item[key] for key in ("id", "practice_type", "title", "topics", "combination", "notice")} | {
        "question_count": len(item["questions"]),
        "audio_duration_seconds": item["audio"]["duration_seconds"],
    }


def attempt_summary(record: ListeningAttemptRecord) -> dict[str, Any]:
    return {
        "id": record.id, "set_id": record.set_id, "set_title": record.set_title,
        "practice_type": record.attempt_json["practice_type"],
        "completed_at": record.completed_at.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
        "correct_count": record.correct_count,
        "question_count": len(record.attempt_json["questions"]),
        "replay_count": record.replay_count,
    }


def attempt_review(record: ListeningAttemptRecord) -> dict[str, Any]:
    return attempt_summary(record) | record.attempt_json


def existing_attempt(record: ListeningAttemptRecord, payload: ListeningAttemptInput,
                     response: Response) -> dict[str, Any]:
    saved = {question["id"]: question["selected_option"]
             for question in record.attempt_json["questions"]}
    submitted = {answer.question_id: answer.selected_option for answer in payload.answers}
    if (record.set_id != payload.set_id or record.replay_count != payload.replay_count
            or len(submitted) != len(payload.answers) or saved != submitted):
        raise HTTPException(status_code=409, detail="Attempt id already used for different answers or replays")
    response.status_code = 200
    return attempt_review(record)


@router.get("/listening-sets")
def list_listening_sets(practice_type: ListeningPracticeType = "43-44") -> list[dict[str, Any]]:
    return [set_summary(item) for item in LISTENING_SETS.values() if item["practice_type"] == practice_type]


@router.get("/listening-sets/{set_id}")
def get_listening_set(set_id: str) -> dict[str, Any]:
    item = LISTENING_SETS.get(set_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Listening set not found")
    # Only review responses contain the transcript, answers, and explanations.
    return set_summary(item) | {
        "audio": item["audio"],
        "questions": [{key: question[key] for key in ("id", "number", "type", "prompt", "options")}
                      for question in item["questions"]],
    }


@router.post("/listening-attempts", status_code=201)
def submit_listening_attempt(payload: ListeningAttemptInput, response: Response,
                             db: Session = Depends(get_db)) -> dict[str, Any]:
    existing = db.get(ListeningAttemptRecord, payload.id)
    if existing is not None:
        return existing_attempt(existing, payload, response)
    item = LISTENING_SETS.get(payload.set_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Listening set not found")
    submitted = {answer.question_id: answer.selected_option for answer in payload.answers}
    expected = {question["id"] for question in item["questions"]}
    if len(submitted) != len(payload.answers) or set(submitted) != expected:
        raise HTTPException(status_code=422, detail="Answer both questions in this set exactly once")
    questions = [deepcopy(question) | {
        "selected_option": submitted[question["id"]],
        "correct": submitted[question["id"]] == question["correct_option"],
    } for question in item["questions"]]
    record = ListeningAttemptRecord(
        id=payload.id, set_id=item["id"], set_title=item["title"],
        completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
        correct_count=sum(question["correct"] for question in questions),
        replay_count=payload.replay_count,
        attempt_json={
            "practice_type": item["practice_type"],
            "passage": item["passage"], "audio": deepcopy(item["audio"]),
            "topics": item["topics"], "notice": item["notice"], "questions": questions,
        },
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.get(ListeningAttemptRecord, payload.id)
        if existing is None:
            raise
        return existing_attempt(existing, payload, response)
    db.refresh(record)
    return attempt_review(record)


@router.get("/listening-attempts")
def list_listening_attempts(practice_type: ListeningPracticeType = "43-44",
                           db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [attempt_summary(record) for record in db.query(ListeningAttemptRecord).order_by(
        ListeningAttemptRecord.completed_at.desc(), ListeningAttemptRecord.id.desc()
    ).all() if record.attempt_json["practice_type"] == practice_type]


@router.get("/listening-attempts/{attempt_id}")
def get_listening_attempt(attempt_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    record = db.get(ListeningAttemptRecord, attempt_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Listening attempt not found")
    return attempt_review(record)
