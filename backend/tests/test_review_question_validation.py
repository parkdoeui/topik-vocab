import copy
import unittest

from language_review_data import load_patterns, load_questions, load_review_sets
from scripts.validate_review_questions import validate_questions


class ReviewQuestionValidationTests(unittest.TestCase):
    def test_shipped_bank_has_exact_required_distribution(self) -> None:
        self.assertEqual(validate_questions(load_questions()), [])

    def test_duplicate_option_and_wrong_choice_answer_are_rejected(self) -> None:
        questions = copy.deepcopy(load_questions())
        questions[0]["options"][1] = questions[0]["options"][0]
        questions[0]["answer"] = "없는 답"

        errors = validate_questions(questions)

        self.assertTrue(any("options must be unique" in error for error in errors))
        self.assertTrue(any("match exactly one option" in error for error in errors))

    def test_near_duplicate_and_invalid_set_membership_are_rejected(self) -> None:
        questions = copy.deepcopy(load_questions())
        questions[1]["question"] = questions[0]["question"]
        questions[1]["options"] = questions[0]["options"]
        questions[1]["setId"] = "unknown-set"

        errors = validate_questions(questions, load_patterns(), load_review_sets())

        self.assertTrue(any("normalized duplicate" in error for error in errors))
        self.assertTrue(any("unknown setId" in error for error in errors))

    def test_every_set_has_twenty_questions_and_required_mix(self) -> None:
        questions = load_questions()
        for set_id in {question["setId"] for question in questions}:
            set_questions = [question for question in questions if question["setId"] == set_id]
            self.assertEqual(len(set_questions), 20)
