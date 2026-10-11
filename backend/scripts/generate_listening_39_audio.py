"""Generate six versioned 39–40 dialogue tracks using the approved listening settings.

Run: python3 backend/scripts/generate_listening_39_audio.py
The original bank remains unchanged. Only passage text is spoken, female then male;
each track repeats that dialogue after a five-second gap, cue, and another gap.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import sys

import google.auth
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from listening_39_data import passage_source_sha256  # noqa: E402
from scripts.generate_listening_audio import digest, encode, passage_ssml, synthesize  # noqa: E402

DATA = ROOT / "backend/data/listening_39_practice"
PUBLIC = ROOT / "frontend/public"


def dialogue_frames(session: AuthorizedSession, config: dict, passage: list[dict]) -> bytes:
    if [utterance["speaker"] for utterance in passage] != ["여자", "남자"]:
        raise ValueError("Expected one female utterance followed by one male utterance")
    rate = config["sample_rate"]
    speaker_gap = bytes(rate * 2 * config["speaker_gap_ms"] // 1000)
    segments = [
        synthesize(
            session,
            {**config, "voice": config["voices"][utterance["speaker"]]},
            passage_ssml(utterance["text"], config["sentence_pause_ms"]),
            ssml=True,
        )
        for utterance in passage
    ]
    return speaker_gap.join(segments)


def assemble_track(dialogue: bytes, cue: bytes, config: dict) -> tuple[bytes, dict]:
    """Concatenate PCM directly so both complete readings and gaps are deterministic."""
    rate = config["sample_rate"]
    gap_seconds = config["repeat_gap_seconds"]
    gap = bytes(rate * 2 * gap_seconds)
    first_end = len(dialogue) / (rate * 2)
    cue_start = first_end + gap_seconds
    cue_end = cue_start + len(cue) / (rate * 2)
    second_start = cue_end + gap_seconds
    frames = dialogue + gap + cue + gap + dialogue
    stages = {
        "first_end": first_end, "cue_start": cue_start,
        "cue_end": cue_end, "second_start": second_start,
    }
    return frames, stages


def main() -> None:
    if not (shutil.which("ffmpeg") or shutil.which("afconvert")):
        raise RuntimeError("Install ffmpeg to encode the generated tracks")
    config = json.loads((DATA / "audio-config.json").read_text(encoding="utf-8"))
    if config["play_count"] != 2:
        raise ValueError("This practice requires two complete readings")
    bank = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
    manifest_path = DATA / "audio-manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"tracks": {}}
    config_hash = digest(json.dumps(config, sort_keys=True).encode())
    manifest = {"config_sha256": config_hash, "tracks": {}}
    session = None
    cue = None
    for item in bank["sets"]:
        source_hash = passage_source_sha256(item["passage"])
        version = digest((source_hash + config_hash).encode())[:12]
        path = f"audio/listening-39-40/{item['id'].replace('_', '-')}-{version}.m4a"
        destination = PUBLIC / path
        previous = old["tracks"].get(item["id"], {})
        if (old.get("config_sha256") == config_hash
                and previous.get("source_sha256") == source_hash
                and previous.get("path") == path and destination.is_file()
                and previous.get("audio_sha256") == digest(destination.read_bytes())):
            manifest["tracks"][item["id"]] = previous
            print(f"{item['id']}: verified existing dialogue track", flush=True)
            continue
        if session is None:
            env = {**dotenv_values(ROOT / "backend/.env"), **os.environ}
            scopes = ["https://www.googleapis.com/auth/cloud-platform"]
            if env.get("VERTEX_CREDENTIALS_JSON"):
                credentials = service_account.Credentials.from_service_account_info(
                    json.loads(env["VERTEX_CREDENTIALS_JSON"]), scopes=scopes
                )
            else:
                credentials, _ = google.auth.default(scopes=scopes)
            if env.get("VERTEX_PROJECT") and hasattr(credentials, "with_quota_project"):
                credentials = credentials.with_quota_project(env["VERTEX_PROJECT"])
            session = AuthorizedSession(credentials)
            cue = synthesize(session, {**config, "voice": config["repeat_cue_voice"]},
                             config["repeat_cue"])
        dialogue = dialogue_frames(session, config, item["passage"])
        frames, stages = assemble_track(dialogue, cue, config)
        encode(frames, config["sample_rate"], destination)
        manifest["tracks"][item["id"]] = {
            "path": path,
            "source_sha256": source_hash,
            "audio_sha256": digest(destination.read_bytes()),
            "duration_seconds": len(frames) / (config["sample_rate"] * 2),
            "stages": stages,
        }
        # Persist each completed track so an interrupted generation can resume.
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(f"{item['id']}: generated {manifest['tracks'][item['id']]['duration_seconds']:.1f}s",
              flush=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
