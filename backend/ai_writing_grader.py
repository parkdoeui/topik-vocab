"""
TOPIK writing grader and handwriting transcriber.

Two public functions:
  - transcribe_handwriting(images, mime_types) -> list[dict]
  - grade_writing_submission(test, answers, model) -> dict
"""
from __future__ import annotations

import base64
import json
import pathlib
import re
from typing import Any

from pydantic import BaseModel, Field


class WritingGraderError(Exception):
    pass


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


def _model_candidates(model: str) -> list[str]:
    """WRITING_GRADER_MODEL may be a comma-separated fallback chain, e.g.
    "gemini-3.7-flash,gemini-3.6-flash" — try each in order."""
    candidates = [m.strip() for m in model.split(",") if m.strip()]
    return candidates or ["gemini-3.6-flash"]


def _is_overloaded(exc: Exception) -> bool:
    """True for transient provider overload (503) — worth retrying a fallback model."""
    text = str(exc).lower()
    return "503" in text or "unavailable" in text or "high demand" in text or "overloaded" in text


def _generate_with_fallback(client: Any, models: list[str], *, contents: Any, config: Any) -> Any:
    """Call generate_content, falling back to the next model on an overloaded (503) error.
    Any non-overload error is raised immediately (no point retrying a 404/400/429 elsewhere)."""
    last_exc: Exception | None = None
    for m in models:
        try:
            return client.models.generate_content(model=m, contents=contents, config=config)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if _is_overloaded(exc):
                continue
            raise
    assert last_exc is not None
    raise last_exc


# ---------- Transcription ----------

class TranscriptionResult(BaseModel):
    transcription: str = ""
    char_count: int = 0


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
            response = _generate_with_fallback(
                client,
                _model_candidates(model),
                contents=[
                    types.Part.from_text(text=prompt_text),
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TranscriptionResult,
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

        results.append(
            {
                "transcription": str(payload.get("transcription", "")).strip(),
                "char_count": int(payload.get("char_count", 0)),
            }
        )

    return results


# ---------- Grading ----------

class TopikCriteriaSchema(BaseModel):
    내용_및_과제수행: float = 0.0
    전개구조: float = 0.0
    언어사용: float = 0.0


class TopikCriterionEvidenceSchema(BaseModel):
    내용_및_과제수행: str = ""
    전개구조: str = ""
    언어사용: str = ""


class TopikImprovementPointsSchema(BaseModel):
    내용_및_과제수행: list[str] = Field(default_factory=list)
    전개구조: list[str] = Field(default_factory=list)
    언어사용: list[str] = Field(default_factory=list)


class TopikQuestionGradeSchema(BaseModel):
    score: float = 0.0
    max_score: float = 0.0
    criteria: TopikCriteriaSchema = Field(default_factory=TopikCriteriaSchema)
    criterion_evidence: TopikCriterionEvidenceSchema = Field(
        default_factory=TopikCriterionEvidenceSchema
    )
    detailed_improvement_points: TopikImprovementPointsSchema = Field(
        default_factory=TopikImprovementPointsSchema
    )
    current_state: str = ""
    primary_goal: str = ""
    sample_answer: str = ""


class WritingGradingResponse(BaseModel):
    total_score: float = 0.0
    questions: dict[str, TopikQuestionGradeSchema] = Field(default_factory=dict)
    action_points: list[str] = Field(default_factory=list)


def _normalize_score(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_criteria(payload: dict[str, Any]) -> dict[str, float]:
    keys = ["내용_및_과제수행", "전개구조", "언어사용"]
    return {key: _normalize_score(payload.get(key, 0.0)) for key in keys}


def _normalize_criterion_evidence(payload: dict[str, Any]) -> dict[str, str]:
    keys = ["내용_및_과제수행", "전개구조", "언어사용"]
    return {key: str(payload.get(key, "")).strip() for key in keys}


def _normalize_improvement_points(payload: dict[str, Any]) -> dict[str, list[str]]:
    keys = ["내용_및_과제수행", "전개구조", "언어사용"]
    result: dict[str, list[str]] = {}
    for key in keys:
        values = payload.get(key, [])
        if not isinstance(values, list):
            values = [values]
        result[key] = [str(v).strip() for v in values if str(v).strip()][:3]
    return result


def grade_writing_submission(
    test: dict[str, Any],
    answers: dict[str, Any],
    *,
    api_key: str | None = None,
    project: str | None = None,
    location: str = "us-central1",
    credentials_json: str | None = None,
    model: str = "gemini-2.5-pro",
) -> dict[str, Any]:
    """
    Grade a TOPIK II writing submission.

    `answers` maps question id (str) to {image_urls, transcription, char_count}.
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

    try:
        response = _generate_with_fallback(
            client,
            _model_candidates(model),
            contents=prompt,
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

    # Normalize questions
    questions_raw = payload.get("questions", {})
    questions_out: dict[str, dict[str, Any]] = {}
    for qid, q in questions_raw.items():
        if not isinstance(q, dict):
            continue
        questions_out[qid] = {
            "score": _normalize_score(q.get("score", 0.0)),
            "max_score": _normalize_score(q.get("max_score", 0.0)),
            "criteria": _normalize_criteria(q.get("criteria", {})),
            "criterion_evidence": _normalize_criterion_evidence(
                q.get("criterion_evidence", {})
            ),
            "detailed_improvement_points": _normalize_improvement_points(
                q.get("detailed_improvement_points", {})
            ),
            "current_state": str(q.get("current_state", "")).strip(),
            "primary_goal": str(q.get("primary_goal", "")).strip(),
            "sample_answer": str(q.get("sample_answer", "")).strip(),
        }

    # Without response_schema enforcement, a model could return a shape we can't
    # parse. Fail loudly (→ 502, retryable) rather than persisting empty grading,
    # which would burn the session id (resubmit → 409).
    if not questions_out:
        raise WritingGraderError("Writing grader returned no question grades")

    action_points = list(payload.get("action_points", []))
    if len(action_points) < 3:
        action_points = action_points + [
            "답안을 쓰기 전에 개요를 작성하세요.",
            "다양한 문장 구조와 접속 표현을 사용하세요.",
            "문법과 맞춤법을 검토할 시간을 남겨두세요.",
        ]
    action_points = action_points[:4]

    total_score = _normalize_score(payload.get("total_score", 0.0))

    return {
        "total_score": total_score,
        "questions": questions_out,
        "action_points": action_points,
    }
