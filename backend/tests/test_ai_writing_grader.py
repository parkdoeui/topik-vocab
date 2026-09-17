import json
import unittest
from pathlib import Path
from unittest.mock import patch

from ai_writing_grader import (
    WritingGraderError,
    _build_grading_contents,
    _load_question_image,
    _normalize_grading_payload,
    count_non_whitespace_characters,
    normalize_ocr_transcription,
)


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
    def test_ocr_text_is_flattened_and_counted_after_normalization(self) -> None:
        transcription = normalize_ocr_transcription("첫 줄\n  둘째 줄\r\n셋째 줄")

        self.assertEqual(transcription, "첫 줄 둘째 줄 셋째 줄")
        self.assertEqual(count_non_whitespace_characters(transcription), 8)

    def test_transcriber_prompt_rejects_picture_layout_line_breaks(self) -> None:
        prompt = (
            Path(__file__).parents[1] / "prompts" / "handwriting_transcriber.txt"
        ).read_text(encoding="utf-8")

        self.assertIn("줄 바꿈", prompt)
        self.assertIn("넣지 마세요", prompt)
        self.assertIn('{"transcription"', prompt)
        self.assertNotIn('{{"transcription"', prompt)
        self.assertNotIn("char_count", prompt)

    def test_prompt_template_formats_with_json_payloads(self) -> None:
        template = (
            Path(__file__).parents[1] / "prompts" / "writing_grader.txt"
        ).read_text(encoding="utf-8")

        prompt = template.format(test_json="{}", answers_json="{}")

        self.assertIn('"51"', prompt)
        self.assertIn('"54"', prompt)

    def test_topik_102_graph_is_in_json_and_attached_to_grading_request(self) -> None:
        backend_dir = Path(__file__).parents[1]
        test = json.loads(
            (backend_dir / "data" / "writing_tests" / "topik-102.json").read_text(
                encoding="utf-8"
            )
        )
        template = (backend_dir / "prompts" / "writing_grader.txt").read_text(
            encoding="utf-8"
        )
        prompt = template.format(
            test_json=json.dumps(test, ensure_ascii=False), answers_json="{}"
        )

        class FakePart:
            @staticmethod
            def from_text(*, text: str):
                return ("text", text)

            @staticmethod
            def from_bytes(*, data: bytes, mime_type: str):
                return ("image", data, mime_type)

        class FakeTypes:
            Part = FakePart

        with patch(
            "ai_writing_grader._load_question_image",
            return_value=(b"graph-png", "image/png"),
        ) as load_image:
            contents = _build_grading_contents(
                prompt,
                test,
                FakeTypes,
                "https://example.test/topik-vocab/",
            )

        self.assertIn("한국 캠핑 인구의 변화", contents[0][1])
        self.assertIn("2019년 340만 명", contents[0][1])
        self.assertNotIn("2018년 340만 명", contents[0][1])
        self.assertIn("문항 53", contents[1][1])
        self.assertEqual(contents[2], ("image", b"graph-png", "image/png"))
        load_image.assert_called_once_with(
            "tests/topik-102-q53.png",
            "d95dae0d20281b13215d128410cbd4e78b6f373df3541635ccc9809eaab37ce7",
            "https://example.test/topik-vocab/",
        )

    def test_question_image_loader_rejects_absolute_asset_urls(self) -> None:
        with self.assertRaisesRegex(WritingGraderError, "path is not allowed"):
            _load_question_image(
                "https://example.test/replacement.png",
                "0" * 64,
                "https://assets.example.test/topik/",
            )

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
