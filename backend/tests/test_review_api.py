import os
import tempfile
import unittest
from pathlib import Path

_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_temp_dir.name) / 'review.db'}"
os.environ["VALID_PASSCODE"] = "review-test-passcode"

from fastapi.testclient import TestClient

from config import settings
from database import SessionLocal, engine
from main import app
from migrations import migrate_database
from models import (
    Base,
    LanguageErrorPatternRecord,
    ReviewAnswerRecord,
    ReviewQuestionRecord,
    ReviewSessionRecord,
    ReviewSetRecord,
    UserReviewProgressRecord,
)


class ReviewApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        Base.metadata.drop_all(bind=engine)
        _temp_dir.cleanup()

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        migrate_database(engine, "https://example.test/topik-vocab/")

    @staticmethod
    def headers() -> dict[str, str]:
        return {"X-TOPIK-Passcode": settings.valid_passcode}

    def start(self, session_id: str = "review-session-1") -> dict:
        response = self.client.post(
            "/api/review/sessions",
            json={"id": session_id, "set_id": "review-v2-set-1"},
            headers=self.headers(),
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_lists_five_sets_and_starts_a_persisted_twenty_question_session(self) -> None:
        sets = self.client.get("/api/review/sets", headers=self.headers())
        self.assertEqual(sets.status_code, 200)
        self.assertEqual(len(sets.json()), 5)
        self.assertEqual([item["questionCount"] for item in sets.json()], [20] * 5)

        session = self.start()
        self.assertEqual(session["initialQuestionCount"], 20)
        self.assertEqual(len(session["questions"]), 20)
        self.assertTrue(all(len(item["options"]) == 4 for item in session["questions"]))
        self.assertNotIn("answer", session["questions"][0])
        self.assertNotIn("explanation", session["questions"][0])

        db = SessionLocal()
        try:
            saved = db.get(ReviewSessionRecord, "review-session-1")
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved.initial_question_count, 20)
            self.assertEqual(len(saved.session_json["initialQuestionIds"]), 20)
        finally:
            db.close()

    def test_legacy_set_is_hidden_but_completed_result_remains_readable(self) -> None:
        from datetime import datetime

        db = SessionLocal()
        try:
            db.add(ReviewSetRecord(
                id="review-set-1", title="기존 세트", description="보관용",
                set_position=1, question_count=20,
            ))
            db.add(ReviewSessionRecord(
                id="legacy-review-result", set_id="review-set-1", status="completed",
                started_at=datetime(2026, 9, 1), completed_at=datetime(2026, 9, 1),
                initial_question_count=20, attempted_count=0, correct_count=0,
                base_correct_count=0,
                session_json={"initialQuestionIds": [], "supplementalQuestionIds": []},
            ))
            db.commit()
        finally:
            db.close()
        listed = self.client.get("/api/review/sets", headers=self.headers())
        self.assertEqual(len(listed.json()), 5)
        self.assertTrue(all(item["id"].startswith("review-v2-") for item in listed.json()))
        old = self.client.get("/api/review/sessions/legacy-review-result", headers=self.headers())
        self.assertEqual(old.status_code, 200)
        self.assertEqual(old.json()["setTitle"], "기존 세트")
        rejected = self.client.post(
            "/api/review/sessions",
            json={"id": "new-old", "set_id": "review-set-1"},
            headers=self.headers(),
        )
        self.assertEqual(rejected.status_code, 404)

    def test_review_seed_is_idempotent_and_preserves_progress(self) -> None:
        db = SessionLocal()
        try:
            progress = UserReviewProgressRecord(
                pattern_id="pattern-01-n에-직면하다",
                correct_count=4,
                incorrect_count=1,
                streak=2,
                mastery_level=2,
            )
            db.add(progress)
            db.commit()
        finally:
            db.close()

        migrate_database(engine, "https://example.test/topik-vocab/")

        db = SessionLocal()
        try:
            self.assertEqual(db.query(ReviewSetRecord).count(), 5)
            self.assertEqual(db.query(ReviewQuestionRecord).count(), 100)
            self.assertGreaterEqual(db.query(LanguageErrorPatternRecord).count(), 20)
            saved = db.get(UserReviewProgressRecord, "pattern-01-n에-직면하다")
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual((saved.correct_count, saved.incorrect_count, saved.mastery_level), (4, 1, 2))
        finally:
            db.close()

    def test_answer_is_saved_idempotently_and_wrong_pattern_is_rescheduled(self) -> None:
        session = self.start()
        question = next(
            item for item in session["questions"]
            if item["targetPattern"] == "N에 직면하다" and item["type"] == "particle_choice"
        )
        wrong_answer = next(option for option in question["options"] if option != "에")
        payload = {
            "id": "answer-1",
            "question_id": question["id"],
            "sequence_index": 0,
            "submitted_answer": wrong_answer,
            "excluded_question_ids": [question["id"]],
        }
        submitted = self.client.post(
            "/api/review/sessions/review-session-1/answers",
            json=payload,
            headers=self.headers(),
        )
        self.assertEqual(submitted.status_code, 200)
        feedback = submitted.json()
        self.assertFalse(feedback["correct"])
        self.assertEqual(feedback["correctAnswer"], "에")
        self.assertEqual(feedback["targetPattern"], "N에 직면하다")
        self.assertGreaterEqual(feedback["insertAfter"], 3)
        self.assertLessEqual(feedback["insertAfter"], 7)
        self.assertNotEqual(feedback["replacementQuestion"]["id"], question["id"])

        duplicate = self.client.post(
            "/api/review/sessions/review-session-1/answers",
            json=payload,
            headers=self.headers(),
        )
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.json(), feedback)

        db = SessionLocal()
        try:
            self.assertEqual(db.query(ReviewAnswerRecord).count(), 1)
            progress = db.get(UserReviewProgressRecord, "pattern-01-n에-직면하다")
            self.assertIsNotNone(progress)
            assert progress is not None
            self.assertEqual(progress.incorrect_count, 1)
            self.assertEqual(progress.streak, 0)
        finally:
            db.close()

    def test_new_review_set_rejects_non_choice_answer(self) -> None:
        session = self.start("choice-only-session")
        question = session["questions"][0]
        response = self.client.post(
            "/api/review/sessions/choice-only-session/answers",
            json={
                "id": "typed-answer", "question_id": question["id"],
                "sequence_index": 0, "submitted_answer": "임의의 답안",
                "excluded_question_ids": [],
            },
            headers=self.headers(),
        )
        self.assertEqual(response.status_code, 409)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(ReviewAnswerRecord).count(), 0)
        finally:
            db.close()

    def test_completion_derives_persisted_result_and_can_be_reopened(self) -> None:
        session = self.start("review-session-result")
        question = next(
            item for item in session["questions"]
            if item["targetPattern"] == "N에 직면하다" and item["type"] == "particle_choice"
        )
        answer = "에"
        response = self.client.post(
            "/api/review/sessions/review-session-result/answers",
            json={
                "id": "result-answer-1",
                "question_id": question["id"],
                "sequence_index": 0,
                "submitted_answer": answer,
                "excluded_question_ids": [question["id"]],
            },
            headers=self.headers(),
        )
        self.assertEqual(response.status_code, 200)

        completed = self.client.post(
            "/api/review/sessions/review-session-result/complete",
            headers=self.headers(),
        )
        self.assertEqual(completed.status_code, 200)
        result = completed.json()
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["attemptedCount"], 1)
        self.assertIsNotNone(result["completedAt"])
        self.assertEqual(result["answers"], [{
            "question": question["question"],
            "submittedAnswer": "에",
            "correctAnswer": "에",
            "correct": True,
            "explanation": response.json()["explanation"],
            "isSupplemental": False,
        }])

        sets = self.client.get("/api/review/sets", headers=self.headers()).json()
        completed_set = next(item for item in sets if item["id"] == session["setId"])
        self.assertEqual(completed_set["latestSessionId"], "review-session-result")

        reopened = self.client.get(
            "/api/review/sessions/review-session-result", headers=self.headers()
        )
        self.assertEqual(reopened.status_code, 200)
        self.assertEqual(reopened.json()["attemptedCount"], 1)
        self.assertEqual(reopened.json()["answers"], result["answers"])

    def test_result_retains_wrong_answer_and_correct_choice(self) -> None:
        session = self.start("wrong-result")
        question = next(
            item for item in session["questions"]
            if item["targetPattern"] == "N에 직면하다" and item["type"] == "particle_choice"
        )
        wrong = next(option for option in question["options"] if option != "에")
        response = self.client.post(
            "/api/review/sessions/wrong-result/answers",
            json={
                "id": "wrong-answer", "question_id": question["id"],
                "sequence_index": 0, "submitted_answer": wrong,
                "excluded_question_ids": [question["id"]],
            },
            headers=self.headers(),
        )
        self.assertEqual(response.status_code, 200)
        result = self.client.post(
            "/api/review/sessions/wrong-result/complete", headers=self.headers()
        ).json()
        self.assertEqual(result["answers"][0]["submittedAnswer"], wrong)
        self.assertEqual(result["answers"][0]["correctAnswer"], "에")
        self.assertFalse(result["answers"][0]["correct"])

    def test_my_errors_is_frequency_sorted_and_review_routes_require_auth(self) -> None:
        unauthenticated = self.client.get("/api/review/errors")
        self.assertEqual(unauthenticated.status_code, 403)

        errors = self.client.get("/api/review/errors", headers=self.headers())
        self.assertEqual(errors.status_code, 200)
        counts = [item["totalErrorCount"] for item in errors.json()]
        self.assertEqual(counts, sorted(counts, reverse=True))
        self.assertTrue(any(item["naturalExpression"] == "자신감이 생기다" for item in errors.json()))
