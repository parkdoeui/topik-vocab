import base64
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, Depends, HTTPException, Response, Cookie, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from config import settings
from database import engine, get_db
from models import (
    Base,
    PracticeAttemptRecord,
    WritingSessionRecord,
    WritingSessionStartRecord,
)
from writing_tests import get_test, max_score_for
from ai_writing_grader import (
    transcribe_handwriting,
    count_non_whitespace_characters,
    grade_writing_submission,
    WritingGraderError,
)
from auth import encode_passcode_for_transport, passcode_matches_transport

Base.metadata.create_all(bind=engine)


def ensure_writing_session_count_columns() -> None:
    """Add saved long-answer counts to databases created before this release."""
    inspector = inspect(engine)
    if "writing_sessions" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("writing_sessions")}
    missing = [
        column
        for column in ("q53_char_count", "q54_char_count")
        if column not in existing
    ]
    if not missing:
        return

    with engine.begin() as connection:
        for column in missing:
            connection.execute(text(f"ALTER TABLE writing_sessions ADD COLUMN {column} INTEGER"))


ensure_writing_session_count_columns()

app = FastAPI(title="TOPIK II Writing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-TOPIK-Passcode"],
)


# ---------- Pydantic request / response models ----------

class LoginRequest(BaseModel):
    passcode: str


class AuthSessionResponse(BaseModel):
    authenticated: bool


class WritingAnswerInput(BaseModel):
    """Per-question answer for a writing submission."""
    image_urls: list[str] = Field(default_factory=list, max_length=10)
    transcription: str = Field(default="", max_length=20000)
    char_count: int = Field(default=0, ge=0)


class WritingSessionStartRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    test_id: str = Field(min_length=1, max_length=120)


class WritingSessionStartResponse(BaseModel):
    id: str
    test_id: str
    started_at: str
    completed_at: Optional[str] = None
    total_time_ms: Optional[int] = None


class WritingSubmitRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    test_id: str = Field(min_length=1, max_length=120)
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
    q53_char_count: int
    q54_char_count: int
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


class WritingSessionSummary(BaseModel):
    id: str
    test_id: str
    date: str
    total_score: float
    max_score: float


class ProgressResponse(BaseModel):
    total_sessions: int
    average_score: float  # mean percent across sessions (0–100)
    sessions: list[WritingSessionSummary]


class PracticeBlankInput(BaseModel):
    marker: str = Field(min_length=1, max_length=20)
    submitted_answer: str = Field(min_length=1, max_length=500)
    model_answer: str = Field(min_length=1, max_length=500)
    accepted_variants: list[str] = Field(default_factory=list, max_length=10)
    focus: str = Field(min_length=1, max_length=120)
    feedback: str = Field(min_length=1, max_length=1000)

    @field_validator("submitted_answer", "model_answer", "focus", "feedback")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("value must not be blank")
        return trimmed

    @field_validator("accepted_variants")
    @classmethod
    def trim_variants(cls, value: list[str]) -> list[str]:
        variants = [variant.strip() for variant in value if variant.strip()]
        if len(variants) != len(value):
            raise ValueError("accepted_variants must not contain blank values")
        return variants


