import copy
import hashlib
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

from listening_39_data import DATA, load_listening_39_sets, passage_source_sha256
from scripts.generate_listening_39_audio import assemble_track, dialogue_frames


class Listening39DataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bank = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
        cls.config = json.loads((DATA / "audio-config.json").read_text(encoding="utf-8"))
        cls.manifest = json.loads((DATA / "audio-manifest.json").read_text(encoding="utf-8"))

    def test_supplied_six_set_source_is_preserved(self) -> None:
        # A spelling, ordering, answer, or explanation edit changes this source fingerprint.
        source = json.dumps(self.bank, ensure_ascii=False, sort_keys=True).encode("utf-8")
        self.assertEqual(hashlib.sha256(source).hexdigest(),
                         "369246fb79e49b7ad0b7795a3326d82d8beebe991584b61e401d4083cb892445")
        self.assertEqual(self.bank["metadata"]["set_count"], len(self.bank["sets"]))
        self.assertEqual(self.bank["metadata"]["question_count"], 12)
        for item in self.bank["sets"]:
            self.assertEqual([u["speaker"] for u in item["passage"]], ["여자", "남자"])
            sentences = re.split(r"(?<=[.!?。！？])\s+", item["passage"][0]["text"])
            self.assertEqual(len(sentences), 1)
            self.assertEqual([q["number"] for q in item["questions"]], [39, 40])

    def test_loader_preserves_every_passage_question_and_answer(self) -> None:
        before = copy.deepcopy(self.bank)
        loaded = load_listening_39_sets()
        answer_key = {item["set_id"]: item["answers"] for item in self.bank["answer_key"]}
        self.assertEqual(len(loaded), 6)
        for index, item in enumerate(self.bank["sets"], 1):
            set_id = f"listening-39-40-{index:02d}"
            result = loaded[set_id]
            self.assertEqual(result["id"], set_id)
            self.assertEqual(result["practice_type"], "39-40")
            self.assertEqual(result["topics"], [item["topic"]])
            self.assertEqual(result["question_count"], 2)
            self.assertEqual(result["passage"], "\n\n".join(
                f"{u['speaker']}: {u['text']}" for u in item["passage"]
            ))
            self.assertIn(self.bank["metadata"]["difficulty"], result["notice"])
            self.assertIn(self.bank["metadata"]["context"], result["notice"])
            for question, source, answer in zip(result["questions"], item["questions"],
                                                answer_key[item["id"]]):
                self.assertEqual(question["id"], f"{set_id}-{source['number']}")
                for key in ("number", "type", "prompt"):
                    self.assertEqual(question[key], source[key])
                self.assertEqual(question["options"], list(source["options"].values()))
                self.assertEqual(question["correct_option"], answer["correct_option"])
                self.assertEqual(question["explanation"], answer["explanation"])
        self.assertEqual(self.bank, before)

    def test_all_audio_assets_match_source_and_have_two_five_second_gaps(self) -> None:
        self.assertEqual(set(self.manifest["tracks"]), {item["id"] for item in self.bank["sets"]})
        public = Path(__file__).parents[2] / "frontend/public"
        for item in self.bank["sets"]:
            track = self.manifest["tracks"][item["id"]]
            self.assertEqual(track["source_sha256"], passage_source_sha256(item["passage"]))
            self.assertTrue(track["path"].startswith("audio/listening-39-40/"))
            asset = public / track["path"]
            self.assertGreater(asset.stat().st_size, 100_000)
            self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(), track["audio_sha256"])
            stages = track["stages"]
            self.assertAlmostEqual(stages["cue_start"] - stages["first_end"], 5)
            self.assertAlmostEqual(stages["second_start"] - stages["cue_end"], 5)
            self.assertGreater(stages["cue_end"], stages["cue_start"])
            self.assertAlmostEqual(track["duration_seconds"] - stages["second_start"],
                                   stages["first_end"])

    def test_loader_rejects_stale_passage_or_settings(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory)
            for name in ("questions.json", "audio-config.json", "audio-manifest.json"):
                (data / name).write_bytes((DATA / name).read_bytes())
            edited = copy.deepcopy(self.bank)
            edited["sets"][0]["passage"][0]["text"] += " 새 문장입니다."
            (data / "questions.json").write_text(json.dumps(edited, ensure_ascii=False))
            with self.assertRaisesRegex(RuntimeError, "Regenerate"):
                load_listening_39_sets(data)
            (data / "questions.json").write_bytes((DATA / "questions.json").read_bytes())
            settings = {**self.config, "speaking_rate": 1.0}
            (data / "audio-config.json").write_text(json.dumps(settings))
            with self.assertRaisesRegex(RuntimeError, "settings"):
                load_listening_39_sets(data)

    def test_source_set_ids_remain_stable_when_bank_order_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory)
            for name in ("questions.json", "audio-config.json", "audio-manifest.json"):
                (data / name).write_bytes((DATA / name).read_bytes())
            reordered = copy.deepcopy(self.bank)
            reordered["sets"].reverse()
            (data / "questions.json").write_text(json.dumps(reordered, ensure_ascii=False))
            self.assertEqual(load_listening_39_sets(data), load_listening_39_sets())

    def test_dialogue_speaks_only_female_then_male_passage_text(self) -> None:
        passage = self.bank["sets"][0]["passage"]
        female, male = b"\x01\x00" * 10, b"\x02\x00" * 20
        with patch("scripts.generate_listening_39_audio.synthesize",
                   side_effect=[female, male]) as synthesis:
            frames = dialogue_frames(object(), self.config, passage)
        self.assertEqual(synthesis.call_count, 2)
        for call, utterance, voice in zip(synthesis.call_args_list, passage,
                                         ("ko-KR-Wavenet-A", "ko-KR-Wavenet-C")):
            self.assertEqual(call.args[1]["voice"], voice)
            self.assertEqual(call.args[1]["speaking_rate"], 0.8)
            self.assertTrue(call.kwargs["ssml"])
            for sentence in re.split(r"(?<=[.!?。！？])\s+", utterance["text"]):
                self.assertIn(f"<s>{sentence}</s>", call.args[2])
            self.assertNotIn(f"{utterance['speaker']}:", call.args[2])
        self.assertIn('<break time="600ms"/>', synthesis.call_args_list[1].args[2])
        gap = bytes(self.config["sample_rate"] * 2 * self.config["speaker_gap_ms"] // 1000)
        self.assertEqual(frames, female + gap + male)

    def test_pcm_track_repeats_the_identical_dialogue_with_silence_around_cue(self) -> None:
        dialogue, cue = b"\x01\x00" * 240, b"\x02\x00" * 48
        frames, stages = assemble_track(dialogue, cue, self.config)
        gap = bytes(24000 * 2 * 5)
        self.assertEqual(frames, dialogue + gap + cue + gap + dialogue)
        self.assertEqual(stages["first_end"], len(dialogue) / 48000)
        self.assertAlmostEqual(stages["cue_start"] - stages["first_end"], 5)
        self.assertAlmostEqual(stages["second_start"] - stages["cue_end"], 5)


if __name__ == "__main__":
    unittest.main()
