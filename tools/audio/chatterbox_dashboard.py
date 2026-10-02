#!/usr/bin/env python3
"""Lokales Pause/Resume-Dashboard für Chatterbox-Batch (127.0.0.1, stdlib)."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

AUDIO_DIR = Path(__file__).resolve().parent
ROOT = AUDIO_DIR.parents[1]
OUT_DIR = AUDIO_DIR / "out"
LESSONS_DIR = ROOT / "content" / "lessons"
PROGRESS_PATH = OUT_DIR / "_chatterbox_progress.json"
CONTROL_PATH = OUT_DIR / "_chatterbox_control.json"
BATCH_PS1 = AUDIO_DIR / "run_chatterbox_batch.ps1"
HOST = "127.0.0.1"
PORT = 8765


def iso_now() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%dT%H:%M:%S")


def read_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, OSError):
        return {}


def read_desired() -> str:
    desired = read_json(CONTROL_PATH).get("desired", "run")
    return desired if desired in ("run", "pause") else "run"


def set_desired(desired: str, reason: str = "") -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "desired": desired if desired in ("run", "pause") else "run",
        "updatedAt": iso_now(),
        "reason": reason,
    }
    CONTROL_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def missing_lesson_count() -> int:
    have = {p.stem for p in OUT_DIR.glob("*.mp3")}
    ids = [p.stem for p in LESSONS_DIR.glob("*.json")]
    return sum(1 for i in ids if i not in have)


def list_render_pids() -> list[int]:
    pids: list[int] = []
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(
                [
                    "wmic",
                    "process",
                    "where",
                    "name='python.exe'",
                    "get",
                    "ProcessId,CommandLine",
                    "/FORMAT:CSV",
                ],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except (subprocess.CalledProcessError, OSError):
            try:
                out = subprocess.check_output(
                    [
                        "powershell",
                        "-NoProfile",
                        "-Command",
                        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                        "Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
                    ],
                    text=True,
                    stderr=subprocess.DEVNULL,
                )
                data = json.loads(out) if out.strip() else []
                if isinstance(data, dict):
                    data = [data]
                for row in data:
                    cmd = row.get("CommandLine") or ""
                    if "render_chatterbox.py" in cmd:
                        pids.append(int(row["ProcessId"]))
                return sorted(set(pids))
            except (subprocess.CalledProcessError, OSError, json.JSONDecodeError, ValueError):
                return []
        for line in out.splitlines():
            if "render_chatterbox.py" not in line:
                continue
            parts = line.split(",")
            if len(parts) >= 2:
                try:
                    pids.append(int(parts[-1].strip()))
                except ValueError:
                    pass
        return sorted(set(pids))
    try:
        out = subprocess.check_output(["pgrep", "-f", "render_chatterbox.py"], text=True)
        return sorted(int(x) for x in out.split() if x.strip())
    except (subprocess.CalledProcessError, OSError, ValueError):
        return []


def kill_render_processes() -> list[int]:
    killed: list[int] = []
    for pid in list_render_pids():
        try:
            if sys.platform == "win32":
                subprocess.check_call(
                    ["taskkill", "/PID", str(pid), "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                import os

                os.kill(pid, 9)
            killed.append(pid)
        except (subprocess.CalledProcessError, OSError):
            pass
    return killed


def build_status() -> dict:
    progress = read_json(PROGRESS_PATH)
    control = read_json(CONTROL_PATH)
    pids = list_render_pids()
    return {
        "progress": progress,
        "control": control,
        "desired": read_desired(),
        "renderPids": pids,
        "renderAlive": len(pids) > 0,
        "missingLessons": missing_lesson_count(),
        "serverTime": iso_now(),
    }


def spawn_batch() -> int | None:
    if not BATCH_PS1.is_file():
        return None
    if sys.platform == "win32":
        proc = subprocess.Popen(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(BATCH_PS1),
            ],
            cwd=str(AUDIO_DIR),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,  # type: ignore[attr-defined]
        )
        return proc.pid
    proc = subprocess.Popen(["powershell", "-File", str(BATCH_PS1)], cwd=str(AUDIO_DIR))
    return proc.pid


HTML_PAGE = """<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Chatterbox Batch</title>
  <style>
    :root { color-scheme: dark; --bg:#0f1115; --card:#1a1f2a; --text:#e8ecf4; --muted:#9aa4b8; --accent:#6ea8fe; --warn:#ffb454; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
    h1 { font-size: 1.25rem; margin: 0 0 16px; }
    .grid { display: grid; gap: 12px; max-width: 520px; }
    .card { background: var(--card); border-radius: 12px; padding: 16px; }
    .row { display: flex; justify-content: space-between; gap: 12px; margin: 6px 0; }
    .label { color: var(--muted); }
    .status-paused { color: var(--warn); font-weight: 600; }
    .status-run { color: #7dcea0; font-weight: 600; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    button { border: 0; border-radius: 8px; padding: 10px 16px; font-size: 0.95rem; cursor: pointer; }
    #btnPause { background: var(--warn); color: #1a1200; }
    #btnResume { background: var(--accent); color: #0a1628; }
    #btnStop { background: #c0392b; color: #fff; }
    #msg { color: var(--muted); font-size: 0.85rem; min-height: 1.2em; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>Chatterbox TTS Batch</h1>
  <div class="grid">
    <div class="card" id="statusCard">
      <div class="row"><span class="label">Status</span><span id="status">—</span></div>
      <div class="row"><span class="label">Desired</span><span id="desired">—</span></div>
      <div class="row"><span class="label">Lektion</span><span id="lesson">—</span></div>
      <div class="row"><span class="label">Block</span><span id="block">—</span></div>
      <div class="row"><span class="label">PID(s)</span><span id="pids">—</span></div>
      <div class="row"><span class="label">Fehlend (ca.)</span><span id="missing">—</span></div>
      <div class="row"><span class="label">Aktualisiert</span><span id="updated">—</span></div>
      <div class="actions">
        <button type="button" id="btnPause">Pause (Gaming)</button>
        <button type="button" id="btnResume">Resume</button>
        <button type="button" id="btnStop">Stop (sofort)</button>
      </div>
      <div id="msg"></div>
    </div>
  </div>
  <script>
    const msg = (t) => { document.getElementById('msg').textContent = t || ''; };
    async function refresh() {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        const p = d.progress || {};
        const st = p.status || '—';
        const el = document.getElementById('status');
        el.textContent = st;
        el.className = (st === 'paused' || d.desired === 'pause') ? 'status-paused' : 'status-run';
        document.getElementById('desired').textContent = d.desired || '—';
        document.getElementById('lesson').textContent = p.lessonId || '—';
        const block = (p.block != null && p.totalBlocks) ? `${p.block} / ${p.totalBlocks}` : (p.block ?? '—');
        document.getElementById('block').textContent = block;
        document.getElementById('pids').textContent = (d.renderPids && d.renderPids.length) ? d.renderPids.join(', ') : '—';
        document.getElementById('missing').textContent = d.missingLessons ?? '—';
        document.getElementById('updated').textContent = p.updatedAt || d.serverTime || '—';
      } catch (e) {
        msg('Status nicht lesbar: ' + e);
      }
    }
    async function post(path) {
      msg('…');
      const r = await fetch(path, { method: 'POST' });
      const d = await r.json();
      msg(d.message || JSON.stringify(d));
      refresh();
    }
    document.getElementById('btnPause').onclick = () => post('/api/pause');
    document.getElementById('btnResume').onclick = () => post('/api/resume');
    document.getElementById('btnStop').onclick = () => post('/api/stop');
    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        return self.rfile.read(length) if length else b""

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/" or self.path.startswith("/?"):
            body = HTML_PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/api/status":
            self._json(200, build_status())
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.startswith("/api/pause"):
            reason = "gaming"
            body = self._read_body().decode("utf-8", errors="replace")
            if body:
                try:
                    data = json.loads(body)
                    reason = str(data.get("reason") or reason)
                except json.JSONDecodeError:
                    qs = parse_qs(body)
                    if qs.get("reason"):
                        reason = qs["reason"][0]
            set_desired("pause", reason=reason)
            alive = list_render_pids()
            msg = (
                "Pause gesetzt — Worker beendet nach aktuellem Block."
                if alive
                else "Pause gesetzt — kein Worker aktiv."
            )
            self._json(200, {"ok": True, "message": msg, "renderPids": alive})
            return
        if self.path == "/api/resume":
            set_desired("run", reason="")
            spawned: int | None = None
            if not list_render_pids():
                spawned = spawn_batch()
            msg = (
                f"Resume — Batch gestartet (launcher pid={spawned})."
                if spawned
                else "Resume — Supervisor/Worker laufen bereits oder starten gleich."
            )
            self._json(200, {"ok": True, "message": msg, "spawnedPid": spawned})
            return
        if self.path == "/api/stop":
            set_desired("pause", reason="hard-stop")
            killed = kill_render_processes()
            self._json(
                200,
                {
                    "ok": True,
                    "message": f"Stop — {len(killed)} Prozess(e) beendet.",
                    "killed": killed,
                },
            )
            return
        self.send_error(404)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Chatterbox-Dashboard http://{HOST}:{PORT}/ (Ctrl+C beenden)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
