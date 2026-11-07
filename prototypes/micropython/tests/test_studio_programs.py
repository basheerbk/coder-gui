"""The MicroPython Beginner Studio writes (src/beginner-studio/domain/pycodegen.js), run on the
simulated board with the tinkerbit library: every built-in template it fully supports must start,
loop with its sensors both idle and triggered, and stop on Ctrl-C without any error. Cloud
templates run on the TinkerBit firmware (Stage B) with the files Studio puts there: boot.py and
/config.json."""
import json
import os
import re
import shutil
import subprocess
import time

import pytest

from conftest import PROTO, gpio, library_files, read

# Test values only, like test_cloud.py: never a real network or device key.
CLOUD_CONFIG = {
    "wifi_ssid": "test-ssid",
    "wifi_password": "not-a-real-password",
    "host": "test.mosquitto.org",
    "port": 8886,
    "ws_port": 8081,
    "device_id": "proto-001",
    "token": "not-a-real-token",
}

REPO = os.path.dirname(os.path.dirname(PROTO))
NODE = shutil.which("node")


def _programs():
    if not NODE:
        return {}
    out = subprocess.run([NODE, os.path.join(PROTO, "tools", "studio_python.js")],
                         cwd=REPO, capture_output=True, timeout=120)
    if out.returncode:
        raise RuntimeError(out.stderr.decode("utf-8", "replace"))
    return json.loads(out.stdout.decode("utf-8"))


PROGRAMS = _programs()
RUNNABLE = sorted(k for k, v in PROGRAMS.items() if not v["gaps"])
needs_node = pytest.mark.skipif(not NODE, reason="node is not installed")

ERROR_LINE = re.compile(r"\b\w+(Error|Exception)\b")


@needs_node
def test_every_template_is_valid_python():
    assert len(PROGRAMS) > 50
    for tid, p in PROGRAMS.items():
        compile(p["code"], tid, "exec")


@needs_node
def test_most_templates_need_nothing_missing():
    assert len(RUNNABLE) > len(PROGRAMS) / 2


@needs_node
@pytest.mark.parametrize("tid", RUNNABLE)
def test_template_runs_on_the_board(make_board, tid):
    code = PROGRAMS[tid]["code"]
    cloud = "from tinkerbit import cloud" in code
    b, h = make_board(firmware="stage_b" if cloud else "stage_a")
    h.read_until(">>> ")
    h.enter_raw()
    if cloud:
        files = {"/boot.py": read("boot.py"), "/config.json": json.dumps(CLOUD_CONFIG)}
    else:
        files = library_files(with_main=False)
    files["/main.py"] = code
    h.install_files(files)
    b.time_scale = 0.02
    h.soft_reset_run_main()
    time.sleep(0.5)
    # Triggered: buttons pressed, active-high sensors on, analog sensors high.
    for jack in ("D13", "A1", "A2", "A3", "A4"):
        b.inputs[gpio(jack)] = 0 if "btn" in PROGRAMS[tid]["code"] else 1
        b.analog[gpio(jack)] = 3500
    time.sleep(0.5)
    for jack in ("D13", "A1", "A2", "A3", "A4"):
        b.inputs[gpio(jack)] = 1 - b.inputs[gpio(jack)]
        b.analog[gpio(jack)] = 300
    time.sleep(0.5)
    h.write(b"\x03")
    out = h.read_until(">>> ", timeout=5).decode("utf-8", "replace")
    assert "TinkerBit Beginner ready" in out
    errors = [l for l in out.splitlines() if ERROR_LINE.search(l)]
    assert not errors, out[-1500:]
    assert "KeyboardInterrupt" in out
    if cloud:
        assert 'Cloud: joining WiFi "test-ssid"' in out
        assert "not-a-real-password" not in out and "not-a-real-token" not in out
    # The loop ran: something printed after the program's own setup lines.
    loop_lines = [l for l in out.splitlines() if l and "ready" not in l and "Traceback" not in l]
    assert len(loop_lines) > 3, out[-800:]
