"""Deterministic scheduling, grading, and persistence helpers for language review."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session
from language_review_data import load_review_sets

from models import (
    LanguageErrorExampleRecord,
    LanguageErrorPatternRecord,
    ReviewAnswerRecord,
    ReviewQuestionRecord,
    ReviewSessionRecord,
    ReviewSetRecord,
    UserReviewProgressRecord,
)

TYPE_CAPABILITY = {
    "particle_choice": 2,
    "natural_sentence": 2,
    "error_correction": 2,
    "collocation_completion": 2,
}
CURRENT_REVIEW_SET_IDS = tuple(item["id"] for item in load_review_sets())
REVIEW_INTERVAL_DAYS = (0, 1, 3, 7, 14)


def normalize_answer(value: object) -> str:
    return " ".join(str(value or "").strip().split()).rstrip(".!?")


def question_payload(record: ReviewQuestionRecord, *, include_answer: bool = False) -> dict[str, Any]:
    data = dict(record.question_json)
    if not include_answer:
        for key in ("answer", "acceptedAnswers", "explanation", "patternId"):
            data.pop(key, None)
    return data


def answer_is_correct(question: dict[str, Any], submitted_answer: str) -> bool:
    accepted = question.get("acceptedAnswers", [question.get("answer", "")])
    normalized = normalize_answer(submitted_answer)
    return normalized in {normalize_answer(item) for item in accepted}


def priority_score(
    pattern: LanguageErrorPatternRecord,
    progress: UserReviewProgressRecord | None,
    now: datetime,
) -> int:
    user_error = 120 if pattern.source in {"user_error", "mixed"} else 0
    repeated = max(pattern.frequency - 1, 0) * 30
    recent_wrong = 60 if progress and progress.last_answer_correct is False else 0
    low_mastery = (4 - (progress.mastery_level if progress else 0)) * 20
    due = 40 if not progress or not progress.next_review_at or progress.next_review_at <= now else 0
    return user_error + repeated + recent_wrong + low_mastery + due


def wrong_answer_offset(pattern_id: str, incorrect_count: int) -> int:
    digest = hashlib.sha256(f"{pattern_id}:{incorrect_count}".encode()).digest()
    return 3 + digest[0] % 5


def update_progress(
    progress: UserReviewProgressRecord, *, correct: bool, question_type: str, now: datetime
) -> UserReviewProgressRecord:
    if correct:
        progress.correct_count += 1
        progress.streak += 1
        capability = TYPE_CAPABILITY[question_type]
        if progress.streak >= 2 and progress.mastery_level < capability:
            progress.mastery_level += 1
        interval = REVIEW_INTERVAL_DAYS[progress.mastery_level]
        progress.next_review_at = now + timedelta(days=interval)
    else:
        progress.incorrect_count += 1
        progress.streak = 0
        progress.mastery_level = max(0, progress.mastery_level - 1)
        progress.next_review_at = now
    progress.last_answer_correct = correct
    progress.last_reviewed_at = now
    return progress


def _progress_for(
    db: Session, pattern_id: str
) -> UserReviewProgressRecord:
    progress = db.get(UserReviewProgressRecord, pattern_id)
    if progress is None:
        progress = UserReviewProgressRecord(
            pattern_id=pattern_id,
            correct_count=0,
            incorrect_count=0,
            streak=0,
            mastery_level=0,
        )
        db.add(progress)
        db.flush()
    return progress


def build_review_session(
    db: Session, session_id: str, set_id: str, now: datetime
) -> dict[str, Any]:
    review_set = db.get(ReviewSetRecord, set_id)
    if review_set is None or set_id not in CURRENT_REVIEW_SET_IDS:
        raise LookupError("Review set not found")
    questions = (
        db.query(ReviewQuestionRecord)
        .filter(ReviewQuestionRecord.set_id == set_id)
        .order_by(ReviewQuestionRecord.set_position)
        .all()
    )
    if len(questions) != review_set.question_count:
        raise RuntimeError("Review set is incomplete")
    patterns = {
        record.id: record
        for record in db.query(LanguageErrorPatternRecord)
        .filter(LanguageErrorPatternRecord.id.in_([question.pattern_id for question in questions]))
        .all()
    }
    progress_by_pattern = {
        record.pattern_id: record
        for record in db.query(UserReviewProgressRecord)
        .filter(UserReviewProgressRecord.pattern_id.in_(patterns))
        .all()
    }
    ordered = sorted(
        questions,
        key=lambda question: (
            -priority_score(patterns[question.pattern_id], progress_by_pattern.get(question.pattern_id), now),
            question.set_position,
        ),
    )
    record = ReviewSessionRecord(
        id=session_id,
        set_id=set_id,
        status="started",
        started_at=now,
        initial_question_count=len(ordered),
        attempted_count=0,
        correct_count=0,
        base_correct_count=0,
        session_json={
            "initialQuestionIds": [question.id for question in ordered],
            "supplementalQuestionIds": [],
        },
    )
    db.add(record)
    db.commit()
    return {
        "id": record.id,
        "setId": set_id,
        "setTitle": review_set.title,
        "initialQuestionCount": record.initial_question_count,
        "questions": [question_payload(question) for question in ordered],
    }


def reopen_review_session(db: Session, session: ReviewSessionRecord) -> dict[str, Any]:
    review_set = db.get(ReviewSetRecord, session.set_id)
    ids = list(session.session_json.get("initialQuestionIds", [])) + list(
        session.session_json.get("supplementalQuestionIds", [])
    )
    records = {
        record.id: record
        for record in db.query(ReviewQuestionRecord)
        .filter(ReviewQuestionRecord.id.in_(ids))
        .all()
    }
    return {
        "id": session.id,
        "setId": session.set_id,
        "setTitle": review_set.title if review_set else session.set_id,
        "initialQuestionCount": session.initial_question_count,
        "questions": [question_payload(records[item_id]) for item_id in ids if item_id in records],
    }


def _feedback(
    question: ReviewQuestionRecord,
    progress: UserReviewProgressRecord,
    correct: bool,
    replacement: ReviewQuestionRecord | None = None,
    insert_after: int | None = None,
) -> dict[str, Any]:
    data = dict(question.question_json)
    feedback: dict[str, Any] = {
        "correct": correct,
        "correctAnswer": data["answer"],
        "explanation": data["explanation"],
        "targetPattern": data["targetPattern"],
        "category": data["category"],
        "progress": {
            "correctCount": progress.correct_count,
            "incorrectCount": progress.incorrect_count,
            "streak": progress.streak,
            "masteryLevel": progress.mastery_level,
            "lastReviewedAt": progress.last_reviewed_at.isoformat() if progress.last_reviewed_at else None,
            "nextReviewAt": progress.next_review_at.isoformat() if progress.next_review_at else None,
        },
    }
    if replacement is not None and insert_after is not None:
        feedback["replacementQuestion"] = question_payload(replacement)
        feedback["insertAfter"] = insert_after
        feedback["replacementIsSupplemental"] = False
    return feedback


def save_answer_and_update_progress(
    db: Session,
    session_id: str,
    answer_id: str,
    question_id: str,
    sequence_index: int,
    submitted_answer: str,
    excluded_question_ids: list[str],
    now: datetime,
) -> dict[str, Any]:
    existing = db.get(ReviewAnswerRecord, answer_id)
    if existing is not None:
        return dict(existing.answer_json["feedback"])
    session = db.get(ReviewSessionRecord, session_id)
    if session is None or session.status != "started":
        raise LookupError("Review session not found or already completed")
    if db.query(ReviewAnswerRecord).filter(
        ReviewAnswerRecord.session_id == session_id,
        ReviewAnswerRecord.sequence_index == sequence_index,
    ).first():
        raise ValueError("A different answer already exists at this sequence position")
    allowed = set(session.session_json.get("initialQuestionIds", [])) | set(
        session.session_json.get("supplementalQuestionIds", []))
    if question_id not in allowed:
        raise ValueError("Question does not belong to this review session")
    question = db.get(ReviewQuestionRecord, question_id)
    if question is None:
        raise LookupError("Review question not found")
    if question.set_id in CURRENT_REVIEW_SET_IDS and submitted_answer not in question.question_json.get("options", []):
        raise ValueError("Submitted answer must be one of the displayed choices")
    progress = _progress_for(db, question.pattern_id)
    correct = answer_is_correct(question.question_json, submitted_answer)
    update_progress(progress, correct=correct, question_type=question.question_type, now=now)
    replacement: ReviewQuestionRecord | None = None
    insert_after: int | None = None
    if not correct:
        seen = set(excluded_question_ids) | {question_id}
        candidate_query = (
            db.query(ReviewQuestionRecord)
            .filter(ReviewQuestionRecord.pattern_id == question.pattern_id)
            .filter(ReviewQuestionRecord.id.not_in(seen))
        )
        if question.set_id in CURRENT_REVIEW_SET_IDS:
            candidate_query = candidate_query.filter(
                ReviewQuestionRecord.set_id.in_(CURRENT_REVIEW_SET_IDS)
            )
        else:
            candidate_query = candidate_query.filter(ReviewQuestionRecord.set_id == question.set_id)
        candidates = candidate_query.order_by(
            ReviewQuestionRecord.set_id, ReviewQuestionRecord.set_position
        ).all()
        if candidates:
            replacement = candidates[0]
            insert_after = wrong_answer_offset(question.pattern_id, progress.incorrect_count)
            existing_supplemental = list(session.session_json.get("supplementalQuestionIds", []))
            initial_ids = set(session.session_json.get("initialQuestionIds", []))
            if replacement.id not in initial_ids and replacement.id not in existing_supplemental:
                session.session_json = {
                    **session.session_json,
                    "supplementalQuestionIds": [*existing_supplemental, replacement.id],
                }
    is_supplemental = question_id not in set(session.session_json.get("initialQuestionIds", []))
    feedback = _feedback(question, progress, correct, replacement, insert_after)
    if replacement is not None:
        feedback["replacementIsSupplemental"] = replacement.id not in set(
            session.session_json.get("initialQuestionIds", [])
        )
    db.add(ReviewAnswerRecord(
        id=answer_id,
        session_id=session_id,
        question_id=question.id,
        pattern_id=question.pattern_id,
        sequence_index=sequence_index,
        submitted_answer=normalize_answer(submitted_answer),
        correct=correct,
        is_supplemental=is_supplemental,
        answered_at=now,
        answer_json={"feedback": feedback, "question": dict(question.question_json)},
    ))
    session.attempted_count += 1
    if correct:
        session.correct_count += 1
        if not is_supplemental:
            session.base_correct_count += 1
    db.commit()
    return feedback


def review_result(db: Session, session: ReviewSessionRecord) -> dict[str, Any]:
    answers = (
        db.query(ReviewAnswerRecord)
        .filter(ReviewAnswerRecord.session_id == session.id)
        .order_by(ReviewAnswerRecord.sequence_index)
        .all()
    )
    missed: dict[str, dict[str, str]] = {}
    for answer in answers:
        if answer.correct:
            continue
        question = answer.answer_json.get("question", {})
        pattern = str(question.get("targetPattern", ""))
        if pattern:
            missed[pattern] = {
                "pattern": pattern,
                "naturalExpression": str(question.get("answer", "")),
            }
    review_set = db.get(ReviewSetRecord, session.set_id)
    return {
        "id": session.id,
        "setId": session.set_id,
        "setTitle": review_set.title if review_set else session.set_id,
        "status": session.status,
        "startedAt": session.started_at.isoformat(),
        "completedAt": session.completed_at.isoformat() if session.completed_at else None,
        "initialQuestionCount": session.initial_question_count,
        "attemptedCount": len(answers),
        "correctCount": sum(1 for answer in answers if answer.correct),
        "baseCorrectCount": sum(1 for answer in answers if answer.correct and not answer.is_supplemental),
        "supplementalAttemptCount": sum(1 for answer in answers if answer.is_supplemental),
        "missedPatterns": list(missed.values()),
    }


def complete_review_session(db: Session, session_id: str, now: datetime) -> dict[str, Any]:
    session = db.get(ReviewSessionRecord, session_id)
    if session is None:
        raise LookupError("Review session not found")
    answers = db.query(ReviewAnswerRecord).filter(ReviewAnswerRecord.session_id == session_id).all()
    session.attempted_count = len(answers)
    session.correct_count = sum(1 for answer in answers if answer.correct)
    session.base_correct_count = sum(1 for answer in answers if answer.correct and not answer.is_supplemental)
    if session.status != "completed":
        session.status = "completed"
        session.completed_at = now
    db.commit()
    return review_result(db, session)


def review_set_summaries(db: Session) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for review_set in db.query(ReviewSetRecord).filter(
        ReviewSetRecord.id.in_(CURRENT_REVIEW_SET_IDS)
    ).order_by(ReviewSetRecord.set_position).all():
        latest = (
            db.query(ReviewSessionRecord)
            .filter(ReviewSessionRecord.set_id == review_set.id)
            .filter(ReviewSessionRecord.status == "completed")
            .order_by(ReviewSessionRecord.completed_at.desc())
            .first()
        )
        results.append({
            "id": review_set.id,
            "title": review_set.title,
            "description": review_set.description,
            "questionCount": review_set.question_count,
            "latestBaseCorrectCount": latest.base_correct_count if latest else None,
            "latestCompletedAt": latest.completed_at.isoformat() if latest and latest.completed_at else None,
        })
    return results


def my_errors(db: Session) -> list[dict[str, Any]]:
    examples_by_pattern: dict[str, list[LanguageErrorExampleRecord]] = {}
    for example in db.query(LanguageErrorExampleRecord).all():
        examples_by_pattern.setdefault(example.pattern_id, []).append(example)
    progress_by_pattern = {
        item.pattern_id: item for item in db.query(UserReviewProgressRecord).all()
    }
    output: list[dict[str, Any]] = []
    for pattern in db.query(LanguageErrorPatternRecord).all():
        examples = examples_by_pattern.get(pattern.id, [])
        progress = progress_by_pattern.get(pattern.id)
        if not examples and not progress:
            continue
        exemplar = examples[0].example_json if examples else {}
        common = pattern.examples_json.get("commonMistakes", [])
        correct = pattern.examples_json.get("correctExamples", [])
        historical_count = len(examples)
        quiz_incorrect = progress.incorrect_count if progress else 0
        output.append({
            "pattern": pattern.pattern,
            "category": pattern.category,
            "incorrectExpression": exemplar.get("incorrectExpression") or (common[0] if common else ""),
            "naturalExpression": exemplar.get("naturalExpression") or (correct[0] if correct else ""),
            "historicalErrorCount": historical_count,
            "quizIncorrectCount": quiz_incorrect,
            "totalErrorCount": historical_count + quiz_incorrect,
            "masteryLevel": progress.mastery_level if progress else 0,
        })
    return sorted(output, key=lambda item: (-item["totalErrorCount"], item["pattern"]))
