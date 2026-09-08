import base64
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import FastAPI, Depends, HTTPException, Response, Cookie, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from config import settings
from database import engine, get_db
from models import Base, TestSessionRecord, WritingSessionRecord
from ai_writing_grader import (
    transcribe_handwriting,
    grade_writing_submission,
    WritingGraderError,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TOPIK Vocab API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "X-TOPIK-Passcode"],
)


# ---------- Pydantic request / response models ----------

class LoginRequest(BaseModel):
    passcode: str


class AuthSessionResponse(BaseModel):
    authenticated: bool


class UserAnswerSchema(BaseModel):
    question_id: int
    user_answer: str
    is_correct: bool
    time_spent_ms: int
    question_type: Optional[str] = None
    topic: Optional[str] = None


class ScoreSchema(BaseModel):
    correct: int
    total: int


class SessionCreate(BaseModel):
    id: str
    test_id: str
    section: str  # "reading" | "listening"
    started_at: str   # ISO 8601
    completed_at: str  # ISO 8601
    total_time_ms: int
    answers: list[UserAnswerSchema]
    score: ScoreSchema

    @field_validator("section")
    @classmethod
    def validate_section(cls, value: str) -> str:
        if value not in {"reading", "listening"}:
            raise ValueError("section must be 'reading' or 'listening'")
        return value


class SessionResponse(BaseModel):
    id: str
    test_id: str
    section: str
    started_at: str
    completed_at: str
    total_time_ms: int
    answers: list[dict[str, Any]]
    score: ScoreSchema

    model_config = {"from_attributes": True}


class SectionAccuracy(BaseModel):
    correct: int
    total: int


class PerSectionAccuracy(BaseModel):
    reading: SectionAccuracy = Field(default_factory=lambda: SectionAccuracy(correct=0, total=0))
    listening: SectionAccuracy = Field(default_factory=lambda: SectionAccuracy(correct=0, total=0))


class TopicAccuracy(BaseModel):
    topic: str
    correct: int
    total: int
    accuracy: float


class ProgressResponse(BaseModel):
    total_sessions: int
    per_section_accuracy: PerSectionAccuracy
    score_history: list[dict[str, Any]]
    per_topic_accuracy: list[TopicAccuracy]


class WritingAnswerInput(BaseModel):
    """Per-question answer for a writing submission."""
    image_urls: list[str] = Field(default_factory=list, max_length=10)
    transcription: str = Field(default="", max_length=20000)
    char_count: int = Field(default=0, ge=0)


class WritingSubmitRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    test_id: str = Field(min_length=1, max_length=120)
    started_at: str
    completed_at: str
    total_time_ms: int
    answers: dict[str, WritingAnswerInput] = Field(default_factory=dict)

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, value: dict[str, WritingAnswerInput]) -> dict[str, WritingAnswerInput]:
        if not value:
            raise ValueError("answers must not be empty")
        return value


class WritingSessionResponse(BaseModel):
    id: str
    test_id: str
    started_at: str
    completed_at: str
    total_time_ms: int
    answers: dict[str, Any]
    grading: dict[str, Any]

    model_config = {"from_attributes": True}


class TranscribeImageInput(BaseModel):
    """Base64-encoded image with MIME type."""
    data: str = Field(description="Base64-encoded image bytes")
    mime_type: str = Field(default="image/jpeg")


class TranscribeRequest(BaseModel):
    images: list[TranscribeImageInput] = Field(min_length=1, max_length=10)


class TranscribeResult(BaseModel):
    transcription: str
    char_count: int


class TranscribeResponse(BaseModel):
    results: list[TranscribeResult]


# ---------- Helpers ----------

def verify_passcode(passcode: str) -> None:
    if passcode != settings.valid_passcode:
        raise HTTPException(status_code=403, detail="Invalid passcode")


def require_authenticated(
    passcode_header: Optional[str] = Header(default=None, alias="X-TOPIK-Passcode"),
    passcode_cookie: Optional[str] = Cookie(default=None, alias="topik_passcode"),
) -> None:
    """Header is primary (Safari blocks third-party cookies); cookie is secondary convenience."""
    if passcode_header == settings.valid_passcode:
        return
    if passcode_cookie == settings.valid_passcode:
        return
    raise HTTPException(status_code=403, detail="Authentication required")


def cookie_settings_for_request(request: Request) -> dict[str, Any]:
    origin = request.headers.get("origin", "")
    if origin.startswith("https://"):
        return {"samesite": "none", "secure": True}
    return {"samesite": "lax", "secure": False}


