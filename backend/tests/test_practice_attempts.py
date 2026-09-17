import os
import tempfile
import unittest
from pathlib import Path

# Set these before importing the application configuration.
_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_temp_dir.name) / 'practice.db'}"
os.environ["VALID_PASSCODE"] = "practice-test-passcode"

from fastapi.testclient import TestClient

from database import engine
from main import app
from models import Base


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


if __name__ == "__main__":
    unittest.main()
