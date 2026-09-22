from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class WritingSessionRecord(Base):
    """Stores one writing attempt from start through grading."""

    __tablename__ = "writing_sessions"

    id = Column(String, primary_key=True)
    test_id = Column(String, nullable=False, index=True)
    passcode = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    total_time_ms = Column(BigInteger, nullable=True)
    # {test: <immutable test snapshot>, answers: {question_id: {...}}}
    answers_json = Column(JSON, nullable=False)
    # Server-calculated, non-whitespace counts saved for the long answers.
    q53_char_count = Column(Integer, nullable=True)
    q54_char_count = Column(Integer, nullable=True)
    # {total_score, questions: {qid: {...}}, action_points: [...]}
    grading_json = Column(JSON, nullable=True)


class WritingSessionImageRecord(Base):
    """Stores an uploaded answer image referenced by a writing-session answer."""

    __tablename__ = "writing_session_images"

    id = Column(String, primary_key=True)
    session_id = Column(
        String,
        ForeignKey("writing_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id = Column(String, nullable=False, index=True)
    mime_type = Column(String, nullable=False)
    image_bytes = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, nullable=False)


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


class LanguageErrorPatternRecord(Base):
    """A reusable Korean particle/collocation pattern for writing review."""

    __tablename__ = "language_error_patterns"

    id = Column(String, primary_key=True)
    pattern = Column(String, nullable=False, unique=True)
    category = Column(String, nullable=False, index=True)
    explanation = Column(String, nullable=False)
    difficulty = Column(Integer, nullable=False)
    frequency = Column(Integer, nullable=False, default=0)
    source = Column(String, nullable=False)
    examples_json = Column(JSON, nullable=False)


class LanguageErrorExampleRecord(Base):
    """A reviewed minimal correction extracted from one long-writing answer."""

    __tablename__ = "language_error_examples"

    id = Column(String, primary_key=True)
    pattern_id = Column(
        String, ForeignKey("language_error_patterns.id"), nullable=False, index=True
    )
    source_answer_id = Column(String, nullable=False, index=True)
    example_json = Column(JSON, nullable=False)


class ReviewSetRecord(Base):
    """One fixed twenty-question starting set."""

    __tablename__ = "review_sets"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    set_position = Column(Integer, nullable=False, unique=True)
    question_count = Column(Integer, nullable=False)


class ReviewQuestionRecord(Base):
    """One authored question; its JSON retains wording and accepted-answer data."""

    __tablename__ = "review_questions"

    id = Column(String, primary_key=True)
    set_id = Column(String, ForeignKey("review_sets.id"), nullable=False, index=True)
    set_position = Column(Integer, nullable=False)
    pattern_id = Column(
        String, ForeignKey("language_error_patterns.id"), nullable=False, index=True
    )
    question_type = Column(String, nullable=False, index=True)
    question_json = Column(JSON, nullable=False)


class UserReviewProgressRecord(Base):
    """Single-learner progress; access passcodes are deliberately not identities."""

    __tablename__ = "user_review_progress"

    pattern_id = Column(
        String, ForeignKey("language_error_patterns.id"), primary_key=True
    )
    correct_count = Column(Integer, nullable=False, default=0)
    incorrect_count = Column(Integer, nullable=False, default=0)
    streak = Column(Integer, nullable=False, default=0)
    mastery_level = Column(Integer, nullable=False, default=0)
    last_reviewed_at = Column(DateTime, nullable=True)
    next_review_at = Column(DateTime, nullable=True, index=True)
    last_answer_correct = Column(Boolean, nullable=True)


class ReviewSessionRecord(Base):
    """Durable session header for one selected twenty-question review set."""

    __tablename__ = "review_sessions"

    id = Column(String, primary_key=True)
    set_id = Column(String, ForeignKey("review_sets.id"), nullable=False, index=True)
    status = Column(String, nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True, index=True)
    initial_question_count = Column(Integer, nullable=False)
    attempted_count = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    base_correct_count = Column(Integer, nullable=False, default=0)
    # {initial_question_ids: [...], supplemental_question_ids: [...]}.
    session_json = Column(JSON, nullable=False)


class ReviewAnswerRecord(Base):
    """One idempotent answer submission, including an immutable feedback snapshot."""

    __tablename__ = "review_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "sequence_index", name="uq_review_answer_sequence"),
    )

    id = Column(String, primary_key=True)
    session_id = Column(
        String, ForeignKey("review_sessions.id"), nullable=False, index=True
    )
    question_id = Column(
        String, ForeignKey("review_questions.id"), nullable=False, index=True
    )
    pattern_id = Column(
        String, ForeignKey("language_error_patterns.id"), nullable=False, index=True
    )
    sequence_index = Column(Integer, nullable=False)
    submitted_answer = Column(String, nullable=False)
    correct = Column(Boolean, nullable=False, index=True)
    is_supplemental = Column(Boolean, nullable=False, default=False)
    answered_at = Column(DateTime, nullable=False)
    # {question, answer, explanation, targetPattern, category, difficulty} at review time.
    answer_json = Column(JSON, nullable=False)
