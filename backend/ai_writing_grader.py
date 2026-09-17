"""
TOPIK writing grader and handwriting transcriber.

Two public functions:
  - transcribe_handwriting(images, mime_types) -> list[dict]
  - grade_writing_submission(test, answers, model) -> dict
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import pathlib
import re
from functools import lru_cache
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urljoin, urlsplit

from pydantic import BaseModel, Field


class WritingGraderError(Exception):
    pass


_MAX_QUESTION_IMAGE_BYTES = 10 * 1024 * 1024
_QUESTION_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _has_valid_image_signature(content: bytes, mime_type: str) -> bool:
    signatures = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    return signatures.get(mime_type, False)


@lru_cache(maxsize=32)
def _load_question_image(
    image_url: str, expected_sha256: str, question_asset_base_url: str
) -> tuple[bytes, str]:
    """Load a canonical question image once and return its bytes and MIME type."""
    import httpx

    image_reference = urlsplit(image_url)
    image_path = PurePosixPath(image_reference.path)
    if (
        image_reference.scheme
        or image_reference.netloc
        or image_reference.query
        or image_reference.fragment
        or image_path.is_absolute()
        or ".." in image_path.parts
    ):
        raise WritingGraderError(f"Question image path is not allowed: {image_url}")

    base_url = urlsplit(question_asset_base_url)
    if base_url.scheme not in {"http", "https"} or not base_url.netloc:
        raise WritingGraderError("Question asset base URL is invalid")

    asset_url = urljoin(
        f"{question_asset_base_url.rstrip('/')}/", image_url.lstrip("/")
    )
    try:
        content = bytearray()
        with httpx.stream(
            "GET", asset_url, follow_redirects=False, timeout=15.0
        ) as response:
            response.raise_for_status()
            mime_type = (
                response.headers.get("content-type", "")
                .split(";", 1)[0]
                .lower()
            )
            if mime_type not in _QUESTION_IMAGE_MIME_TYPES:
                raise WritingGraderError(
                    f"Question image {image_url} has an unsupported content type"
                )
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > _MAX_QUESTION_IMAGE_BYTES:
                    raise WritingGraderError(
                        f"Question image {image_url} exceeds the size limit"
                    )
    except Exception as exc:
        if isinstance(exc, WritingGraderError):
            raise
        raise WritingGraderError(
            f"Failed to load question image {image_url}: {_provider_error_message(exc)}"
        ) from exc

    image_bytes = bytes(content)
    if not image_bytes or not _has_valid_image_signature(image_bytes, mime_type):
        raise WritingGraderError(f"Question image {image_url} is not a valid image")
    actual_sha256 = hashlib.sha256(image_bytes).hexdigest()
    if actual_sha256 != expected_sha256:
        raise WritingGraderError(f"Question image {image_url} failed integrity validation")
    return image_bytes, mime_type


def _build_grading_contents(
    prompt: str,
    test: dict[str, Any],
    types: Any,
    question_asset_base_url: str,
) -> list[Any]:
    """Build a multimodal prompt with every referenced question image attached."""
    contents: list[Any] = [types.Part.from_text(text=prompt)]
    questions = test.get("questions", [])
    if not isinstance(questions, list):
        raise WritingGraderError("Writing test questions must be a list")

    seen_question_numbers: set[str] = set()
    for question in questions:
        if not isinstance(question, dict):
            raise WritingGraderError("Writing test contains an invalid question")
        question_number = str(question.get("number", "")).strip()
        if not question_number or question_number in seen_question_numbers:
            raise WritingGraderError("Writing test question numbers must be unique")
        seen_question_numbers.add(question_number)

        image_url = question.get("image_url")
        if not isinstance(image_url, str) or not image_url.strip():
            continue

        expected_sha256 = question.get("image_sha256")
        if not isinstance(expected_sha256, str) or not re.fullmatch(
            r"[0-9a-f]{64}", expected_sha256
        ):
            raise WritingGraderError(
                f"Question {question_number} image is missing a valid SHA-256 checksum"
            )
        image_bytes, mime_type = _load_question_image(
            image_url, expected_sha256, question_asset_base_url
        )
        contents.extend(
            [
                types.Part.from_text(
                    text=(
                        f"문항 {question_number}의 제시 자료 이미지입니다. "
                        "시험 정보 JSON의 해당 문항과 함께 확인하여 채점하세요."
                    )
                ),
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ]
        )
    return contents


def _provider_error_message(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__
    return message[:500]


def _load_vertex_credentials(credentials_json: str | None) -> Any:
    if not credentials_json:
        return None

    from google.oauth2 import service_account

    try:
        info = json.loads(credentials_json)
    except json.JSONDecodeError as exc:
        raise WritingGraderError("VERTEX_CREDENTIALS_JSON is not valid JSON") from exc

    return service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )


def _build_client(
    api_key: str | None,
    project: str | None,
    location: str,
    credentials_json: str | None,
) -> Any:
    from google import genai
    from google.genai import types

    if project:
        credentials = _load_vertex_credentials(credentials_json)
        return genai.Client(
            vertexai=True,
            project=project,
            location=location,
            credentials=credentials,
            http_options=types.HttpOptions(api_version="v1"),
        )
    if api_key:
        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(api_version="v1alpha"),
        )
    raise WritingGraderError("Writing grader is not configured (no GEMINI_API_KEY or VERTEX_PROJECT)")


def _strip_json_fence(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return raw.strip()


def _extract_text_from_response(response: Any) -> str:
    text = getattr(response, "text", None)
    if text:
        return str(text)

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        prompt_feedback = getattr(response, "prompt_feedback", None)
        if prompt_feedback:
            raise WritingGraderError("Writing grader response was blocked by the AI provider")
        raise WritingGraderError("Writing grader returned no candidates")

    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        chunks: list[str] = []
        for part in parts:
            part_text = getattr(part, "text", None)
            if part_text:
                chunks.append(str(part_text))
        if chunks:
            return "\n".join(chunks)

        finish_reason = getattr(candidate, "finish_reason", None)
        if finish_reason and str(finish_reason) != "STOP":
            raise WritingGraderError(
                f"Writing grader stopped without usable text: {finish_reason}"
            )

    raise WritingGraderError("Writing grader returned no text")


# ---------- Transcription ----------

class OcrTranscriptionPayload(BaseModel):
    transcription: str = ""


class TranscriptionResult(BaseModel):
    transcription: str = ""
    char_count: int = 0


def normalize_ocr_transcription(value: object) -> str:
    """Flatten picture-layout line breaks into readable, continuous text."""
    return " ".join(str(value).split())


def count_non_whitespace_characters(value: object) -> int:
    return sum(not character.isspace() for character in str(value))


def transcribe_handwriting(
    images: list[bytes],
    mime_types: list[str],
    *,
    api_key: str | None = None,
    project: str | None = None,
    location: str = "us-central1",
    credentials_json: str | None = None,
    model: str = "gemini-2.5-pro",
) -> list[dict[str, Any]]:
    """
    Transcribe one or more handwriting images (원고지 grid or plain paper).

    Returns a list of dicts, one per image, each with keys:
      - transcription: str
      - char_count: int
    """
    from google.genai import types

    try:
        client = _build_client(api_key, project, location, credentials_json)
    except Exception as exc:
        raise WritingGraderError(
            f"Failed to initialize transcription client: {_provider_error_message(exc)}"
        ) from exc

    prompt_path = pathlib.Path(__file__).parent / "prompts" / "handwriting_transcriber.txt"
    try:
        prompt_text = prompt_path.read_text(encoding="utf-8")
    except Exception as exc:
        raise WritingGraderError(f"Failed to load transcription prompt: {exc}") from exc

    results: list[dict[str, Any]] = []
    for image_bytes, mime_type in zip(images, mime_types):
        try:
            response = client.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_text(text=prompt_text),
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=OcrTranscriptionPayload,
                    temperature=0,
                ),
            )
        except Exception as exc:
            raise WritingGraderError(
                f"Transcription request failed: {_provider_error_message(exc)}"
            ) from exc

        raw = _strip_json_fence(_extract_text_from_response(response))
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise WritingGraderError("Transcription returned invalid JSON") from exc

        transcription = normalize_ocr_transcription(payload.get("transcription", ""))
        results.append(
            {
                "transcription": transcription,
                # Derive the count from the normalized text rather than trusting OCR.
                "char_count": count_non_whitespace_characters(transcription),
            }
        )

    return results


# ---------- Grading ----------

# Published TOPIK II PBT writing rubric. The language-use score for questions
# 53 and 54 is a raw 0–8/0–13 score multiplied by two.
# Source: https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175504804_07236.pdf
_OFFICIAL_RUBRICS: dict[str, tuple[dict[str, int], dict[str, int]]] = {
    "short-blank": ({"㉠": 5, "㉡": 5}, {"㉠": 1, "㉡": 1}),
    "chart-description": (
        {"내용_및_과제수행": 7, "전개구조": 7, "언어사용": 16},
        {"내용_및_과제수행": 1, "전개구조": 1, "언어사용": 2},
    ),
    "essay": (
        {"내용_및_과제수행": 12, "전개구조": 12, "언어사용": 26},
        {"내용_및_과제수행": 1, "전개구조": 1, "언어사용": 2},
    ),
}


class TopikQuestionGradeSchema(BaseModel):
    score: float = 0.0
    max_score: float = 0.0
    criteria: dict[str, float] = Field(default_factory=dict)
    criteria_max_scores: dict[str, float] = Field(default_factory=dict)
    criterion_evidence: dict[str, str] = Field(default_factory=dict)
    detailed_improvement_points: dict[str, list[str]] = Field(default_factory=dict)
    current_state: str = ""
    primary_goal: str = ""
    sample_answer: str = ""


class WritingGradingResponse(BaseModel):
    total_score: float = 0.0
    questions: dict[str, TopikQuestionGradeSchema] = Field(default_factory=dict)
    action_points: list[str] = Field(default_factory=list)


def _normalize_score(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _rubric_for_question(
    question: dict[str, Any],
) -> tuple[dict[str, int], dict[str, int]]:
    question_type = str(question.get("type", ""))
    rubric = _OFFICIAL_RUBRICS.get(question_type)
    if rubric is None:
        raise WritingGraderError(f"Unsupported TOPIK writing question type: {question_type}")

    max_score = _normalize_score(question.get("max_points", 0.0))
    criterion_caps, score_steps = rubric
    if sum(criterion_caps.values()) != max_score:
        raise WritingGraderError(
            f"Question {question.get('number')} max_points does not match its official rubric"
        )
    return criterion_caps, score_steps


def _quantize_criterion_score(value: Any, cap: int, step: int) -> int:
    score = max(0.0, min(float(cap), _normalize_score(value)))
    # Scores in the official table are whole points; language use is doubled.
    return min(cap, int(math.floor(score / step + 0.5)) * step)


def _normalize_criteria(
    payload: dict[str, Any],
    criterion_caps: dict[str, int],
    score_steps: dict[str, int],
) -> dict[str, int]:
    return {
        key: _quantize_criterion_score(payload.get(key, 0), cap, score_steps[key])
        for key, cap in criterion_caps.items()
    }


def _normalize_criterion_evidence(
    payload: dict[str, Any], keys: list[str]
) -> dict[str, str]:
    return {key: str(payload.get(key, "")).strip() for key in keys}


def _normalize_improvement_points(
    payload: dict[str, Any], keys: list[str]
) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for key in keys:
        values = payload.get(key, [])
        if not isinstance(values, list):
            values = [values]
        result[key] = [str(v).strip() for v in values if str(v).strip()][:3]
    return result


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _normalize_grading_payload(
    test: dict[str, Any], payload: dict[str, Any]
) -> dict[str, Any]:
    """Enforce official caps and recompute all totals instead of trusting the model."""
    questions_raw = _as_dict(payload.get("questions"))
    questions_out: dict[str, dict[str, Any]] = {}

    for question in test.get("questions", []):
        qid = str(question.get("number", ""))
        raw_question = questions_raw.get(qid)
        if not qid or not isinstance(raw_question, dict):
            raise WritingGraderError(f"Writing grader omitted question {qid or '(unknown)'}")

        criterion_caps, score_steps = _rubric_for_question(question)
        criteria_raw = _as_dict(raw_question.get("criteria"))
        missing_criteria = [key for key in criterion_caps if key not in criteria_raw]
        if missing_criteria:
            raise WritingGraderError(
                f"Writing grader omitted criteria for question {qid}: "
                f"{', '.join(missing_criteria)}"
            )

        keys = list(criterion_caps)
        criteria = _normalize_criteria(criteria_raw, criterion_caps, score_steps)
        questions_out[qid] = {
            "score": sum(criteria.values()),
            "max_score": sum(criterion_caps.values()),
            "criteria": criteria,
            "criteria_max_scores": criterion_caps,
            "criterion_evidence": _normalize_criterion_evidence(
                _as_dict(raw_question.get("criterion_evidence")), keys
            ),
            "detailed_improvement_points": _normalize_improvement_points(
                _as_dict(raw_question.get("detailed_improvement_points")), keys
            ),
            "current_state": str(raw_question.get("current_state", "")).strip(),
            "primary_goal": str(raw_question.get("primary_goal", "")).strip(),
            "sample_answer": str(raw_question.get("sample_answer", "")).strip(),
        }

    if not questions_out:
        raise WritingGraderError("Writing test contains no questions")

    action_points_raw = payload.get("action_points", [])
    if not isinstance(action_points_raw, list):
        action_points_raw = []
    action_points = [
        str(point).strip() for point in action_points_raw if str(point).strip()
    ]
    if len(action_points) < 3:
        action_points += [
            "답안을 쓰기 전에 개요를 작성하세요.",
            "다양한 문장 구조와 접속 표현을 사용하세요.",
            "문법과 맞춤법을 검토할 시간을 남겨두세요.",
        ]

    return {
        "total_score": sum(q["score"] for q in questions_out.values()),
        "questions": questions_out,
        "action_points": action_points[:4],
    }


def grade_writing_submission(
    test: dict[str, Any],
    answers: dict[str, Any],
    *,
    api_key: str | None = None,
    project: str | None = None,
    location: str = "us-central1",
    credentials_json: str | None = None,
    model: str = "gemini-2.5-pro",
    question_asset_base_url: str = "https://parkdoeui.github.io/topik-vocab/",
) -> dict[str, Any]:
    """
    Grade a TOPIK II writing submission.

    `answers` maps question id (str) to {image_urls, transcription, char_count}.
    Questions that reference an image are sent with both their full JSON and
    the actual image bytes so content accuracy can be graded visually.
    Returns a dict matching WritingGradingResponse shape.
    """
    from google.genai import types

    try:
        client = _build_client(api_key, project, location, credentials_json)
    except Exception as exc:
        raise WritingGraderError(
            f"Failed to initialize writing grader: {_provider_error_message(exc)}"
        ) from exc

    prompt_path = pathlib.Path(__file__).parent / "prompts" / "writing_grader.txt"
    try:
        prompt_template = prompt_path.read_text(encoding="utf-8")
    except Exception as exc:
        raise WritingGraderError(f"Failed to load writing grader prompt: {exc}") from exc

    prompt = prompt_template.format(
        test_json=json.dumps(test, ensure_ascii=False),
        answers_json=json.dumps(answers, ensure_ascii=False),
    )
    contents = _build_grading_contents(
        prompt, test, types, question_asset_base_url
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                # NB: response_schema is intentionally omitted. WritingGradingResponse
                # has a dict-typed `questions` field, which the SDK renders with
                # `additionalProperties` — rejected by the Gemini Developer API
                # (api-key mode). The prompt already specifies the exact JSON shape
                # and the payload is parsed/normalized manually below.
                response_mime_type="application/json",
                temperature=0,
            ),
        )
    except Exception as exc:
        raise WritingGraderError(
            f"Writing grader request failed: {_provider_error_message(exc)}"
        ) from exc

    raw = _strip_json_fence(_extract_text_from_response(response))
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise WritingGraderError("Writing grader returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise WritingGraderError("Writing grader returned an invalid JSON shape")
    return _normalize_grading_payload(test, payload)
