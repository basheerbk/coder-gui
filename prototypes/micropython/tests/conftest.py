import importlib.util
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PROTO = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(PROTO, "sim"))
# Loading board.py from lib/ must not leave __pycache__ next to the board files.
sys.dont_write_bytecode = True

from board_sim import Board  # noqa: E402
from host import Host  # noqa: E402


def _load_board_map():
    spec = importlib.util.spec_from_file_location("tb_board_map", os.path.join(PROTO, "lib", "tinkerbit", "board.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


BOARD_MAP = _load_board_map()


def gpio(jack, role="sig"):
    """GPIO number of a jack, read from board.py (the only file allowed to hold them)."""
    return BOARD_MAP.pin(jack, role)


def read(rel):
    with open(os.path.join(PROTO, rel), encoding="utf-8") as f:
        return f.read()


LIBRARY_MODULES = ("__init__", "board", "rc522", "max30102", "ble")


def library_files(with_main=True):
    files = {"/lib/tinkerbit/%s.py" % m: read("lib/tinkerbit/%s.py" % m) for m in LIBRARY_MODULES}
    files.update({
        "/lib/ssd1306.py": read("lib/ssd1306.py"),
        "/boot.py": read("boot.py"),
    })
    if with_main:
        files["/main.py"] = read("main.py")
    return files


@pytest.fixture
def make_board(tmp_path):
    boards = []

    def make(firmware="stage_a", boot_ms=50, power=True):
        b = Board(str(tmp_path / ("flash%d" % len(boards))), firmware=firmware, boot_ms=boot_ms)
        h = Host(b)
        boards.append(b)
        if power:
            b.power_on()
        return b, h

    yield make
    for b in boards:
        b.shutdown()


@pytest.fixture
def board(make_board):
    """Stage A board with the TinkerBit library installed, sitting in the raw REPL."""
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.install_files(library_files(with_main=False))
    return b, h
