import unittest
from datetime import datetime, timedelta

from language_review import priority_score, update_progress, wrong_answer_offset
from models import LanguageErrorPatternRecord, UserReviewProgressRecord


class LanguageReviewAlgorithmTests(unittest.TestCase):
    @staticmethod
    def pattern(source: str = "user_error", frequency: int = 2) -> LanguageErrorPatternRecord:
        return LanguageErrorPatternRecord(
            id="pattern-test",
            pattern="N에 직면하다",
            category="verb_collocation",
            explanation="설명",
            difficulty=2,
            frequency=frequency,
            source=source,
            examples_json={},
        )

    @staticmethod
    def progress(mastery: int = 0) -> UserReviewProgressRecord:
        return UserReviewProgressRecord(
            pattern_id="pattern-test",
            correct_count=0,
            incorrect_count=0,
            streak=0,
            mastery_level=mastery,
        )

    def test_wrong_answer_is_due_now_and_offset_is_three_through_seven(self) -> None:
        now = datetime(2026, 9, 22, 10, 0, 0)
        progress = self.progress(mastery=2)

        update_progress(progress, correct=False, question_type="particle_choice", now=now)

        self.assertEqual(progress.incorrect_count, 1)
        self.assertEqual(progress.streak, 0)
        self.assertEqual(progress.mastery_level, 1)
        self.assertEqual(progress.next_review_at, now)
        self.assertGreaterEqual(wrong_answer_offset("pattern-test", 1), 3)
        self.assertLessEqual(wrong_answer_offset("pattern-test", 1), 7)

    def test_mastery_level_is_bounded_and_review_interval_grows(self) -> None:
        now = datetime(2026, 9, 22, 10, 0, 0)
        progress = self.progress()
        for index in range(20):
            update_progress(
                progress,
                correct=True,
                question_type="collocation_completion",
                now=now + timedelta(days=index),
            )

        self.assertEqual(progress.mastery_level, 4)
        self.assertEqual(progress.next_review_at, now + timedelta(days=19 + 14))

    def test_priority_orders_real_repeated_recent_errors_first(self) -> None:
        now = datetime(2026, 9, 22, 10, 0, 0)
        real = self.pattern("user_error", 3)
        general = self.pattern("general_topik", 0)
        real_progress = self.progress()
        real_progress.last_answer_correct = False
        real_progress.next_review_at = now
        general_progress = self.progress(mastery=1)
        general_progress.next_review_at = now + timedelta(days=7)

        self.assertGreater(
            priority_score(real, real_progress, now),
            priority_score(general, general_progress, now),
        )
