import unittest
from pathlib import Path

from ai_writing_grader import WritingGraderError, _normalize_grading_payload


TEST = {
    "questions": [
        {"number": 51, "type": "short-blank", "max_points": 10},
        {"number": 52, "type": "short-blank", "max_points": 10},
        {"number": 53, "type": "chart-description", "max_points": 30},
        {"number": 54, "type": "essay", "max_points": 50},
    ]
}


def question(criteria: dict[str, float]) -> dict:
    keys = list(criteria)
    return {
        "score": 999,
        "max_score": 999,
        "criteria": criteria,
        "criterion_evidence": {key: f"evidence {key}" for key in keys},
        "detailed_improvement_points": {key: [f"improve {key}"] for key in keys},
        "current_state": "current",
        "primary_goal": "goal",
        "sample_answer": "sample",
    }


class GradingNormalizationTests(unittest.TestCase):
    def test_prompt_template_formats_with_json_payloads(self) -> None:
        template = (
            Path(__file__).parents[1] / "prompts" / "writing_grader.txt"
        ).read_text(encoding="utf-8")

        prompt = template.format(test_json="{}", answers_json="{}")

        self.assertIn('"51"', prompt)
        self.assertIn('"54"', prompt)

    def test_enforces_official_rubrics_and_recomputes_totals(self) -> None:
        payload = {
            "total_score": 999,
            "questions": {
                "51": question({"㉠": 5, "㉡": 4}),
                "52": question({"㉠": 3, "㉡": 2}),
                "53": question(
                    {"내용_및_과제수행": 6, "전개구조": 5, "언어사용": 99}
                ),
                "54": question(
                    {"내용_및_과제수행": 10, "전개구조": 9, "언어사용": 22}
                ),
            },
            "action_points": ["one", "two", "three"],
        }

        result = _normalize_grading_payload(TEST, payload)

        self.assertEqual(result["questions"]["51"]["score"], 9)
        self.assertEqual(
            result["questions"]["51"]["criteria_max_scores"], {"㉠": 5, "㉡": 5}
        )
        self.assertEqual(result["questions"]["53"]["criteria"]["언어사용"], 16)
        self.assertEqual(result["questions"]["53"]["score"], 27)
        self.assertEqual(result["questions"]["54"]["score"], 41)
        self.assertEqual(result["total_score"], 82)

    def test_language_use_is_quantized_to_doubled_subscore(self) -> None:
        payload = {
            "questions": {
                "51": question({"㉠": 0, "㉡": 0}),
                "52": question({"㉠": 0, "㉡": 0}),
                "53": question(
                    {"내용_및_과제수행": 0, "전개구조": 0, "언어사용": 13}
                ),
                "54": question(
                    {"내용_및_과제수행": 0, "전개구조": 0, "언어사용": 17}
                ),
            }
        }

        result = _normalize_grading_payload(TEST, payload)

        self.assertEqual(result["questions"]["53"]["criteria"]["언어사용"], 14)
        self.assertEqual(result["questions"]["54"]["criteria"]["언어사용"], 18)

    def test_missing_question_fails_instead_of_persisting_partial_grading(self) -> None:
        with self.assertRaisesRegex(WritingGraderError, "omitted question 54"):
            _normalize_grading_payload(
                TEST,
                {
                    "questions": {
                        "51": question({"㉠": 0, "㉡": 0}),
                        "52": question({"㉠": 0, "㉡": 0}),
                        "53": question(
                            {
                                "내용_및_과제수행": 0,
                                "전개구조": 0,
                                "언어사용": 0,
                            }
                        ),
                    }
                },
            )


if __name__ == "__main__":
    unittest.main()
