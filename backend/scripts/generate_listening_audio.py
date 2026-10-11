"""Generate the eight versioned listening tracks; no TTS calls at runtime.

Run from any directory with Google ADC or VERTEX_CREDENTIALS_JSON configured:
    python3 backend/scripts/generate_listening_audio.py
Requires google-auth, requests, python-dotenv, and ffmpeg or macOS afconvert.
Existing matching tracks are verified and reused. Old versions remain available
so saved reviews can continue playing their original audio.
"""

from __future__ import annotations

import array
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import wave
from xml.sax.saxutils import escape

import google.auth
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend/data/listening_practice"
PUBLIC = ROOT / "frontend/public"


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def passage_ssml(passage: str, pause_ms: int) -> str:
    sentences = re.split(r"(?<=[.!?。！？])\s+", passage.strip())
    return "<speak>" + f'<break time="{pause_ms}ms"/>'.join(
        f"<s>{escape(sentence)}</s>" for sentence in sentences
    ) + "</speak>"


def synthesize(session: AuthorizedSession, config: dict, text: str, ssml=False) -> bytes:
    response = session.post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        json={
            "input": {"ssml" if ssml else "text": text},
            "voice": {"languageCode": config["language"], "name": config["voice"]},
            "audioConfig": {
                "audioEncoding": "LINEAR16",
                "speakingRate": config["speaking_rate"],
                "pitch": config["pitch"],
                "sampleRateHertz": config["sample_rate"],
            },
        },
        timeout=60,
    )
    if not response.ok:
        # Never log credential-bearing request headers or provider response bodies.
        raise RuntimeError(f"TTS synthesis failed: HTTP {response.status_code}")
    with wave.open(io.BytesIO(base64.b64decode(response.json()["audioContent"]))) as audio:
        assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (
            1, 2, config["sample_rate"]
        )
        samples = array.array("h", audio.readframes(audio.getnframes()))
    # Remove only inaudible boundary noise, keeping internal sentence pauses.
    first = next(i for i, value in enumerate(samples) if abs(value) > 10)
    last = len(samples) - next(i for i, value in enumerate(reversed(samples)) if abs(value) > 10)
    return samples[first:last].tobytes()


def encode(frames: bytes, sample_rate: int, destination: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="topik-listening-") as temp:
        wav = Path(temp) / "track.wav"
        encoded = Path(temp) / "track.m4a"
        with wave.open(str(wav), "wb") as audio:
            audio.setparams((1, 2, sample_rate, 0, "NONE", "not compressed"))
            audio.writeframes(frames)
        if shutil.which("ffmpeg"):
            command = ["ffmpeg", "-v", "error", "-i", str(wav), "-ar", "44100",
                       "-c:a", "aac", "-b:a", "96k", str(encoded)]
        else:
            command = ["afconvert", "-f", "m4af", "-d", "aac@44100", "-b", "96000",
                       "-q", "127", str(wav), str(encoded)]
        subprocess.run(command, check=True, capture_output=True)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(encoded, destination)


def main() -> None:
    if not (shutil.which("ffmpeg") or shutil.which("afconvert")):
        raise RuntimeError("Install ffmpeg to encode the generated tracks.")
    config = json.loads((DATA / "audio-config.json").read_text())
    assert config["play_count"] == 2
    bank = json.loads((DATA / "questions.json").read_text())
    manifest_path = DATA / "audio-manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"tracks": {}}
    config_hash = digest(json.dumps(config, sort_keys=True).encode())
    manifest = {"config_sha256": config_hash, "tracks": {}}
    session = None
    cue = None
    rate = config["sample_rate"]
    gap = bytes(rate * 2 * config["repeat_gap_seconds"])
    for item in bank["sets"]:
        source_hash = digest(item["passage"].encode())
        version = digest((source_hash + config_hash).encode())[:12]
        path = f"audio/listening-43-44/{item['id'].replace('_', '-')}-{version}.m4a"
        destination = PUBLIC / path
        previous = old["tracks"].get(item["id"], {})
        if (old.get("config_sha256") == config_hash
                and previous.get("source_sha256") == source_hash
                and previous.get("path") == path and destination.is_file()
                and previous.get("audio_sha256") == digest(destination.read_bytes())):
            manifest["tracks"][item["id"]] = previous
            print(f"{item['id']}: verified existing track", flush=True)
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
            cue = synthesize(session, config, config["repeat_cue"])
        passage = synthesize(session, config,
                             passage_ssml(item["passage"], config["sentence_pause_ms"]), ssml=True)
        frames = passage + gap + cue + gap + passage
        first_end = len(passage) / (rate * 2)
        cue_start = first_end + config["repeat_gap_seconds"]
        cue_end = cue_start + len(cue) / (rate * 2)
        second_start = cue_end + config["repeat_gap_seconds"]
        assert frames[:len(passage)] == frames[-len(passage):]
        assert frames[len(passage):len(passage) + len(gap)] == gap
        assert frames[-len(passage) - len(gap):-len(passage)] == gap
        encode(frames, rate, destination)
        manifest["tracks"][item["id"]] = {
            "path": path, "source_sha256": source_hash,
            "audio_sha256": digest(destination.read_bytes()),
            "duration_seconds": len(frames) / (rate * 2),
            "stages": {"first_end": first_end, "cue_start": cue_start,
                       "cue_end": cue_end, "second_start": second_start},
        }
        print(f"{item['id']}: generated {len(frames) / (rate * 2):.1f}s", flush=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