class PracticeQuestionInput(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    prompt: str = Field(min_length=1, max_length=10000)
    elapsed_ms: int = Field(ge=0, le=3_600_000)
    blanks: list[PracticeBlankInput] = Field(min_length=1, max_length=5)

    @field_validator("blanks")
    @classmethod
    def require_unique_markers(
        cls, value: list[PracticeBlankInput]
    ) -> list[PracticeBlankInput]:
        markers = [blank.marker for blank in value]
        if len(markers) != len(set(markers)):
            raise ValueError("blank markers must be unique within a question")
        return value


class PracticeAttemptSubmitRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    set_id: str = Field(min_length=1, max_length=120)
    set_title: str = Field(min_length=1, max_length=240)
    question_type: str = Field(min_length=1, max_length=120)
    started_at: datetime
    completed_at: datetime
    total_time_ms: int = Field(ge=0, le=36_000_000)
    target_seconds_per_question: int = Field(ge=1, le=3600)
    questions: list[PracticeQuestionInput] = Field(min_length=10, max_length=10)

    @field_validator("questions")
    @classmethod
    def require_unique_question_ids(
        cls, value: list[PracticeQuestionInput]
    ) -> list[PracticeQuestionInput]:
        ids = [question.id for question in value]
        if len(ids) != len(set(ids)):
            raise ValueError("question ids must be unique")
        return value


class PracticeAttemptSummary(BaseModel):
    id: str
    set_id: str
    set_title: str
    completed_at: str
    total_time_ms: int
    question_count: int
    within_target_count: int


class PracticeAttemptResponse(PracticeAttemptSummary):
    question_type: str
    started_at: str
    target_seconds_per_question: int
    questions: list[PracticeQuestionInput]


# ---------- Helpers ----------

def verify_passcode(passcode: str) -> None:
    if passcode != settings.valid_passcode:
        raise HTTPException(status_code=403, detail="Invalid passcode")


def require_authenticated(
    passcode_header: Optional[str] = Header(default=None, alias="X-TOPIK-Passcode"),
    passcode_cookie: Optional[str] = Cookie(default=None, alias="topik_passcode"),
) -> None:
    """Header is primary (Safari blocks third-party cookies); cookie is secondary convenience."""
    if passcode_matches_transport(passcode_header, settings.valid_passcode):
        return
    if passcode_matches_transport(passcode_cookie, settings.valid_passcode):
        return
    raise HTTPException(status_code=403, detail="Authentication required")


def utc_isoformat(value: datetime) -> str:
    """Render database timestamps as unambiguous UTC values for browser clients."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def cookie_settings_for_request(request: Request) -> dict[str, Any]:
    origin = request.headers.get("origin", "")
    if origin.startswith("https://"):
        return {"samesite": "none", "secure": True}
    return {"samesite": "lax", "secure": False}


def writing_session_start_to_response(
    record: WritingSessionStartRecord,
) -> WritingSessionStartResponse:
    return WritingSessionStartResponse(
        id=record.id,
        test_id=record.test_id,
        started_at=utc_isoformat(record.started_at),
        completed_at=utc_isoformat(record.completed_at) if record.completed_at else None,
        total_time_ms=record.total_time_ms,
    )


def saved_long_answer_count(record: WritingSessionRecord, question_id: str) -> int:
    column = f"q{question_id}_char_count"
    stored_count = getattr(record, column, None)
    if isinstance(stored_count, int) and stored_count >= 0:
        return stored_count

    answers: dict[str, Any] = record.answers_json  # type: ignore[assignment]
    answer = answers.get(question_id, {})
    if not isinstance(answer, dict):
        return 0
    return count_non_whitespace_characters(answer.get("transcription", ""))


def writing_session_to_response(record: WritingSessionRecord) -> WritingSessionResponse:
    return WritingSessionResponse(
        id=record.id,
        test_id=record.test_id,
        started_at=utc_isoformat(record.started_at),
        completed_at=utc_isoformat(record.completed_at),
        total_time_ms=record.total_time_ms,
        q53_char_count=saved_long_answer_count(record, "53"),
        q54_char_count=saved_long_answer_count(record, "54"),
        answers=record.answers_json,  # type: ignore[arg-type]
        grading=record.grading_json,  # type: ignore[arg-type]
    )


def practice_attempt_to_response(record: PracticeAttemptRecord) -> PracticeAttemptResponse:
    snapshot: dict[str, Any] = record.attempt_json  # type: ignore[assignment]
    return PracticeAttemptResponse(
        id=record.id,
        set_id=record.set_id,
        set_title=record.set_title,
        question_type=str(snapshot.get("question_type", "practice")),
        started_at=utc_isoformat(record.started_at),
        completed_at=utc_isoformat(record.completed_at),
        total_time_ms=record.total_time_ms,
        target_seconds_per_question=record.target_seconds_per_question,
        question_count=record.question_count,
        within_target_count=record.within_target_count,
        questions=snapshot.get("questions", []),
    )


def _grader_configured() -> bool:
    return bool(settings.grader_api_key or settings.vertex_project)


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login", status_code=204)
def login(payload: LoginRequest, request: Request, response: Response):
    verify_passcode(payload.passcode)
    response.set_cookie(
        key="topik_passcode",
        value=encode_passcode_for_transport(settings.valid_passcode),
        httponly=True,
        **cookie_settings_for_request(request),
    )


@app.get("/api/auth/session", response_model=AuthSessionResponse)
def auth_session(
    passcode_header: Optional[str] = Header(default=None, alias="X-TOPIK-Passcode"),
    passcode_cookie: Optional[str] = Cookie(default=None, alias="topik_passcode"),
):
    authenticated = (
        passcode_matches_transport(passcode_header, settings.valid_passcode)
        or passcode_matches_transport(passcode_cookie, settings.valid_passcode)
    )
    return AuthSessionResponse(authenticated=authenticated)


@app.post("/api/writing-sessions/transcribe", response_model=TranscribeResponse)
def transcribe(
    payload: TranscribeRequest,
    _: None = Depends(require_authenticated),
):
    """Transcribe handwriting images using Gemini multimodal OCR."""
    if not _grader_configured():
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
            model=settings.writing_grader_model,
        )
    except WritingGraderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Transcription service unavailable") from exc

    return TranscribeResponse(
        results=[TranscribeResult(**r) for r in results]
    )


@app.post(
    "/api/writing-sessions/start",
    response_model=WritingSessionStartResponse,
    status_code=201,
)
def start_writing_session(
    payload: WritingSessionStartRequest,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    """Begin a new full-writing attempt when the student enters Q51."""
    if not get_test(payload.test_id):
        raise HTTPException(status_code=404, detail=f"Unknown test_id: {payload.test_id}")

    completed = db.get(WritingSessionRecord, payload.id)
    if completed:
        raise HTTPException(status_code=409, detail="Writing session already completed")

    existing = db.get(WritingSessionStartRecord, payload.id)
    if existing:
        if existing.test_id != payload.test_id:
            raise HTTPException(status_code=409, detail="Session id belongs to another test")
        response.status_code = 200
        return writing_session_start_to_response(existing)

    record = WritingSessionStartRecord(
        id=payload.id,
        test_id=payload.test_id,
        passcode=settings.valid_passcode,
        started_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return writing_session_start_to_response(record)


@app.post(
    "/api/writing-sessions/{session_id}/finish",
    response_model=WritingSessionStartResponse,
)
def finish_writing_session(
    session_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    """Freeze the Q51–Q54 timing window before transcription and grading."""
    record = db.get(WritingSessionStartRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Writing session start not found")

    if record.completed_at is None:
        completed_at = datetime.utcnow()
        record.completed_at = completed_at
        record.total_time_ms = max(
            0, int((completed_at - record.started_at).total_seconds() * 1000)
        )
        db.commit()
        db.refresh(record)
    return writing_session_start_to_response(record)


@app.post("/api/writing-sessions", response_model=WritingSessionResponse, status_code=201)
def create_writing_session(
    payload: WritingSubmitRequest,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    if not _grader_configured():
        raise HTTPException(status_code=503, detail="Writing grader is not configured")

    test = get_test(payload.test_id)
    if not test:
        raise HTTPException(status_code=404, detail=f"Unknown test_id: {payload.test_id}")

    existing = db.get(WritingSessionRecord, payload.id)
    if existing:
        # A browser retry after receiving no response must not regrade or duplicate an attempt.
        response.status_code = 200
        return writing_session_to_response(existing)

    started = db.get(WritingSessionStartRecord, payload.id)
    if not started or started.test_id != payload.test_id:
        raise HTTPException(status_code=409, detail="Writing session was not started")
    if started.completed_at is None or started.total_time_ms is None:
        raise HTTPException(status_code=409, detail="Finish the writing session before grading")

    # Count text on the server so saved lengths always match the submitted answer.
    answers_json = {
        qid: {
            **answer.model_dump(),
            "char_count": count_non_whitespace_characters(answer.transcription),
        }
        for qid, answer in payload.answers.items()
    }
    q53_char_count = int(answers_json.get("53", {}).get("char_count", 0))
    q54_char_count = int(answers_json.get("54", {}).get("char_count", 0))

    try:
        grading = grade_writing_submission(
            test=test,
            answers=answers_json,
            api_key=settings.grader_api_key,
            project=settings.vertex_project,
            location=settings.vertex_location,
            credentials_json=settings.vertex_credentials_json,
            model=settings.writing_grader_model,
            question_asset_base_url=settings.question_asset_base_url,
        )
    except WritingGraderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Writing grader unavailable") from exc

    record = WritingSessionRecord(
        id=payload.id,
        test_id=payload.test_id,
        passcode=settings.valid_passcode,
        started_at=started.started_at,
        completed_at=started.completed_at,
        total_time_ms=started.total_time_ms,
        answers_json=answers_json,
        q53_char_count=q53_char_count,
        q54_char_count=q54_char_count,
        grading_json=grading,
    )
    db.add(record)
    db.delete(started)
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
        .order_by(WritingSessionRecord.completed_at.desc())
        .all()
    )
    return [writing_session_to_response(record) for record in records]


@app.get("/api/writing-sessions/{session_id}", response_model=WritingSessionResponse)
def get_writing_session(
    session_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    record = db.get(WritingSessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Writing session not found")
    return writing_session_to_response(record)


@app.post(
    "/api/practice-attempts",
    response_model=PracticeAttemptResponse,
    status_code=201,
)
def create_practice_attempt(
    payload: PracticeAttemptSubmitRequest,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    """Save a completed rapid-practice set and its review content."""
    if payload.completed_at < payload.started_at:
        raise HTTPException(status_code=422, detail="completed_at must follow started_at")

    existing = db.get(PracticeAttemptRecord, payload.id)
    if existing:
        # A retry after a network failure must not create duplicate history.
        response.status_code = 200
        return practice_attempt_to_response(existing)

    within_target_count = sum(
        question.elapsed_ms <= payload.target_seconds_per_question * 1000
        for question in payload.questions
    )
    snapshot = {
        "question_type": payload.question_type,
        "questions": [question.model_dump() for question in payload.questions],
    }
    record = PracticeAttemptRecord(
        id=payload.id,
        set_id=payload.set_id,
        set_title=payload.set_title,
        passcode=settings.valid_passcode,
        started_at=payload.started_at,
        completed_at=payload.completed_at,
        total_time_ms=payload.total_time_ms,
        target_seconds_per_question=payload.target_seconds_per_question,
        question_count=len(payload.questions),
        within_target_count=within_target_count,
        attempt_json=snapshot,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return practice_attempt_to_response(record)


@app.get(
    "/api/practice-attempts",
    response_model=list[PracticeAttemptSummary],
)
def list_practice_attempts(
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    records = (
        db.query(PracticeAttemptRecord)
        .order_by(PracticeAttemptRecord.completed_at.desc())
        .all()
    )
    return [
        PracticeAttemptSummary(
            id=record.id,
            set_id=record.set_id,
            set_title=record.set_title,
            completed_at=utc_isoformat(record.completed_at),
            total_time_ms=record.total_time_ms,
            question_count=record.question_count,
            within_target_count=record.within_target_count,
        )
        for record in records
    ]


@app.get(
    "/api/practice-attempts/{attempt_id}", response_model=PracticeAttemptResponse
)
def get_practice_attempt(
    attempt_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    record = db.get(PracticeAttemptRecord, attempt_id)
    if not record:
        raise HTTPException(status_code=404, detail="Practice attempt not found")
    return practice_attempt_to_response(record)


@app.get("/api/progress", response_model=ProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    _: None = Depends(require_authenticated),
):
    records = (
        db.query(WritingSessionRecord)
        .order_by(WritingSessionRecord.completed_at.asc())
        .all()
    )

    if not records:
        return ProgressResponse(total_sessions=0, average_score=0.0, sessions=[])

    summaries: list[WritingSessionSummary] = []
    pct_sum = 0.0
    for r in records:
        grading: dict[str, Any] = r.grading_json  # type: ignore[assignment]
        total_score = float(grading.get("total_score", 0.0))
        max_score = float(max_score_for(r.test_id))
        pct = (total_score / max_score * 100) if max_score > 0 else 0.0
        pct_sum += pct
        summaries.append(
            WritingSessionSummary(
                id=r.id,
                test_id=r.test_id,
                date=utc_isoformat(r.completed_at),
                total_score=total_score,
                max_score=max_score,
            )
        )

    average_score = round(pct_sum / len(records), 1)
    return ProgressResponse(
        total_sessions=len(records),
        average_score=average_score,
        sessions=summaries,
    )
