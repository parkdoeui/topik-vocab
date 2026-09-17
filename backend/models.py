from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class WritingSessionRecord(Base):
    """Stores writing sessions: image URLs, transcription text, and grading JSON."""

    __tablename__ = "writing_sessions"

    id = Column(String, primary_key=True)
    test_id = Column(String, nullable=False, index=True)
    passcode = Column(String, nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=False)
    total_time_ms = Column(Integer, nullable=False)
    # {question_id: {image_urls: [...], transcription: str, char_count: int}}
    answers_json = Column(JSON, nullable=False)
    # {total_score, questions: {qid: {...}}, action_points: [...]}
    grading_json = Column(JSON, nullable=False)


class WritingSessionStartRecord(Base):
    """Tracks the server-owned timing window for one full Q51–Q54 attempt."""

    __tablename__ = "writing_session_starts"

    id = Column(String, primary_key=True)
    test_id = Column(String, nullable=False, index=True)
    passcode = Column(String, nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    total_time_ms = Column(Integer, nullable=True)


class PracticeAttemptRecord(Base):
    """Stores an immutable, self-review snapshot for one rapid-practice run."""

    __tablename__ = "practice_attempts"

    id = Column(String, primary_key=True)
    set_id = Column(String, nullable=False, index=True)
    set_title = Column(String, nullable=False)
    passcode = Column(String, nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=False, index=True)
    total_time_ms = Column(Integer, nullable=False)
    target_seconds_per_question = Column(Integer, nullable=False)
    question_count = Column(Integer, nullable=False)
    within_target_count = Column(Integer, nullable=False)
    # {question_type, questions: [{id, prompt, elapsed_ms, blanks: [...]}]}
    attempt_json = Column(JSON, nullable=False)
