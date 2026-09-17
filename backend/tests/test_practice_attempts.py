import os
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from pathlib import Path

# Set these before importing the application configuration.
_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_temp_dir.name) / 'practice.db'}"
os.environ["VALID_PASSCODE"] = "practice-test-passcode"

from fastapi.testclient import TestClient

from database import SessionLocal, engine
from main import app
from models import Base, WritingSessionRecord, WritingSessionStartRecord


class PracticeAttemptApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        Base.metadata.drop_all(bind=engine)
        _temp_dir.cleanup()

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    @staticmethod
    def headers() -> dict[str, str]:
        return {"X-TOPIK-Passcode": "practice-test-passcode"}

    @staticmethod
    def payload(attempt_id: str = "attempt-1", completed_at: str = "2026-09-16T10:01:30Z") -> dict:
        questions = []
        for index in range(10):
            questions.append(
                {
                    "id": f"q-{index + 1}",
                    "prompt": f"Question {index + 1}",
                    "elapsed_ms": 45_000 if index < 7 else 75_000,
                    "blanks": [
                        {
                            "marker": "㉠",
                            "submitted_answer": " 내 답 ",
                            "model_answer": "예시 답",
                            "accepted_variants": ["다른 답"],
                            "focus": "문맥",
                            "feedback": "앞뒤 문맥을 확인합니다.",
                        }
                    ],
                }
            )
        return {
            "id": attempt_id,
            "set_id": "q51-set-01",
            "set_title": "Q51 1분 훈련 1세트",
            "question_type": "q51-practical-writing",
            "started_at": "2026-09-16T10:00:00Z",
            "completed_at": completed_at,
            "total_time_ms": 90_000,
            "target_seconds_per_question": 60,
            "questions": questions,
        }

    def test_create_list_and_reopen_attempt(self) -> None:
        payload = self.payload()

        created = self.client.post(
            "/api/practice-attempts", json=payload, headers=self.headers()
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["within_target_count"], 7)
        self.assertEqual(created.json()["questions"][0]["blanks"][0]["submitted_answer"], "내 답")

        duplicate = self.client.post(
            "/api/practice-attempts", json=payload, headers=self.headers()
        )
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.json()["id"], payload["id"])

        later = self.client.post(
            "/api/practice-attempts",
            json=self.payload("attempt-2", "2026-09-16T11:01:30Z"),
            headers=self.headers(),
        )
        self.assertEqual(later.status_code, 201)

        history = self.client.get("/api/practice-attempts", headers=self.headers())
        self.assertEqual(history.status_code, 200)
        self.assertEqual([item["id"] for item in history.json()], ["attempt-2", "attempt-1"])

        reopened = self.client.get("/api/practice-attempts/attempt-1", headers=self.headers())
        self.assertEqual(reopened.status_code, 200)
        self.assertEqual(reopened.json()["questions"][0]["prompt"], "Question 1")
        self.assertEqual(reopened.json()["questions"][0]["blanks"][0]["feedback"], "앞뒤 문맥을 확인합니다.")

    def test_requires_authentication_and_complete_set(self) -> None:
        payload = self.payload()
        unauthenticated = self.client.post("/api/practice-attempts", json=payload)
        self.assertEqual(unauthenticated.status_code, 403)

        payload["questions"] = payload["questions"][:9]
        invalid = self.client.post(
            "/api/practice-attempts", json=payload, headers=self.headers()
        )
        self.assertEqual(invalid.status_code, 422)

    def test_writing_attempts_share_a_test_but_keep_server_timing(self) -> None:
        session_ids = ["writing-attempt-1", "writing-attempt-2"]
        for session_id in session_ids:
            started = self.client.post(
                "/api/writing-sessions/start",
                json={"id": session_id, "test_id": "topik-102"},
                headers=self.headers(),
            )
            self.assertEqual(started.status_code, 201)

        db = SessionLocal()
        try:
            for index, session_id in enumerate(session_ids):
                record = db.get(WritingSessionStartRecord, session_id)
                assert record is not None
                record.started_at = datetime.utcnow() - timedelta(seconds=120 + index)
            db.commit()
        finally:
            db.close()

        grading = {"total_score": 50, "questions": {}, "action_points": []}
        with patch("main._grader_configured", return_value=True), patch(
            "main.grade_writing_submission", return_value=grading
        ):
            for session_id in session_ids:
                finished = self.client.post(
                    f"/api/writing-sessions/{session_id}/finish", headers=self.headers()
                )
                self.assertEqual(finished.status_code, 200)
                self.assertGreaterEqual(finished.json()["total_time_ms"], 120_000)

                submitted = self.client.post(
                    "/api/writing-sessions",
                    json={
                        "id": session_id,
                        "test_id": "topik-102",
                        "answers": {
                            "51": {
                                "image_urls": [],
                                "transcription": "답안",
                                "char_count": 2,
                            },
                            "52": {
                                "image_urls": [],
                                "transcription": "답안",
                                "char_count": 2,
                            },
                            "53": {
                                "image_urls": [],
                                "transcription": "답안",
                                "char_count": 2,
                            },
                            "54": {
                                "image_urls": [],
                                "transcription": "답안",
                                "char_count": 2,
                            },
                        },
                    },
                    headers=self.headers(),
                )
                self.assertEqual(submitted.status_code, 201)
                self.assertGreaterEqual(submitted.json()["total_time_ms"], 120_000)

        db = SessionLocal()
        try:
            legacy_record = db.get(WritingSessionRecord, "writing-attempt-1")
            assert legacy_record is not None
            legacy_record.passcode = "retired-passcode"
            db.commit()
        finally:
            db.close()

        history = self.client.get("/api/writing-sessions", headers=self.headers())
        self.assertEqual(history.status_code, 200)
        self.assertEqual({item["id"] for item in history.json()}, set(session_ids))

        reopened = self.client.get(
            "/api/writing-sessions/writing-attempt-1", headers=self.headers()
        )
        self.assertEqual(reopened.status_code, 200)

        progress = self.client.get("/api/progress", headers=self.headers())
        self.assertEqual(progress.status_code, 200)
        self.assertEqual(progress.json()["total_sessions"], 2)


if __name__ == "__main__":
    unittest.main()