def parse_iso_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = f"{value[:-1]}+00:00"
    return datetime.fromisoformat(value)


def score_from_answers(answers: list[dict[str, Any]]) -> ScoreSchema:
    correct = sum(1 for a in answers if a.get("is_correct"))
    total = len(answers)
    return ScoreSchema(correct=correct, total=total)


def session_to_response(record: TestSessionRecord) -> SessionResponse:
    answers: list[dict[str, Any]] = record.answers_json  # type: ignore[assignment]
    score = score_from_answers(answers)
    return SessionResponse(
        id=record.id,
        test_id=record.test_id,
        section=record.section,
        started_at=record.started_at.isoformat(),
        completed_at=record.completed_at.isoformat(),
        total_time_ms=record.total_time_ms,
        answers=answers,
        score=score,
    )


def writing_session_to_response(record: WritingSessionRecord) -> WritingSessionResponse:
    return WritingSessionResponse(
        id=record.id,
        test_id=record.test_id,
        started_at=record.started_at.isoformat(),
        completed_at=record.completed_at.isoformat(),
        total_time_ms=record.total_time_ms,
        answers=record.answers_json,  # type: ignore[arg-type]
        grading=record.grading_json,  # type: ignore[arg-type]
    )


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login", status_code=204)
def login(payload: LoginRequest, request: Request, response: Response):
    verify_passcode(payload.passcode)
    response.set_cookie(
        key="topik_passcode",
        value=settings.valid_passcode,
        httponly=True,
        **cookie_settings_for_request(request),
    )


@app.get("/api/auth/session", response_model=AuthSessionResponse)
def auth_session(
    passcode_header: Optional[str] = Header(default=None, alias="X-TOPIK-Passcode"),
    passcode_cookie: Optional[str] = Cookie(default=None, alias="topik_passcode"),
):
    authenticated = (
        passcode_header == settings.valid_passcode
        or passcode_cookie == settings.valid_passcode
    )
    return AuthSessionResponse(authenticated=authenticated)


