import unittest

from language_error_extractor import (
    build_extraction_prompt,
    extract_source_errors,
    has_source_evidence,
)
from models import WritingSessionRecord
from scripts.export_language_review_sources import build_source


class LanguageErrorExtractorTests(unittest.TestCase):
    def source(self, answer: str = "창의력을 통해 자신감을 생길 수 있다.") -> dict:
        return {
            "sourceAnswerId": "session-1:54",
            "examRound": 83,
            "questionNumber": 54,
            "question": "창의력에 대한 생각을 쓰십시오.",
            "answer": answer,
            "modelAnswer": "창의력을 발휘하면 자신감이 생길 수 있다.",
            "languageFeedback": ["자신감을 생긴다는 자신감이 생긴다로 고치세요."],
        }

    @staticmethod
    def valid_error() -> dict:
        return {
            "originalSentence": "창의력을 통해 자신감을 생길 수 있다.",
            "incorrectExpression": "자신감을 생기다",
            "naturalExpression": "자신감이 생기다",
            "pattern": "N이/가 생기다",
            "category": "particle",
            "explanation": "생기다는 자동사이므로 주격 조사 이/가와 결합한다.",
            "severity": "high",
            "lemma": "생기다",
            "particle": "이/가",
            "verb": "생기다",
            "noun": "자신감",
            "confidence": 0.99,
        }

    def test_extracts_minimal_particle_error_with_source_identity(self) -> None:
        errors = extract_source_errors(self.source(), lambda _: {"errors": [self.valid_error()]})

        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["sourceAnswerId"], "session-1:54")
        self.assertEqual(errors[0]["naturalExpression"], "자신감이 생기다")
        self.assertEqual(errors[0]["category"], "particle")

    def test_drops_error_without_sentence_or_expression_evidence(self) -> None:
        invalid = self.valid_error() | {
            "originalSentence": "답안에 없는 문장이다.",
            "incorrectExpression": "관심을 생기다",
        }

        self.assertEqual(extract_source_errors(self.source(), lambda _: [invalid]), [])

    def test_drops_unsupported_category_from_provider(self) -> None:
        invalid = self.valid_error() | {"category": "pronunciation"}

        self.assertEqual(extract_source_errors(self.source(), lambda _: [invalid]), [])

    def test_prompt_includes_only_the_expected_source_payload(self) -> None:
        prompt = build_extraction_prompt(self.source())

        self.assertIn('"sourceAnswerId": "session-1:54"', prompt)
        self.assertIn("particle", prompt)
        self.assertNotIn("vertex_credentials", prompt)

    def test_evidence_allows_inflected_predicate(self) -> None:
        from language_error_extractor import ExtractedLanguageError

        self.assertTrue(
            has_source_evidence(
                ExtractedLanguageError.model_validate(self.valid_error()),
                "창의력을 통해 자신감을 생길 수 있다.",
            )
        )

    def test_export_builds_q53_q54_source_with_question_images(self) -> None:
        record = WritingSessionRecord(
            id="session-1",
            test_id="topik-102",
            passcode="test",
            status="completed",
            started_at=__import__("datetime").datetime.utcnow(),
            answers_json={
                "test": {
                    "round": 102,
                    "questions": [
                        {
                            "number": 53,
                            "prompt": "그래프를 설명하십시오.",
                            "image_urls": ["https://assets.test/q53.png"],
                        }
                    ],
                },
                "answers": {"53": {"transcription": "답안", "question_image_urls": ["https://assets.test/q53.png"]}},
            },
            grading_json={
                "questions": {
                    "53": {
                        "sample_answer": "예시 답안",
                        "detailed_improvement_points": {"언어사용": ["조사를 확인하세요."]},
                    }
                }
            },
        )

        source = build_source(record, "53")

        self.assertIsNotNone(source)
        assert source is not None
        self.assertEqual(source["sourceAnswerId"], "session-1:53")
        self.assertEqual(source["examRound"], 102)
        self.assertEqual(source["questionImageUrls"], ["https://assets.test/q53.png"])
        self.assertEqual(source["languageFeedback"], ["조사를 확인하세요."])
