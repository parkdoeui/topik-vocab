import os
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_temp_dir.name) / 'reading.db'}"
os.environ["VALID_PASSCODE"] = "reading-test-passcode"

from fastapi.testclient import TestClient

from config import settings
from database import engine
from main import app
from models import Base
from reading_practice import READING_SETS, TOPICS


class ReadingPracticeApiTests(unittest.TestCase):
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
        self.client.cookies.clear()

    @staticmethod
    def headers() -> dict[str, str]:
        return {"X-TOPIK-Passcode": settings.valid_passcode}

    @staticmethod
    def payload(attempt_id="reading-attempt-1", set_id="reading-28-31-01") -> dict:
        practice_set = READING_SETS[set_id]
        return {
            "id": attempt_id,
            "set_id": set_id,
            "answers": [
                {"question_id": question["id"], "selected_option": question["correct_option"]}
                for question in practice_set["questions"]
            ],
        }

    def test_five_sets_cover_all_twenty_questions_once_without_revealing_answers(self) -> None:
        catalogue = self.client.get("/api/reading-sets", headers=self.headers())
        self.assertEqual(catalogue.status_code, 200)
        self.assertEqual(len(catalogue.json()), 5)
        seen_ids = []
        source_numbers = []
        for summary in catalogue.json():
            self.assertEqual(summary["question_count"], 4)
            self.assertEqual(summary["points_per_question"], 2)
            detail = self.client.get(f"/api/reading-sets/{summary['id']}", headers=self.headers())
            self.assertEqual(detail.status_code, 200)
            questions = detail.json()["questions"]
            self.assertEqual([question["topic"] for question in questions], list(TOPICS))
            for question in questions:
                self.assertEqual(len(question["options"]), 4)
                self.assertNotIn("correct_option", question)
                self.assertNotIn("explanation", question)
                seen_ids.append(question["id"])
            source_numbers.extend(question["source_number"] for question in READING_SETS[summary["id"]]["questions"])
        self.assertEqual(len(set(seen_ids)), 20)
        self.assertEqual(sorted(source_numbers), list(range(1, 21)))

    def test_grades_mixed_answers_and_reopens_the_original_explanations(self) -> None:
        payload = self.payload()
        payload["answers"][0]["selected_option"] = 1
        # Client ordering must not change the fixed topic order in the review.
        payload["answers"].reverse()
        created = self.client.post("/api/reading-attempts", json=payload, headers=self.headers())
        self.assertEqual(created.status_code, 201, created.text)
        result = created.json()
        self.assertEqual((result["correct_count"], result["score"], result["max_score"]), (3, 6, 8))
        self.assertFalse(result["questions"][0]["correct"])
        self.assertEqual(result["questions"][0]["selected_option"], 1)
        self.assertEqual(result["questions"][0]["correct_option"], 2)
        self.assertTrue(result["completed_at"].endswith("Z"))
        for saved, original in zip(result["questions"], READING_SETS[payload["set_id"]]["questions"]):
            self.assertEqual(saved["prompt"], original["prompt"])
            self.assertEqual(saved["options"], original["options"])
            self.assertEqual(saved["explanation"], original["explanation"])
            self.assertEqual(saved["vocabulary"], original["vocabulary"])

        changed_sets = deepcopy(READING_SETS)
        changed_sets[payload["set_id"]]["questions"][0]["explanation"] = "Changed later"
        with patch("reading_practice.READING_SETS", changed_sets):
            reopened = self.client.get(f"/api/reading-attempts/{payload['id']}", headers=self.headers())
        self.assertEqual(reopened.json(), result)

    def test_each_set_can_be_completed_and_results_appear_in_history(self) -> None:
        ids = []
        for set_id in READING_SETS:
            payload = self.payload(f"attempt-{set_id}", set_id)
            created = self.client.post("/api/reading-attempts", json=payload, headers=self.headers())
            self.assertEqual(created.status_code, 201, created.text)
            self.assertEqual(created.json()["score"], 8)
            ids.append(payload["id"])
        history = self.client.get("/api/reading-attempts", headers=self.headers())
        self.assertEqual([attempt["id"] for attempt in history.json()], list(reversed(ids)))

    def test_retry_is_idempotent_and_different_answers_cannot_overwrite_a_review(self) -> None:
        payload = self.payload()
        created = self.client.post("/api/reading-attempts", json=payload, headers=self.headers())
        retry = self.client.post("/api/reading-attempts", json=payload, headers=self.headers())
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json(), created.json())
        payload["answers"][0]["selected_option"] = 1
        conflict = self.client.post("/api/reading-attempts", json=payload, headers=self.headers())
        self.assertEqual(conflict.status_code, 409)
        history = self.client.get("/api/reading-attempts", headers=self.headers())
        self.assertEqual(len(history.json()), 1)

    def test_rejects_incomplete_duplicate_foreign_and_invalid_choices(self) -> None:
        invalid_payloads = []
        incomplete = self.payload()
        incomplete["answers"].pop()
        invalid_payloads.append(incomplete)
        duplicate = self.payload()
        duplicate["answers"][1] = deepcopy(duplicate["answers"][0])
        invalid_payloads.append(duplicate)
        foreign = self.payload()
        foreign["answers"][0]["question_id"] = "reading-02"
        invalid_payloads.append(foreign)
        for option in (0, 5, "2", True):
            invalid_choice = self.payload()
            invalid_choice["answers"][0]["selected_option"] = option
            invalid_payloads.append(invalid_choice)
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/api/reading-attempts", json=payload, headers=self.headers())
                self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.client.get("/api/reading-attempts", headers=self.headers()).json(), [])

    def test_reading_routes_require_auth_and_unknown_ids_return_not_found(self) -> None:
        for path in ("/api/reading-sets", "/api/reading-sets/reading-28-31-01", "/api/reading-attempts", "/api/reading-attempts/missing"):
            self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.post("/api/reading-attempts", json=self.payload()).status_code, 403)
        self.assertEqual(self.client.get("/api/reading-sets/missing", headers=self.headers()).status_code, 404)
        self.assertEqual(self.client.get("/api/reading-attempts/missing", headers=self.headers()).status_code, 404)
        payload = self.payload()
        payload["set_id"] = "missing"
        self.assertEqual(self.client.post("/api/reading-attempts", json=payload, headers=self.headers()).status_code, 404)


if __name__ == "__main__":
    unittest.main()