@app.post("/api/sessions", response_model=SessionResponse, status_code=201)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    existing = db.get(TestSessionRecord, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail="Session already exists")

    answers_json = [a.model_dump() for a in payload.answers]
    score = score_from_answers(answers_json)

    record = TestSessionRecord(
        id=payload.id,
        test_id=payload.test_id,
        section=payload.section,
        passcode=settings.valid_passcode,
        started_at=parse_iso_datetime(payload.started_at),
        completed_at=parse_iso_datetime(payload.completed_at),
        total_time_ms=payload.total_time_ms,
        score_correct=score.correct,
        score_total=score.total,
        answers_json=answers_json,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return session_to_response(record)


@app.put("/api/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: str,
    payload: SessionCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    if payload.id != session_id:
        raise HTTPException(status_code=400, detail="Session ID mismatch")

    record = db.get(TestSessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    if record.passcode != settings.valid_passcode:
        raise HTTPException(status_code=403, detail="Invalid passcode")

    answers_json = [a.model_dump() for a in payload.answers]
    score = score_from_answers(answers_json)

    record.test_id = payload.test_id
    record.section = payload.section
    record.started_at = parse_iso_datetime(payload.started_at)
    record.completed_at = parse_iso_datetime(payload.completed_at)
    record.total_time_ms = payload.total_time_ms
    record.score_correct = score.correct
    record.score_total = score.total
    record.answers_json = answers_json
    db.commit()
    db.refresh(record)
    return session_to_response(record)


@app.get("/api/sessions", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    records = (
        db.query(TestSessionRecord)
        .filter(TestSessionRecord.passcode == settings.valid_passcode)
        .order_by(TestSessionRecord.completed_at.desc())
        .all()
    )
    return [session_to_response(r) for r in records]


@app.get("/api/progress", response_model=ProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    records = (
        db.query(TestSessionRecord)
        .filter(TestSessionRecord.passcode == settings.valid_passcode)
        .order_by(TestSessionRecord.completed_at.asc())
        .all()
    )

    empty_section = SectionAccuracy(correct=0, total=0)
    if not records:
        return ProgressResponse(
            total_sessions=0,
            per_section_accuracy=PerSectionAccuracy(
                reading=empty_section, listening=empty_section
            ),
            score_history=[],
            per_topic_accuracy=[],
        )

    # Per-section accuracy
    section_stats: dict[str, dict[str, int]] = {
        "reading": {"correct": 0, "total": 0},
        "listening": {"correct": 0, "total": 0},
    }
    for r in records:
        section = r.section
        if section not in section_stats:
            section_stats[section] = {"correct": 0, "total": 0}
        section_stats[section]["correct"] += r.score_correct
        section_stats[section]["total"] += r.score_total

    per_section = PerSectionAccuracy(
        reading=SectionAccuracy(**section_stats["reading"]),
        listening=SectionAccuracy(**section_stats.get("listening", {"correct": 0, "total": 0})),
    )

    # Score history
    score_history = [
        {
            "date": r.completed_at.isoformat(),
            "test_id": r.test_id,
            "section": r.section,
            "correct": r.score_correct,
            "total": r.score_total,
        }
        for r in records
    ]

    # Per-topic accuracy (reading tests with topic field on answers)
    topic_stats: dict[str, dict[str, int]] = {}
    for r in records:
        answers: list[dict[str, Any]] = r.answers_json  # type: ignore[assignment]
        for a in answers:
            topic = a.get("topic")
            if not topic:
                continue
            if topic not in topic_stats:
                topic_stats[topic] = {"correct": 0, "total": 0}
            topic_stats[topic]["total"] += 1
            if a.get("is_correct"):
                topic_stats[topic]["correct"] += 1

    per_topic: list[TopicAccuracy] = []
    for topic, stats in topic_stats.items():
        accuracy = stats["correct"] / stats["total"] if stats["total"] > 0 else 0.0
        per_topic.append(
            TopicAccuracy(
                topic=topic,
                correct=stats["correct"],
                total=stats["total"],
                accuracy=round(accuracy * 100, 1),
            )
        )

    return ProgressResponse(
        total_sessions=len(records),
        per_section_accuracy=per_section,
        score_history=score_history,
        per_topic_accuracy=per_topic,
    )


@app.post("/api/writing-sessions/transcribe", response_model=TranscribeResponse)
def transcribe(
    payload: TranscribeRequest,
    _: None = Depends(require_authenticated),
):
    """Transcribe handwriting images using Gemini multimodal OCR."""
    if not settings.grader_api_key and not settings.vertex_project:
        raise HTTPException(status_code=503, detail="Transcription service is not configured")

    try:
        image_bytes_list = [base64.b64decode(img.data) for img in payload.images]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {exc}") from exc

    mime_types = [img.mime_type for img in payload.images]

    try:
        results = transcribe_handwriting(
            images=image_bytes_list,
            mime_types=mime_types,
            api_key=settings.grader_api_key,
            project=settings.vertex_project,
            location=settings.vertex_location,
            credentials_json=settings.vertex_credentials_json,
        )
    except WritingGraderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Transcription service unavailable") from exc

    return TranscribeResponse(
        results=[TranscribeResult(**r) for r in results]
    )


@app.post("/api/writing-sessions", response_model=WritingSessionResponse, status_code=201)
def create_writing_session(
    payload: WritingSubmitRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    if not settings.grader_api_key and not settings.vertex_project:
        raise HTTPException(status_code=503, detail="Writing grader is not configured")

    existing = db.get(WritingSessionRecord, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail="Writing session already exists")

    # Build answers JSON (keyed by question id string)
    answers_json = {qid: a.model_dump() for qid, a in payload.answers.items()}

    try:
        grading = grade_writing_submission(
            test={"id": payload.test_id},
            answers={qid: a.model_dump() for qid, a in payload.answers.items()},
            api_key=settings.grader_api_key,
            project=settings.vertex_project,
            location=settings.vertex_location,
            credentials_json=settings.vertex_credentials_json,
            model=settings.writing_grader_model,
        )
    except WritingGraderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Writing grader unavailable") from exc

    record = WritingSessionRecord(
        id=payload.id,
        test_id=payload.test_id,
        passcode=settings.valid_passcode,
        started_at=parse_iso_datetime(payload.started_at),
        completed_at=parse_iso_datetime(payload.completed_at),
        total_time_ms=payload.total_time_ms,
        answers_json=answers_json,
        grading_json=grading,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return writing_session_to_response(record)


@app.get("/api/writing-sessions", response_model=list[WritingSessionResponse])
def list_writing_sessions(
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    records = (
        db.query(WritingSessionRecord)
        .filter(WritingSessionRecord.passcode == settings.valid_passcode)
        .order_by(WritingSessionRecord.completed_at.desc())
        .all()
    )
    return [writing_session_to_response(r) for r in records]


@app.get("/api/writing-sessions/{session_id}", response_model=WritingSessionResponse)
def get_writing_session(
    session_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    record = db.get(WritingSessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Writing session not found")
    if record.passcode != settings.valid_passcode:
        raise HTTPException(status_code=403, detail="Authentication required")
    return writing_session_to_response(record)
