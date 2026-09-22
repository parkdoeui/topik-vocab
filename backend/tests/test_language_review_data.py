import json
import unittest
from pathlib import Path

from language_review_data import aggregate_patterns, load_patterns, load_questions, load_review_sets
from scripts.generate_review_questions import build_artifacts


class LanguageReviewDataTests(unittest.TestCase):
    def test_generation_has_core_and_extracted_patterns_with_one_hundred_questions(self) -> None:
        review_sets, patterns, questions = build_artifacts()

        self.assertEqual(len(review_sets), 5)
        self.assertGreaterEqual(len(patterns), 20)
        self.assertEqual(len(questions), 100)

    def test_error_aggregation_counts_duplicate_user_patterns(self) -> None:
        errors = json.loads(
            (Path(__file__).parents[1] / "data" / "language_review" / "language_errors.json").read_text(encoding="utf-8")
        )
        patterns = {
            item["pattern"]: item
            for item in aggregate_patterns(errors)
        }

        self.assertGreaterEqual(patterns["N이/가 생기다"]["frequency"], 3)
        self.assertIn("자신감이 생기다", patterns["N이/가 생기다"]["correctExamples"])

    def test_shipped_data_loads_as_objects(self) -> None:
        self.assertEqual(len(load_review_sets()), 5)
        self.assertGreaterEqual(len(load_patterns()), 20)
        self.assertEqual(len(load_questions()), 100)
