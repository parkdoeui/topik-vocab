import os
import base64
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
from sqlalchemy import inspect, text

from database import SessionLocal, engine
from config import settings
from main import app
from migrations import migrate_database
from models import Base, WritingSessionImageRecord, WritingSessionRecord


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
        return {"X-TOPIK-Passcode": settings.valid_passcode}

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

    def test_mixed_q53_q54_question_numbers_are_saved(self) -> None:
        payload = self.payload("mixed-attempt")
        payload["set_id"] = "q53-q54-mixed-01"
        payload["question_type"] = "q53-q54-mixed"
        for index, question in enumerate(payload["questions"]):
            question["question_number"] = 53 if index % 2 == 0 else 54

        created = self.client.post(
            "/api/practice-attempts", json=payload, headers=self.headers()
        )
        self.assertEqual(created.status_code, 201)
        reopened = self.client.get(
            "/api/practice-attempts/mixed-attempt", headers=self.headers()
        )
        self.assertEqual(reopened.status_code, 200)
        numbers = [item["question_number"] for item in reopened.json()["questions"]]
        self.assertEqual(numbers, [53, 54] * 5)

    def test_existing_writing_database_is_migrated_into_one_lifecycle_table(self) -> None:
        Base.metadata.drop_all(bind=engine)
        with engine.begin() as connection:
            connection.execute(
                text(
                    """CREATE TABLE writing_sessions (
                        id VARCHAR PRIMARY KEY,
                        test_id VARCHAR NOT NULL,
                        passcode VARCHAR NOT NULL,
                        started_at DATETIME NOT NULL,
                        completed_at DATETIME NOT NULL,
                        total_time_ms INTEGER NOT NULL,
                        answers_json JSON NOT NULL,
                        grading_json JSON NOT NULL
                    )"""
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX ix_writing_sessions_test_id "
                    "ON writing_sessions (test_id)"
                )
            )
            connection.execute(
                text(
                    """INSERT INTO writing_sessions VALUES (
                        :id, :test_id, :passcode, :started_at, :completed_at,
                        :total_time_ms, :answers_json, :grading_json
                    )"""
                ),
                {
                    "id": "legacy-completed",
                    "test_id": "topik-102",
                    "passcode": "pass",
                    "started_at": "2026-09-16 10:00:00",
                    "completed_at": "2026-09-16 10:50:00",
                    "total_time_ms": 3_000_000,
                    "answers_json": '{"53":{"image_urls":[],"transcription":"답안","char_count":2}}',
                    "grading_json": '{"total_score":20,"questions":{},"action_points":[]}',
                },
            )
            connection.execute(
                text(
                    """CREATE TABLE writing_session_starts (
                        id VARCHAR PRIMARY KEY,
                        test_id VARCHAR NOT NULL,
                        passcode VARCHAR NOT NULL,
                        started_at DATETIME NOT NULL,
                        completed_at DATETIME,
                        total_time_ms INTEGER
                    )"""
                )
            )
            connection.execute(
                text(
                    """INSERT INTO writing_session_starts VALUES (
                        'legacy-started', 'topik-102', 'pass',
                        '2026-09-17 10:00:00', NULL, NULL
                    )"""
                )
            )

        migrate_database(engine, "https://example.test/app/")
        migrate_database(engine, "https://example.test/app/")

        inspector = inspect(engine)
        columns = {column["name"]: column for column in inspector.get_columns("writing_sessions")}
        self.assertTrue({"status", "q53_char_count", "q54_char_count"}.issubset(columns))
        self.assertTrue(columns["completed_at"]["nullable"])
        self.assertNotIn("writing_session_starts", inspector.get_table_names())

        db = SessionLocal()
        try:
            completed = db.get(WritingSessionRecord, "legacy-completed")
            started = db.get(WritingSessionRecord, "legacy-started")
            assert completed is not None and started is not None
            self.assertEqual(completed.status, "completed")
            self.assertEqual(started.status, "started")
            self.assertEqual(completed.answers_json["test"]["id"], "topik-102")
            self.assertEqual(
                completed.answers_json["answers"]["53"]["question_image_urls"],
                ["https://example.test/app/tests/topik-102-q53.png"],
            )
        finally:
            db.close()

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
                record = db.get(WritingSessionRecord, session_id)
                assert record is not None
                self.assertEqual(record.status, "started")
                self.assertEqual(record.answers_json["test"]["id"], "topik-102")
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
                                "transcription": "가 나\n다",
                                # The server must never persist a client-supplied count.
                                "char_count": 999,
                            },
                            "54": {
                                "image_urls": [],
                                "transcription": "라 마 바",
                                "char_count": 0,
                            },
                        },
                    },
                    headers=self.headers(),
                )
                self.assertEqual(submitted.status_code, 201)
                self.assertGreaterEqual(submitted.json()["total_time_ms"], 120_000)
                self.assertEqual(submitted.json()["q53_char_count"], 3)
                self.assertEqual(submitted.json()["q54_char_count"], 3)
                self.assertEqual(submitted.json()["answers"]["53"]["char_count"], 3)
                self.assertEqual(submitted.json()["answers"]["54"]["char_count"], 3)
                self.assertEqual(submitted.json()["status"], "completed")
                self.assertEqual(submitted.json()["test"]["id"], "topik-102")
                self.assertEqual(
                    submitted.json()["answers"]["53"]["image_urls"],
                    ["https://parkdoeui.github.io/topik-vocab/tests/topik-102-q53.png"],
                )

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

    def test_uploaded_answer_images_are_persisted_and_referenced(self) -> None:
        session_id = "writing-with-image"
        started = self.client.post(
            "/api/writing-sessions/start",
            json={"id": session_id, "test_id": "topik-102"},
            headers=self.headers(),
        )
        self.assertEqual(started.status_code, 201)
        self.client.post(
            f"/api/writing-sessions/{session_id}/finish", headers=self.headers()
        )

        image_bytes = b"\x89PNG\r\n\x1a\nnot-a-real-png-but-durable"
        with patch("main._grader_configured", return_value=True), patch(
            "main.transcribe_handwriting",
            return_value=[{"transcription": "손글씨", "char_count": 3}],
        ):
            transcribed = self.client.post(
                "/api/writing-sessions/transcribe",
                json={
                    "session_id": session_id,
                    "images": [
                        {
                            "id": "image-1",
                            "question_id": "53",
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                            "mime_type": "image/png",
                        }
                    ],
                },
                headers=self.headers(),
            )
        self.assertEqual(transcribed.status_code, 200)
        image_url = transcribed.json()["results"][0]["image_url"]

        downloaded = self.client.get(image_url, headers=self.headers())
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded.content, image_bytes)
        self.assertEqual(downloaded.headers["content-type"], "image/png")
        self.assertEqual(downloaded.headers["x-content-type-options"], "nosniff")

        answers = {
            str(question): {
                "image_urls": [],
                "answer_image_urls": [image_url] if question == 53 else [],
                "transcription": "답안",
                "char_count": 2,
            }
            for question in (51, 52, 53, 54)
        }
        grading = {"total_score": 50, "questions": {}, "action_points": []}
        with patch("main._grader_configured", return_value=True), patch(
            "main.grade_writing_submission", return_value=grading
        ):
            submitted = self.client.post(
                "/api/writing-sessions",
                json={"id": session_id, "test_id": "topik-102", "answers": answers},
                headers=self.headers(),
            )
        self.assertEqual(submitted.status_code, 201)
        saved = submitted.json()["answers"]["53"]
        self.assertEqual(saved["answer_image_urls"], [image_url])
        self.assertEqual(saved["image_urls"][-1], image_url)

        db = SessionLocal()
        try:
            image = db.get(WritingSessionImageRecord, "image-1")
            assert image is not None
            self.assertEqual(image.image_bytes, image_bytes)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
