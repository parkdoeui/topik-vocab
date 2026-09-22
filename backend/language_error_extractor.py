"""Structured extraction helpers for Q53/Q54 language-use review data.

The extractor deliberately separates provider output from validation so curated data can be
reviewed and tested without a live model.  It is only used for TOPIK II long-writing answers.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field, ValidationError

ErrorCategory = Literal[
    "particle",
    "verb_collocation",
    "noun_verb_collocation",
    "intransitive_transitive",
    "awkward_expression",
    "formal_writing",
    "spelling",
    "spacing",
]

ALLOWED_CATEGORIES = {
    "particle",
    "verb_collocation",
    "noun_verb_collocation",
    "intransitive_transitive",
    "awkward_expression",
    "formal_writing",
    "spelling",
    "spacing",
}


class ExtractedLanguageError(BaseModel):
    """One minimal, source-backed language-use correction."""

    originalSentence: str = Field(min_length=1, max_length=1200)
    incorrectExpression: str = Field(min_length=1, max_length=240)
    naturalExpression: str = Field(min_length=1, max_length=240)
    pattern: str = Field(min_length=1, max_length=160)
    category: ErrorCategory
    explanation: str = Field(min_length=1, max_length=1000)
    severity: Literal["low", "medium", "high"]
    lemma: str | None = Field(default=None, max_length=160)
    particle: str | None = Field(default=None, max_length=40)
    verb: str | None = Field(default=None, max_length=120)
    noun: str | None = Field(default=None, max_length=120)
    confidence: float = Field(ge=0, le=1)


GenerateJson = Callable[[str], str | dict[str, Any] | list[dict[str, Any]]]

_PROMPT_PATH = Path(__file__).parent / "prompts" / "language_error_extractor.txt"
_KOREAN_TOKEN_RE = re.compile(r"[가-힣]{2,}")


def normalize_text(value: object) -> str:
    """Make OCR line breaks and repeated spaces comparable without changing wording."""
    return " ".join(str(value or "").replace("\u00a0", " ").split())


def _evidence_tokens(expression: str) -> set[str]:
    """Return sturdy lexical fragments; endings may be inflected in the source sentence."""
    tokens: set[str] = set()
    for token in _KOREAN_TOKEN_RE.findall(normalize_text(expression)):
        tokens.add(token)
        if len(token) > 3 and token.endswith("다"):
            tokens.add(token[:-1])
        if len(token) > 3 and token.endswith(("은", "는", "을", "를", "이", "가", "에", "의")):
            tokens.add(token[:-1])
    return {token for token in tokens if len(token) >= 2}


def has_source_evidence(error: ExtractedLanguageError, source_answer: str) -> bool:
    """Ensure a correction is grounded in this answer, allowing normal Korean inflection."""
    sentence = normalize_text(error.originalSentence)
    answer = normalize_text(source_answer)
    if sentence not in answer:
        return False
    return any(token in sentence for token in _evidence_tokens(error.incorrectExpression))


def build_extraction_prompt(source: dict[str, Any]) -> str:
    """Inject a narrowly scoped writing source into the reviewed extraction instructions."""
    template = _PROMPT_PATH.read_text(encoding="utf-8")
    payload = {
        "sourceAnswerId": source.get("sourceAnswerId"),
        "examRound": source.get("examRound"),
        "questionNumber": source.get("questionNumber"),
        "question": source.get("question"),
        "answer": source.get("answer"),
        "modelAnswer": source.get("modelAnswer"),
        "languageFeedback": source.get("languageFeedback", []),
    }
    return template.replace("{source_json}", json.dumps(payload, ensure_ascii=False))


def _decode_generated_json(value: str | dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        decoded: Any = json.loads(cleaned)
    else:
        decoded = value

    if isinstance(decoded, dict):
        decoded = decoded.get("errors", [])
    if not isinstance(decoded, list):
        raise ValueError("Extractor output must be an array or an object with an errors array")
    return [item for item in decoded if isinstance(item, dict)]


def extract_source_errors(
    source: dict[str, Any], generate_json: GenerateJson
) -> list[dict[str, Any]]:
    """Call an injected JSON generator and return validated, source-addressable errors.

    Invalid, speculative, or unsupported items are intentionally dropped rather than silently
    entering the learner's review bank.
    """
    answer = str(source.get("answer", ""))
    if not answer.strip():
        return []

    raw_items = _decode_generated_json(generate_json(build_extraction_prompt(source)))
    output: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for raw in raw_items:
        try:
            error = ExtractedLanguageError.model_validate(raw)
        except ValidationError:
            continue
        if not has_source_evidence(error, answer):
            continue
        key = (
            normalize_text(error.incorrectExpression),
            normalize_text(error.naturalExpression),
            error.category,
        )
        if key in seen:
            continue
        seen.add(key)
        item = {
            "sourceAnswerId": source["sourceAnswerId"],
            "examRound": source["examRound"],
            "questionNumber": source["questionNumber"],
            **error.model_dump(),
        }
        output.append(item)
    return output
