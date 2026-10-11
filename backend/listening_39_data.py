"""Adapt the original 39–40 dialogue bank for the shared listening practice API."""

import hashlib
import json
from pathlib import Path
from typing import Any

DATA = Path(__file__).parent / "data/listening_39_practice"


def passage_source_sha256(passage: list[dict[str, str]]) -> str:
    """Include speaker order as well as every source character in the audio version."""
    source = json.dumps(passage, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(source).hexdigest()


def load_listening_39_sets(data_dir: Path = DATA) -> dict[str, dict[str, Any]]:
    """Return private grading records; the public API must omit passage and answers.

    Audio paths are relative to frontend/public, and stages are seconds from the
    start of a mono track. Generation and asset tests verify the shipped files.
    """
    bank = json.loads((data_dir / "questions.json").read_text(encoding="utf-8"))
    config = json.loads((data_dir / "audio-config.json").read_text(encoding="utf-8"))
    manifest = json.loads((data_dir / "audio-manifest.json").read_text(encoding="utf-8"))
    config_hash = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    if manifest["config_sha256"] != config_hash:
        raise RuntimeError("Regenerate listening 39–40 audio after changing its settings")
    answers = {
        item["set_id"]: {answer["number"]: answer for answer in item["answers"]}
        for item in bank["answer_key"]
    }
    notice = " ".join(bank["metadata"][key] for key in ("difficulty", "context"))
    result = {}
    for item in bank["sets"]:
        track = manifest["tracks"][item["id"]]
        if track["source_sha256"] != passage_source_sha256(item["passage"]):
            raise RuntimeError(f"Regenerate listening 39–40 audio for {item['id']}")
        sequence = int(item["id"].removeprefix("set_"))
        set_id = f"listening-39-40-{sequence:02d}"
        questions = []
        for question in item["questions"]:
            answer = answers[item["id"]][question["number"]]
            questions.append({
                **question,
                "id": f"{set_id}-{question['number']}",
                "options": [question["options"][str(option)] for option in range(1, 5)],
                "correct_option": answer["correct_option"],
                "explanation": answer["explanation"],
            })
        result[set_id] = {
            "id": set_id,
            "practice_type": "39-40",
            "title": f"듣기 39–40 · {sequence}세트",
            "topics": [item["topic"]],
            "combination": "대화 전의 내용 + 내용 일치",
            "question_count": len(questions),
            "notice": notice,
            "passage": "\n\n".join(
                f"{utterance['speaker']}: {utterance['text']}" for utterance in item["passage"]
            ),
            "audio": {key: track[key] for key in ("path", "duration_seconds", "stages")},
            "questions": questions,
        }
    return result
