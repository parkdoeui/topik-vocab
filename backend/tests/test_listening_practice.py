import hashlib
import json
import os
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_temp_dir.name) / 'listening.db'}"
os.environ["VALID_PASSCODE"] = "listening-test-passcode"

from fastapi.testclient import TestClient
from config import settings
from database import engine
from main import app
from models import Base
from listening_practice import LISTENING_SETS


class ListeningPracticeTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.client = TestClient(app)
        self.headers = {"X-TOPIK-Passcode": settings.valid_passcode}

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=engine)
        _temp_dir.cleanup()

    def payload(self, set_id="set_01", attempt_id="listening-attempt", replay_count=2):
        return {"id": attempt_id, "set_id": set_id, "replay_count": replay_count,
                "answers": [{"question_id": q["id"], "selected_option": q["correct_option"]}
                            for q in LISTENING_SETS[set_id]["questions"]]}

    def test_catalogues_and_details_never_reveal_transcript_or_answers(self):
        for kind, count, numbers in (("43-44", 8, [43, 44]), ("39-40", 6, [39, 40])):
            response = self.client.get(f"/api/listening-sets?practice_type={kind}", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json()), count)
            for summary in response.json():
                self.assertEqual(summary["practice_type"], kind)
                self.assertEqual(summary["question_count"], 2)
                detail = self.client.get(f"/api/listening-sets/{summary['id']}", headers=self.headers).json()
                self.assertNotIn("passage", detail)
                self.assertNotIn("answer_key", detail)
                self.assertEqual([q["number"] for q in detail["questions"]], numbers)
                for question in detail["questions"]:
                    self.assertEqual(len(question["options"]), 4)
                    self.assertNotIn("correct_option", question)
                    self.assertNotIn("explanation", question)

    def test_every_set_is_graded_saved_and_reopened_with_replay_count(self):
        for set_id, item in LISTENING_SETS.items():
            payload = self.payload(set_id, f"attempt-{set_id}", replay_count=3)
            payload["answers"][0]["selected_option"] = payload["answers"][0]["selected_option"] % 4 + 1
            payload["answers"].reverse()
            created = self.client.post("/api/listening-attempts", json=payload, headers=self.headers)
            self.assertEqual(created.status_code, 201, created.text)
            result = created.json()
            self.assertEqual(result["correct_count"], 1)
            self.assertEqual(result["replay_count"], 3)
            self.assertEqual(result["passage"], item["passage"])
            self.assertEqual(result["audio"], item["audio"])
            self.assertTrue(result["completed_at"].endswith("Z"))
            self.assertFalse(result["questions"][0]["correct"])
            self.assertTrue(result["questions"][1]["correct"])
            self.assertEqual([q["explanation"] for q in result["questions"]], [q["explanation"] for q in item["questions"]])
            reopened = self.client.get(f"/api/listening-attempts/{payload['id']}", headers=self.headers)
            self.assertEqual(reopened.json(), result)
        for kind, count in (("43-44", 8), ("39-40", 6)):
            history = self.client.get(f"/api/listening-attempts?practice_type={kind}", headers=self.headers).json()
            self.assertEqual(len(history), count)
            self.assertTrue(all(item["practice_type"] == kind and item["replay_count"] == 3 for item in history))
            self.assertTrue(all("passage" not in item for item in history))

    def test_submit_without_playing_is_allowed_and_snapshot_survives_bank_changes(self):
        payload = self.payload(replay_count=0)
        result = self.client.post("/api/listening-attempts", json=payload, headers=self.headers).json()
        changed = deepcopy(LISTENING_SETS)
        changed["set_01"]["passage"] = "Changed later"
        changed["set_01"]["audio"]["path"] = "new-track.m4a"
        changed["set_01"]["questions"][0]["explanation"] = "Changed later"
        with patch("listening_practice.LISTENING_SETS", changed):
            self.assertEqual(self.client.get(f"/api/listening-attempts/{payload['id']}", headers=self.headers).json(), result)
            self.assertEqual(self.client.post("/api/listening-attempts", json=payload, headers=self.headers).json(), result)

    def test_retries_are_idempotent_and_cannot_change_answers_or_replay_count(self):
        payload = self.payload()
        created = self.client.post("/api/listening-attempts", json=payload, headers=self.headers)
        retry = self.client.post("/api/listening-attempts", json=payload, headers=self.headers)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json(), created.json())
        changed = deepcopy(payload)
        changed["replay_count"] += 1
        self.assertEqual(self.client.post("/api/listening-attempts", json=changed, headers=self.headers).status_code, 409)
        changed = deepcopy(payload)
        changed["answers"][0]["selected_option"] = changed["answers"][0]["selected_option"] % 4 + 1
        self.assertEqual(self.client.post("/api/listening-attempts", json=changed, headers=self.headers).status_code, 409)
        self.assertEqual(len(self.client.get("/api/listening-attempts", headers=self.headers).json()), 1)

    def test_invalid_answers_and_replay_counts_are_rejected(self):
        invalid = []
        for count in (-1, True, "2", 1.5, 1_000_001):
            payload = self.payload()
            payload["replay_count"] = count
            invalid.append(payload)
        for option in (0, 5, True, "2"):
            payload = self.payload()
            payload["answers"][0]["selected_option"] = option
            invalid.append(payload)
        missing = self.payload()
        missing["answers"].pop()
        invalid.append(missing)
        duplicate = self.payload()
        duplicate["answers"][1] = deepcopy(duplicate["answers"][0])
        invalid.append(duplicate)
        foreign = self.payload()
        foreign["answers"][0]["question_id"] = "set_02-43"
        invalid.append(foreign)
        for payload in invalid:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/listening-attempts", json=payload, headers=self.headers).status_code, 422)

    def test_authentication_and_unknown_ids(self):
        for path in ("/api/listening-sets", "/api/listening-sets/set_01", "/api/listening-attempts", "/api/listening-attempts/missing"):
            self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.post("/api/listening-attempts", json=self.payload()).status_code, 403)
        for path in ("/api/listening-sets/missing", "/api/listening-attempts/missing"):
            self.assertEqual(self.client.get(path, headers=self.headers).status_code, 404)
        self.assertEqual(self.client.get("/api/listening-sets?practice_type=unknown", headers=self.headers).status_code, 422)

    def test_generated_audio_integrity_and_five_second_gaps(self):
        root = Path(__file__).resolve().parents[2]
        for directory in ("listening_practice", "listening_39_practice"):
            data = root / "backend/data" / directory
            config = json.loads((data / "audio-config.json").read_text())
            manifest = json.loads((data / "audio-manifest.json").read_text())
            self.assertEqual(config["speaking_rate"], 0.8)
            self.assertEqual(config["sentence_pause_ms"], 600)
            self.assertEqual(config["repeat_cue"], "다시 들으십시오.")
            bank = json.loads((data / "questions.json").read_text())
            self.assertEqual(len(manifest["tracks"]), len(bank["sets"]))
            for item in bank["sets"]:
                track = manifest["tracks"][item["id"]]
                asset = root / "frontend/public" / track["path"]
                self.assertTrue(asset.is_file())
                self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(), track["audio_sha256"])
                stages = track["stages"]
                self.assertAlmostEqual(stages["cue_start"] - stages["first_end"], 5)
                self.assertAlmostEqual(stages["second_start"] - stages["cue_end"], 5)
                self.assertGreater(stages["cue_end"], stages["cue_start"])
                self.assertAlmostEqual(track["duration_seconds"] - stages["second_start"], stages["first_end"])


if __name__ == "__main__":
    unittest.main()
