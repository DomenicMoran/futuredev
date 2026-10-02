from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
AUDIO_DIR = ROOT / "tools" / "audio"
sys.path.insert(0, str(AUDIO_DIR))
import pipeline_contract as contract  # noqa: E402

spec = importlib.util.spec_from_file_location("render_chatterbox_tested", AUDIO_DIR / "render_chatterbox.py")
render = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(render)


def make_lesson(lesson_id: str, blocks: list[tuple[str, str]]) -> dict:
    return {"id": lesson_id, "speechBlocks": [
        {"speaker": speaker, "text": text, "role": "body", "isKeySentence": index == 0}
        for index, (speaker, text) in enumerate(blocks)
    ]}


class FakeRendererTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="futuredev-audio-test-")
        self.root = Path(self.temp.name)
        self.lessons = self.root / "lessons"
        self.out = self.root / "out"
        self.lessons.mkdir()
        self.out.mkdir()
        render.LESSONS_DIR = self.lessons
        render.OUT_DIR = self.out
        render.PROGRESS_PATH = self.out / "_progress.json"
        render.CONTROL_PATH = self.out / "_control.json"
        render.LOCK_PATH = self.out / "_lock.json"
        self.duration_by_path: dict[Path, float] = {}
        self.duration_by_hash: dict[str, float] = {}
        self.rendered: list[tuple[str, str]] = []
        self._patched: list[patch] = []
        self.patch(render, "find_ffmpeg", lambda: ("fake-ffmpeg", "fake-ffprobe"))
        self.patch(render, "mp3_ok", self.fake_mp3_ok)
        self.patch(render, "duration_seconds", self.fake_duration)
        self.patch(render, "speak_block_retry", self.fake_speak)
        self.patch(render, "concat_lesson", self.fake_concat)

    def tearDown(self) -> None:
        for item in reversed(self._patched):
            item.stop()
        self.temp.cleanup()

    def patch(self, obj, name: str, value) -> None:
        item = patch.object(obj, name, value)
        item.start()
        self._patched.append(item)

    def lesson_path(self, lesson_id: str) -> Path:
        path = self.lessons / f"{lesson_id}.json"
        path.write_text(json.dumps(make_lesson(lesson_id, [("A", "Ein unveränderter Block."), ("B", "Noch ein Wortlaut." )]), ensure_ascii=False), encoding="utf-8")
        return path

    def fake_mp3_ok(self, path: Path, _ffprobe: str) -> bool:
        return path.is_file() and path.stat().st_size >= 800

    def fake_duration(self, path: Path, _ffprobe: str) -> float:
        if path in self.duration_by_path:
            return self.duration_by_path[path]
        return self.duration_by_hash.get(hashlib.sha256(path.read_bytes()).hexdigest(), 0.5)

    def fake_speak(self, _model, text: str, speaker: str, output: Path, _device: str) -> None:
        self.rendered.append((speaker, text))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes((f"FAKE-MP3\n{speaker}\n{text}\n".encode("utf-8") + b"x" * 1024))
        self.duration_by_path[output] = 0.5
        self.duration_by_hash[hashlib.sha256(output.read_bytes()).hexdigest()] = 0.5

    def fake_concat(self, _lesson_id, blocks, paths, output: Path, _ffmpeg, _ffprobe):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"FAKE-MONTAGE\n" + b"".join(path.read_bytes() for path in paths))
        durations = [self.fake_duration(path, "fake") for path in paths]
        silence = sum((0.3 if blocks[i - 1]["speaker"] == blocks[i]["speaker"] else 0.6) for i in range(1, len(blocks)))
        self.duration_by_path[output] = sum(durations) + silence
        self.duration_by_hash[hashlib.sha256(output.read_bytes()).hexdigest()] = self.duration_by_path[output]
        return durations

    def test_exactly_reuses_only_full_verified_speaker_and_text_bindings(self):
        lesson_id = "M01-00-01"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), 2)
        self.assertTrue(render.is_generation_current(lesson_id, json.loads(lesson_path.read_text(encoding="utf-8"))["speechBlocks"], self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration))

        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), 2, "unchanged verified audio should not render again")

        changed = make_lesson(lesson_id, [("A", "Ein unveränderter Block."), ("A", "Noch ein Wortlaut." )])
        lesson_path.write_text(json.dumps(changed, ensure_ascii=False), encoding="utf-8")
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), 3, "speaker change invalidates the matching block only")
        self.assertEqual(self.rendered[-1], ("A", "Noch ein Wortlaut."))

        changed["speechBlocks"][1]["text"] = "Wortlaut mit geändertem Inhalt."
        lesson_path.write_text(json.dumps(changed, ensure_ascii=False), encoding="utf-8")
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), 4, "changed text must be rendered, never rebound to old bytes")

    def test_internally_conflicting_marker_text_hash_and_speech_hash_cannot_be_reused(self):
        lesson_id = "M01-00-10"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        marker_path = self.out / f"{lesson_id}.provenance.json"
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        original_block = (self.out / lesson_id / f"{lesson_id}-b001.mp3").read_bytes()
        marker["blocks"][0]["speechSha256"] = contract.block_speech_sha256("A", "Aktuell geänderter Sprechertext.")
        contract.atomic_write_json(marker_path, marker)
        changed = make_lesson(lesson_id, [("A", "Aktuell geänderter Sprechertext."), ("B", "Noch ein Wortlaut.")])
        lesson_path.write_text(json.dumps(changed, ensure_ascii=False), encoding="utf-8")

        render.render_lesson(None, lesson_id, None, "cpu")

        self.assertEqual(self.rendered[-1], ("A", "Aktuell geänderter Sprechertext."))
        self.assertIn("Aktuell geänderter Sprechertext".encode(), (self.out / lesson_id / f"{lesson_id}-b001.mp3").read_bytes())
        archive = next((self.out / "_archive" / lesson_id).iterdir())
        self.assertEqual((archive / lesson_id / f"{lesson_id}-b001.mp3").read_bytes(), original_block)

    def test_current_generation_rejects_compensating_stored_duration_errors_against_real_blocks(self):
        lesson_id = "M01-00-11"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        marker_path = self.out / f"{lesson_id}.provenance.json"
        cues_path = self.out / f"{lesson_id}.cues.json"
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        cues = json.loads(cues_path.read_text(encoding="utf-8"))
        marker["blocks"][0]["durationSeconds"] = 0.7
        marker["blocks"][1]["durationSeconds"] = 0.3
        cues["blocks"][0]["durationSeconds"] = 0.7
        cues["blocks"][1]["startSeconds"] = 1.3
        cues["blocks"][1]["durationSeconds"] = 0.3
        contract.atomic_write_json(cues_path, cues)
        marker["cuesBytes"] = cues_path.stat().st_size
        marker["cuesSha256"] = contract.sha256_file(cues_path)
        contract.atomic_write_json(marker_path, marker)
        blocks = json.loads(lesson_path.read_text(encoding="utf-8"))["speechBlocks"]
        self.assertFalse(render.is_generation_current(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration))

    def test_resume_rejects_stored_duration_that_differs_from_verified_work_audio(self):
        lesson_id = "M01-00-15"
        self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        work_dir = next((self.out / lesson_id).glob(".work-*"))
        checksum_path = work_dir / f"{lesson_id}.checksums.json"
        document = json.loads(checksum_path.read_text(encoding="utf-8"))
        document["blocks"][0]["durationSeconds"] = 0.9
        contract.atomic_write_json(checksum_path, document)
        blocks = json.loads((self.lessons / f"{lesson_id}.json").read_text(encoding="utf-8"))["speechBlocks"]

        rebuilt, ready = contract.verified_work_rows(lesson_id, blocks, work_dir, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration)

        self.assertNotIn(0, ready)
        self.assertEqual(rebuilt["blocks"][0]["state"], "pending")

    def _seed_current_generation(self, lesson_id: str = "M01-00-18") -> tuple[str, list[dict]]:
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        blocks = json.loads(lesson_path.read_text(encoding="utf-8"))["speechBlocks"]
        self.assertTrue(render.is_generation_current(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration))
        return lesson_id, blocks

    def test_generation_current_rejects_non_finite_and_non_json_cue_numbers(self):
        lesson_id, blocks = self._seed_current_generation()
        cues_path = self.out / f"{lesson_id}.cues.json"
        marker_path = self.out / f"{lesson_id}.provenance.json"
        base_cues = json.loads(cues_path.read_text(encoding="utf-8"))
        base_marker = json.loads(marker_path.read_text(encoding="utf-8"))
        mutations = [
            ("cue-start-nan-string", lambda cues, _marker: cues["blocks"][0].__setitem__("startSeconds", "NaN")),
            ("cue-duration-nan-string", lambda cues, _marker: cues["blocks"][0].__setitem__("durationSeconds", "NaN")),
            ("cue-start-infinity", lambda cues, _marker: cues["blocks"][0].__setitem__("startSeconds", float("inf"))),
            ("cue-duration-zero", lambda cues, _marker: cues["blocks"][0].__setitem__("durationSeconds", 0)),
            ("cue-start-bool", lambda cues, _marker: cues["blocks"][0].__setitem__("startSeconds", True)),
            ("marker-duration-nan-string", lambda _cues, marker: marker.__setitem__("durationSeconds", "NaN")),
            ("marker-duration-nan-float", lambda _cues, marker: marker.__setitem__("durationSeconds", float("nan"))),
        ]
        for label, mutate in mutations:
            with self.subTest(label=label):
                cues = json.loads(json.dumps(base_cues))
                marker = json.loads(json.dumps(base_marker))
                mutate(cues, marker)
                contract.atomic_write_json(cues_path, cues)
                marker["cuesBytes"] = cues_path.stat().st_size
                marker["cuesSha256"] = contract.sha256_file(cues_path)
                contract.atomic_write_json(marker_path, marker)
                self.assertFalse(
                    contract.is_generation_current(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration),
                    label,
                )

    def test_reusable_proven_blocks_rejects_malformed_row_bindings_without_crashing(self):
        lesson_id, blocks = self._seed_current_generation("M01-00-19")
        marker_path = self.out / f"{lesson_id}.provenance.json"
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        for label, corrupt in (
            ("speaker-list", lambda row: row.__setitem__("speaker", [])),
            ("textSha256-list", lambda row: row.__setitem__("textSha256", [])),
            ("duration-nan-string", lambda row: row.__setitem__("durationSeconds", "NaN")),
        ):
            with self.subTest(label=label):
                broken = json.loads(marker_path.read_text(encoding="utf-8"))
                corrupt(broken["blocks"][0])
                contract.atomic_write_json(marker_path, broken)
                self.assertEqual(
                    contract.reusable_proven_blocks(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration),
                    {},
                    label,
                )
                contract.atomic_write_json(marker_path, marker)

    def test_malformed_prior_speaker_is_quarantined_and_replaced_without_crash(self):
        lesson_id, blocks = self._seed_current_generation("M01-00-20")
        marker_path = self.out / f"{lesson_id}.provenance.json"
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        marker["blocks"][0]["speaker"] = []
        contract.atomic_write_json(marker_path, marker)
        render.render_lesson(None, lesson_id, None, "cpu")

        self.assertTrue(render.is_generation_current(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration))
        marker_after = json.loads(marker_path.read_text(encoding="utf-8"))
        self.assertEqual(marker_after["blocks"][0]["speaker"], blocks[0]["speaker"])
        quarantines = list((self.out / "_archive" / lesson_id).glob("*/quarantine.json"))
        self.assertGreaterEqual(len(quarantines), 1)

    def test_resume_rejects_malformed_rows_and_nonfinite_recorded_duration(self):
        lesson_id = "M01-00-16"
        self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        work_dir = next((self.out / lesson_id).glob(".work-*"))
        checksum_path = work_dir / f"{lesson_id}.checksums.json"
        blocks = json.loads((self.lessons / f"{lesson_id}.json").read_text(encoding="utf-8"))["speechBlocks"]
        document = json.loads(checksum_path.read_text(encoding="utf-8"))

        document["blocks"][0]["durationSeconds"] = float("nan")
        document["blocks"][1] = []
        contract.atomic_write_json(checksum_path, document)
        rebuilt, ready = contract.verified_work_rows(lesson_id, blocks, work_dir, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration)

        self.assertEqual(ready, {})
        self.assertEqual([row["state"] for row in rebuilt["blocks"]], ["pending", "pending"])

    def test_short_but_hash_consistent_old_cues_are_quarantined_and_replaced(self):
        lesson_id = "M01-00-17"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        cues_path = self.out / f"{lesson_id}.cues.json"
        marker_path = self.out / f"{lesson_id}.provenance.json"
        cues = json.loads(cues_path.read_text(encoding="utf-8"))
        cues["blocks"].pop()
        contract.atomic_write_json(cues_path, cues)
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        marker["cuesBytes"] = cues_path.stat().st_size
        marker["cuesSha256"] = contract.sha256_file(cues_path)
        contract.atomic_write_json(marker_path, marker)
        corrupted_cues_bytes = cues_path.read_bytes()
        blocks = json.loads(lesson_path.read_text(encoding="utf-8"))["speechBlocks"]

        self.assertEqual(contract.reusable_proven_blocks(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration), {})
        render.render_lesson(None, lesson_id, None, "cpu")

        self.assertTrue(render.is_generation_current(lesson_id, blocks, self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration))
        quarantines = list((self.out / "_archive" / lesson_id).glob("*/quarantine.json"))
        self.assertEqual(len(quarantines), 1)
        quarantine = json.loads(quarantines[0].read_text(encoding="utf-8"))
        self.assertEqual(quarantine["classification"], "corrupt-prior-generation-raw-copy")
        self.assertEqual(quarantine["reason"], "old-cue-block-count-mismatch")
        raw_cues = quarantines[0].parent / f"{lesson_id}.cues.json"
        self.assertEqual(raw_cues.read_bytes(), corrupted_cues_bytes)

    def test_shrinking_generation_archives_every_old_marker_block(self):
        lesson_id = "M01-00-12"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        old_marker = json.loads((self.out / f"{lesson_id}.provenance.json").read_text(encoding="utf-8"))
        lesson_path.write_text(json.dumps(make_lesson(lesson_id, [("A", "Ein unveränderter Block.")]), ensure_ascii=False), encoding="utf-8")
        render.render_lesson(None, lesson_id, None, "cpu")

        old_generation = next((self.out / "_archive" / lesson_id).iterdir())
        old_archived_marker = json.loads((old_generation / f"{lesson_id}.provenance.json").read_text(encoding="utf-8"))
        self.assertEqual(old_archived_marker, old_marker)
        for row in old_marker["blocks"]:
            path = old_generation / lesson_id / row["file"]
            self.assertTrue(path.is_file())
            self.assertEqual(path.stat().st_size, row["audioBytes"])
            self.assertEqual(contract.sha256_file(path), row["audioSha256"])
        archived_cues = json.loads((old_generation / f"{lesson_id}.cues.json").read_text(encoding="utf-8"))
        self.assertEqual(len(archived_cues["blocks"]), len(old_marker["blocks"]))

    def test_index_shift_reuses_only_matching_full_hash_and_keeps_previous_generation(self):
        lesson_id = "M01-00-02"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        initial = list(self.rendered)
        shifted = make_lesson(lesson_id, [("B", "Neuer Block am Anfang."), ("A", "Ein unveränderter Block."), ("B", "Noch ein Wortlaut." )])
        lesson_path.write_text(json.dumps(shifted, ensure_ascii=False), encoding="utf-8")
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), len(initial) + 1)
        new_block = self.out / lesson_id / f"{lesson_id}-b001.mp3"
        shifted_block = self.out / lesson_id / f"{lesson_id}-b002.mp3"
        self.assertIn(b"Neuer Block am Anfang", new_block.read_bytes())
        self.assertIn("Ein unveränderter Block".encode("utf-8"), shifted_block.read_bytes())
        archives = list((self.out / "_archive" / lesson_id).glob("*"))
        self.assertGreaterEqual(len(archives), 1)
        self.assertTrue((archives[0] / f"{lesson_id}.mp3").is_file())
        self.assertTrue((archives[0] / f"{lesson_id}.cues.json").is_file())
        self.assertTrue((archives[0] / f"{lesson_id}.provenance.json").is_file())
        self.assertEqual(len(list((archives[0] / lesson_id).glob("*.mp3"))), 2)

    def test_crash_after_first_checksum_write_resumes_without_losing_completed_rows(self):
        lesson_id = "M01-00-03"
        self.lesson_path(lesson_id)
        real_progress = render.write_progress
        crashed = False

        def crash_after_first_block(**fields):
            nonlocal crashed
            if fields.get("status") == "block-done" and not crashed:
                crashed = True
                raise RuntimeError("injected crash after atomically saved block")
            real_progress(**fields)

        self.patch(render, "write_progress", crash_after_first_block)
        with self.assertRaisesRegex(RuntimeError, "injected crash"):
            render.render_lesson(None, lesson_id, None, "cpu")
        work_dirs = list((self.out / lesson_id).glob(".work-*"))
        document = json.loads((work_dirs[0] / f"{lesson_id}.checksums.json").read_text(encoding="utf-8"))
        self.assertEqual(len(document["blocks"]), 2)
        self.assertEqual(document["blocks"][0]["state"], "rendered")
        self.assertEqual(document["blocks"][1]["state"], "pending")

        self.patch(render, "write_progress", real_progress)
        before = len(self.rendered)
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered) - before, 1)
        self.assertTrue((self.out / f"{lesson_id}.provenance.json").is_file())

    def test_refresh_paused_progress_does_not_duplicate_phase_or_status(self):
        render.PROGRESS_PATH.parent.mkdir(parents=True, exist_ok=True)
        render.PROGRESS_PATH.write_text(
            json.dumps(
                {
                    "status": "generating",
                    "phase": "block",
                    "lessonId": "M01-00-99",
                    "block": 2,
                    "totalBlocks": 5,
                    "speaker": "A",
                    "index": 1,
                    "remaining": 3,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        render.refresh_paused_progress()
        data = json.loads(render.PROGRESS_PATH.read_text(encoding="utf-8"))
        self.assertEqual(data["status"], "paused")
        self.assertEqual(data["phase"], "paused")
        self.assertEqual(data["lessonId"], "M01-00-99")
        self.assertEqual(data["block"], 2)
        self.assertEqual(data["totalBlocks"], 5)
        self.assertEqual(data["speaker"], "A")
        self.assertEqual(data["index"], 1)
        self.assertEqual(data["remaining"], 3)
        self.assertIn("pid", data)
        self.assertIn("updatedAt", data)

    def test_probe_is_isolated_and_never_creates_release_outputs(self):
        lesson_id = "M01-00-04"
        self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, 1, "cpu")
        self.assertFalse((self.out / f"{lesson_id}.mp3").exists())
        self.assertFalse((self.out / f"{lesson_id}.cues.json").exists())
        self.assertFalse((self.out / f"{lesson_id}.provenance.json").exists())
        probes = list((self.out / "_probes").glob(f"{lesson_id}-*"))
        self.assertEqual(len(probes), 1)
        self.assertTrue((probes[0] / f"{lesson_id}.mp3").is_file())
        self.assertFalse(any((self.out / f"{lesson_id}").glob("*.mp3")))

    def test_stale_and_unmarked_existing_mp3_is_not_reported_complete(self):
        lesson_id = "M01-00-05"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(render.missing_lesson_ids(), [])
        marker = self.out / f"{lesson_id}.provenance.json"
        marker.unlink()
        self.assertTrue((self.out / f"{lesson_id}.mp3").is_file())
        self.assertEqual(render.missing_lesson_ids(), [lesson_id])
        lesson_path.write_text(json.dumps(make_lesson(lesson_id, [("A", "Gesprochener Text ist geändert.")]), ensure_ascii=False), encoding="utf-8")
        self.assertEqual(render.missing_lesson_ids(), [lesson_id])

    def test_self_consistent_cue_bytes_still_fail_if_cue_timing_does_not_match_real_block_durations(self):
        lesson_id = "M01-00-09"
        self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        marker_path = self.out / f"{lesson_id}.provenance.json"
        cues_path = self.out / f"{lesson_id}.cues.json"
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        cues = json.loads(cues_path.read_text(encoding="utf-8"))
        cues["blocks"][1]["startSeconds"] = 0.8
        contract.atomic_write_json(cues_path, cues)
        marker["cuesBytes"] = cues_path.stat().st_size
        marker["cuesSha256"] = contract.sha256_file(cues_path)
        contract.atomic_write_json(marker_path, marker)
        lesson = json.loads((self.lessons / f"{lesson_id}.json").read_text(encoding="utf-8"))
        self.assertFalse(render.is_generation_current(lesson_id, lesson["speechBlocks"], self.out, "fake-ffprobe", self.fake_mp3_ok, self.fake_duration))
        self.assertIn(lesson_id, render.missing_lesson_ids())

    def test_legacy_checksum_without_full_binding_is_never_used_for_reuse(self):
        lesson_id = "M01-00-07"
        self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), 2)
        (self.out / f"{lesson_id}.provenance.json").unlink()
        for work_dir in (self.out / lesson_id).glob(".work-*"):
            shutil.rmtree(work_dir)
        old = self.out / lesson_id / f"{lesson_id}.checksums.json"
        old.write_text('{"0":"deadbeefdeadbeef","1":"deadbeefdeadbeef"}', encoding="utf-8")
        render.render_lesson(None, lesson_id, None, "cpu")
        self.assertEqual(len(self.rendered), 4, "legacy checksum cannot prove current speaker/text binding")

    def test_publish_pair_failure_leaves_no_valid_marker_and_archives_prior_pair(self):
        lesson_id = "M01-00-08"
        lesson_path = self.lesson_path(lesson_id)
        render.render_lesson(None, lesson_id, None, "cpu")
        old_audio = (self.out / f"{lesson_id}.mp3").read_bytes()
        old_cues = (self.out / f"{lesson_id}.cues.json").read_bytes()
        old_marker = json.loads((self.out / f"{lesson_id}.provenance.json").read_text(encoding="utf-8"))
        work_dir = next((self.out / lesson_id).glob(".work-*"))
        staged_audio = work_dir / "broken-republish.mp3"
        staged_cues = work_dir / "broken-republish.cues.json"
        staged_audio.write_bytes(b"new candidate" * 100)
        staged_cues.write_text(json.dumps({"lessonId": lesson_id, "blocks": old_marker["blocks"]}), encoding="utf-8")
        self.duration_by_hash[hashlib.sha256(staged_audio.read_bytes()).hexdigest()] = 1.6
        actual_replace = os.replace
        cues_dest = self.out / f"{lesson_id}.cues.json"

        def fail_second_file(source, destination):
            if Path(destination) == cues_dest and Path(source) == staged_cues:
                raise OSError("injected cue-publish failure")
            return actual_replace(source, destination)

        with patch.object(render.os, "replace", side_effect=fail_second_file):
            with self.assertRaisesRegex(OSError, "cue-publish"):
                render.publish_generation(
                    lesson_id,
                    json.loads(lesson_path.read_text(encoding="utf-8"))["speechBlocks"],
                    work_dir,
                    old_marker["blocks"],
                    staged_audio,
                    staged_cues,
                    1.6,
                )
        self.assertFalse((self.out / f"{lesson_id}.provenance.json").exists())
        self.assertEqual((self.out / f"{lesson_id}.cues.json").read_bytes(), old_cues)
        archived_markers = list((self.out / "_archive" / lesson_id).glob(f"*/{lesson_id}.provenance.json"))
        self.assertEqual(len(archived_markers), 1)
        self.assertEqual(json.loads(archived_markers[0].read_text(encoding="utf-8")), old_marker)
        self.assertTrue((self.out / f"{lesson_id}.mp3").is_file())
        self.assertNotEqual((self.out / f"{lesson_id}.mp3").read_bytes(), old_audio)
        self.assertIn(lesson_id, render.missing_lesson_ids())

    def test_atomic_checksum_replace_failure_preserves_old_complete_json(self):
        path = self.out / "atomic.json"
        path.write_text('{"old":true}\n', encoding="utf-8")
        with patch.object(contract.os, "replace", side_effect=OSError("injected rename crash")):
            with self.assertRaisesRegex(OSError, "injected"):
                contract.atomic_write_json(path, {"new": True})
        self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"old": True})
        self.assertEqual(list(self.out.glob(".atomic.json.*.partial")), [])

    def test_batch_lock_is_exclusive_across_processes_and_stale_file_is_reclaimable(self):
        release = self.root / "release.lock-holder"
        acquired = self.root / "lock-holder-acquired"
        audio_dir = str(AUDIO_DIR)
        lock_path = str(self.out / "process.lock")
        out_dir = str(self.out)
        holder_code = (
            "import sys,time; from pathlib import Path; "
            f"sys.path.insert(0, {audio_dir!r}); import render_chatterbox as r; "
            f"r.OUT_DIR=Path({out_dir!r}); r.LOCK_PATH=Path({lock_path!r}); "
            "r.acquire_lock(); "
            f"Path({str(acquired)!r}).write_text('yes'); release=Path({str(release)!r}); "
            "exec('while not release.exists():\\n time.sleep(0.01)'); r.release_lock()"
        )
        challenger_code = (
            "import sys; from pathlib import Path; "
            f"sys.path.insert(0, {audio_dir!r}); import render_chatterbox as r; "
            f"r.OUT_DIR=Path({out_dir!r}); r.LOCK_PATH=Path({lock_path!r}); r.acquire_lock()"
        )
        holder = subprocess.Popen([sys.executable, "-c", holder_code], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True)
        try:
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and holder.poll() is None and not acquired.exists():
                time.sleep(0.01)
            self.assertTrue(acquired.exists(), "first process did not acquire lock before the timeout")
            challenger = subprocess.run([sys.executable, "-c", challenger_code], capture_output=True, text=True, timeout=10)
            self.assertNotEqual(challenger.returncode, 0)
            self.assertIn("exklusiven OS-Lock", challenger.stderr)
        finally:
            release.touch()
            try:
                holder.wait(timeout=10)
            except subprocess.TimeoutExpired:
                holder.terminate()
                holder.wait(timeout=5)
        # The OS releases the lock when a process exits; a stale owner record is not a blocker.
        reclaim = subprocess.run([sys.executable, "-c", challenger_code + "; r.release_lock()"], capture_output=True, text=True, timeout=10)
        self.assertEqual(reclaim.returncode, 0, reclaim.stderr)

    def test_supervisor_limit_is_fixed_target_and_does_not_expand_after_first_completion(self):
        ids = ["M01-00-13", "M01-00-14"]
        completed: set[str] = set()
        spawned: list[list[str]] = []

        class ImmediateProcess:
            returncode = 0
            def poll(self):
                return 0

        def fake_popen(command, **_kwargs):
            spawned.append(command)
            start = command.index("--lesson-ids") + 1
            end = command.index("--device") if "--device" in command else len(command)
            selected = command[start:end]
            completed.update(selected)
            return ImmediateProcess()

        with patch.object(render, "missing_lesson_ids", return_value=ids):
            targets = render.select_supervised_targets(None, True, 1)
        self.assertEqual(targets, ids[:1])
        with patch.object(render, "lesson_generation_is_current", side_effect=lambda lesson_id: lesson_id in completed), patch.object(render.subprocess, "Popen", side_effect=fake_popen), patch.object(render, "read_desired", return_value="run"):
            self.assertEqual(render.run_supervised(targets, 60, "cpu", False), 0)
        self.assertEqual(len(spawned), 1)
        start = spawned[0].index("--lesson-ids") + 1
        end = spawned[0].index("--device")
        self.assertEqual(spawned[0][start:end], [ids[0]])

        self.assertEqual(render.select_supervised_targets(ids[1], False, None), [ids[1]])

    def test_cross_language_speech_hash_vector(self):
        blocks = [{"speaker": "A", "text": "Grüße\nMünchen"}, {"speaker": "B", "text": "Wörter"}]
        canonical = '[{"speaker":"A","text":"Grüße\\nMünchen"},{"speaker":"B","text":"Wörter"}]'
        self.assertEqual(contract.canonical_speech_json(blocks), canonical)
        expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        self.assertEqual(contract.speech_sha256(blocks), expected)
        print(f"speechSha256 test vector: {expected}")


