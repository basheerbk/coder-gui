"""The hardware check scripts run end to end in the simulator (numbers are meaningless here)."""
import json
import os
import re

from conftest import PROTO, read
from test_cloud import CONFIG


def mic_records(out):
    return [json.loads(l[len("TB_MIC "):]) for l in out.splitlines() if l.startswith("TB_MIC ")]


def test_check2_stage_a_reports_python_rates_only(board):
    b, h = board
    out, err = h.exec_paste(read("checks/check2_mic_rate.py"), timeout=60)
    assert err == ""
    kinds = {r["kind"]: r for r in mic_records(out)}
    assert set(kinds) == {"python_free_running", "python_paced", "c_sampler"}
    assert "error" in kinds["c_sampler"]


def test_check2_stage_b_runs_c_sampler(make_board):
    b, h = make_board(firmware="stage_b")
    h.read_until(">>> ")
    h.enter_raw()
    out, err = h.exec_paste(read("checks/check2_mic_rate.py"), timeout=60)
    assert err == ""
    c = [r for r in mic_records(out) if r["kind"] == "c_sampler"][0]
    assert c["rate_hz"] == 8000 and c["result"] == "PASS"


def test_check1_reaches_mqtt_record(make_board):
    b, h = make_board(firmware="stage_b")
    h.read_until(">>> ")
    h.enter_raw()
    h.install_files({"/config.json": json.dumps(CONFIG)})
    h.write(read("checks/check1_cloud_memory.py").encode() + b"\x04")
    h.read_until(b"OK")
    h.read_until(b'"tag": "mqtt"', timeout=20)
    h.write(b"\x03")
    out, err = h._result(5)
    assert "KeyboardInterrupt" in err
    assert CONFIG["wifi_password"] not in h.log.decode("utf-8", "replace")


def test_gpio_numbers_only_in_board_py():
    paths = [os.path.join(PROTO, "index.html"), os.path.join(PROTO, "firmware", "frozen", "_boot.py")]
    for folder in ("checks", os.path.join("lib", "tinkerbit")):
        for name in os.listdir(os.path.join(PROTO, folder)):
            if name.endswith(".py") and name != "board.py":
                paths.append(os.path.join(PROTO, folder, name))
    for p in paths:
        with open(p, encoding="utf-8") as f:
            src = f.read()
        assert not re.search(r"Pin\(\s*\d", src), p
        assert not re.search(r"(?i)\bgpio\s*\d", src), p
