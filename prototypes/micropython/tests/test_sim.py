"""Protocol and boot behaviour of the simulator (raw REPL, raw-paste, resets, safe mode)."""
import re
import time

from conftest import library_files, read


def test_power_on_boots_to_friendly_repl_and_creates_boot_py(make_board):
    b, h = make_board()
    out = h.read_until(">>> ").decode()
    assert "rst:0x1 (POWERON_RESET)" in out
    assert "MicroPython v1.24.1" in out
    assert "/boot.py" in b.files()


def test_raw_repl_exec_and_framing(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.write(b"print(1+1)\x04")
    assert h.read_until(b">") == b"OK2\r\n\x04\x04>"


def test_raw_repl_exception_goes_after_first_eof(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    out, err = h.exec_raw("print('a')\nundefined_name")
    assert out == "a\r\n"
    assert err.startswith("Traceback (most recent call last):")
    assert err.strip().endswith("NameError: name 'undefined_name' is not defined")


def test_globals_persist_between_raw_commands(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.exec_raw("x = 41")
    assert h.exec_raw("print(x + 1)") == ("42\r\n", "")


def test_raw_paste_honours_flow_control(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    code = "\n".join("v%d = %d" % (i, i) for i in range(400)) + "\nprint(v399)\n"
    assert len(code) > 4000
    assert h.exec_paste(code) == ("399\r\n", "")
    assert b.paste_violations == 0


def test_raw_paste_without_flow_control_is_detected(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    code = "#" + "x" * 2000 + "\nprint('done')\n"
    h.exec_paste(code, honor_flow=False)
    assert b.paste_violations > 0


def test_ctrl_c_stops_an_infinite_loop(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.write(b"while True:\n  pass\x04")
    h.read_until(b"OK")
    time.sleep(0.2)
    h.write(b"\x03")
    out, err = h._result(3)
    assert "KeyboardInterrupt" in err


def test_ctrl_c_stops_sleep_loop(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.write(b"import time\nwhile True:\n  time.sleep(1)\x04")
    h.read_until(b"OK")
    time.sleep(0.2)
    h.write(b"\x03")
    assert "KeyboardInterrupt" in h._result(3)[1]


def test_friendly_soft_reset_runs_boot_then_main(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.install_files({"/boot.py": "print('BOOT')\n", "/main.py": "print('MAIN')\n"})
    h.soft_reset_run_main()
    out = h.read_until(">>> ").decode()
    assert out.index("BOOT") < out.index("MAIN")


def test_raw_soft_reset_skips_main(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.install_files({"/main.py": "print('MAIN')\n"})
    h.write(b"\x04")
    out = h.read_until(b"raw REPL; CTRL-B to exit\r\n>").decode()
    assert "soft reboot" in out and "MAIN" not in out


def test_boot_py_exception_skips_main(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.install_files({"/boot.py": "raise Exception('stop')\n", "/main.py": "print('MAIN')\n"})
    h.soft_reset_run_main()
    out = h.read_until(">>> ").decode()
    assert "Exception: stop" in out and "MAIN" not in out


def test_open_without_glitch_does_not_reset(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.open_port(glitch=False)
    assert b.resets == 0


def test_open_with_rts_first_glitch_resets(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.open_port(glitch=True)
    assert b.resets == 1


def test_hard_reset_through_rts(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.clear()
    h.hard_reset()
    assert "POWERON_RESET" in h.read_until(">>> ").decode()
    assert b.boots == 2


def test_esptool_classic_sequence_enters_download_mode(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    b.set_signals(dtr=False, rts=True)
    time.sleep(0.05)
    b.set_signals(dtr=True, rts=False)
    assert "waiting for download" in h.read_until("download").decode() + "download"


def _stuck_board(make_board, firmware):
    b, h = make_board(firmware=firmware)
    h.read_until(">>> ")
    h.enter_raw()
    files = library_files(with_main=False)
    files["/main.py"] = "while True:\n    pass\n"
    h.install_files(files)
    return b, h


def test_safe_mode_stage_a_recovers_stuck_main_10_of_10(make_board):
    b, h = _stuck_board(make_board, "stage_a")
    for _ in range(10):
        assert h.recover()
        h.read_until(">>> ")
        h.enter_raw()
        assert h.exec_raw("print('alive')") == ("alive\r\n", "")
    assert b.rx_overflow == 0


def test_safe_mode_stage_b_recovers_stuck_main_10_of_10(make_board):
    b, h = _stuck_board(make_board, "stage_b")
    for _ in range(10):
        assert h.recover()
        # Stage B lands directly in the raw REPL.
        h.read_until(b"raw REPL; CTRL-B to exit\r\n>")
        h.enter_raw()
        assert h.exec_raw("print('alive')") == ("alive\r\n", "")


def test_without_safe_mode_stuck_main_ignores_ctrl_a(make_board):
    b, h = _stuck_board(make_board, "stage_a")
    h.clear()
    h.hard_reset()
    time.sleep(0.6)
    h.write(b"\x01")
    time.sleep(0.2)
    assert "raw REPL" not in h.text()
    # Ctrl-C still works for a plain loop.
    h.enter_raw()


def test_uart0_baud_change_garbles_and_survives_soft_reset(make_board):
    b, h = make_board()
    h.read_until(">>> ")
    h.enter_raw()
    h.write(b"import machine\nmachine.UART(0, baudrate=9600)\nprint('at9600')\x04")
    time.sleep(0.3)
    assert "at9600" not in h.text()
    b.set_host_baud(9600)
    h.clear()
    h.write(b"\x02")
    h.read_until(b">>> ")
    h.write(b"\x04")
    h.read_until(b"MPY: soft reboot\r\n")
    h.read_until(b">>> ")
    assert b.uart_baud == 9600
    h.hard_reset()
    b.set_host_baud(115200)
    h.read_until(">>> ")
    assert b.uart_baud == 115200


def test_stage_b_has_native_modules_and_frozen_library(make_board):
    b, h = make_board(firmware="stage_b")
    h.read_until(">>> ")
    h.enter_raw()
    out, err = h.exec_raw("import tinkerbit, tbsys, tbcloud\nprint(tinkerbit.VERSION)")
    version = re.search(r'^VERSION = "([^"]+)"', read("lib/tinkerbit/__init__.py"), re.M).group(1)
    assert err == "" and out.strip() == version
    assert not [f for f in b.files() if f.startswith("/lib/")]


def test_firmware_none_never_gives_a_repl(make_board):
    b, h = make_board(firmware="none")
    time.sleep(0.3)
    h.write(b"\r\x03\x03\x01")
    time.sleep(0.3)
    assert "raw REPL" not in h.text()
