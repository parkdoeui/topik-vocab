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