class RealFfmpegMontageTests(unittest.TestCase):
    def test_small_real_ffmpeg_montage_cues_use_measured_block_and_output_duration(self):
        ffmpeg = shutil.which("ffmpeg")
        ffprobe = shutil.which("ffprobe")
        if not ffmpeg or not ffprobe:
            self.skipTest("ffmpeg/ffprobe not installed")
        with tempfile.TemporaryDirectory(prefix="futuredev-real-audio-") as directory:
            root = Path(directory)
            paths = [root / "one.mp3", root / "two.mp3"]
            for index, path in enumerate(paths):
                subprocess.run([ffmpeg, "-y", "-v", "error", "-f", "lavfi", "-i", f"sine=frequency={440 + index * 80}:duration=0.45", "-q:a", "9", str(path)], check=True)
            blocks = [{"speaker": "A", "role": "body"}, {"speaker": "B", "role": "faq"}]
            output = root / "M01-00-06.mp3"
            durations = render.concat_lesson("M01-00-06", blocks, paths, output, ffmpeg, ffprobe)
            cues = render.build_cues("M01-00-06", blocks, durations)
            actual = render.duration_seconds(output, ffprobe)
            cue_end = cues["blocks"][-1]["startSeconds"] + cues["blocks"][-1]["durationSeconds"]
            self.assertTrue(render.mp3_ok(output, ffprobe))
            self.assertLessEqual(abs(actual - cue_end), 0.35)
            self.assertGreater(durations[0], 0.1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
