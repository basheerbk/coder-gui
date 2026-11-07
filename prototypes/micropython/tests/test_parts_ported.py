"""RFID (RC522), heartbeat (MAX30102) and Bluetooth LE in the tinkerbit library, on the simulated
board. The beat detector is also checked against a second implementation with C integer types."""
import ctypes
import importlib.util
import math
import os

from conftest import PROTO


def run(h, code):
    out, err = h.exec_raw(code)
    assert err == "", err
    return out


def run_err(h, code):
    out, err = h.exec_raw(code)
    assert err, "expected an error, got output %r" % out
    return err.strip().splitlines()[-1]


# ---------------- RFID ----------------

def test_rfid_no_card(board):
    b, h = board
    assert run(h, "import tinkerbit\nr = tinkerbit.Rfid('3D')\nprint(repr(r.card()))").strip() == "''"


def test_rfid_reads_a_card_once_until_it_is_put_back(board):
    b, h = board
    run(h, "import tinkerbit\nr = tinkerbit.Rfid('3D')")
    b.spi_device.put_card(b"\xde\xad\x0b\xef")
    assert run(h, "print(r.card())").strip() == "dead0bef"
    # Halted: a card left on the reader is not read again (Arduino PICC_IsNewCardPresent).
    assert run(h, "print(repr(r.card()))").strip() == "''"
    b.spi_device.take_card()
    b.spi_device.put_card(b"\xde\xad\x0b\xef")
    assert run(h, "print(r.read())").strip() == "dead0bef"


def test_rfid_seven_byte_uid(board):
    b, h = board
    b.spi_device.put_card(bytes(range(1, 8)))
    assert run(h, "import tinkerbit\nprint(tinkerbit.Rfid().card())").strip() == "01020304050607"
    assert b.spi_device.selected == 1


def test_rfid_missing_reader_says_so_once_and_is_found_later(board):
    b, h = board
    b.spi_device.version = 0x00
    out = run(h, "import tinkerbit\ntinkerbit.FIND_AGAIN_MS = 0\nr = tinkerbit.Rfid('3D')\n"
                 "print(repr(r.card()))\nprint(repr(r.card()))")
    assert out.count("RFID reader not found - check the 3D cable.") == 1
    assert out.count("''") == 2
    b.spi_device.version = 0x92
    b.spi_device.put_card(b"\x01\x02\x03\x04")
    assert run(h, "print(r.card())").strip() == "01020304"


def test_rfid_cable_pulled_while_running(board):
    b, h = board
    run(h, "import tinkerbit\ntinkerbit.FIND_AGAIN_MS = 0\nr = tinkerbit.Rfid('3D')\nr.card()")
    b.spi_device = None
    assert run(h, "print(repr(r.card()))\nprint(r._dev)").split() == ["''", "None"]


# ---------------- Heartbeat ----------------

def test_heartbeat_no_finger_is_zero(board):
    b, h = board
    assert run(h, "import tinkerbit\nprint(tinkerbit.Heartbeat('I2C1').bpm())").strip() == "0"


def test_heartbeat_counts_a_steady_pulse(board):
    b, h = board
    b.i2c_devices[0x57].finger_bpm = 72
    out = run(h, "import tinkerbit, time\nhb = tinkerbit.Heartbeat()\nv = []\n"
                 "for _ in range(35):\n    v.append(hb.bpm())\n    time.sleep_ms(100)\nprint(v[-1])")
    assert 66 <= int(out.strip()) <= 78, out


def test_heartbeat_slow_loop_still_counts_right(board):
    # Reads 250 ms apart: the FIFO keeps the samples in between, beats are timed by sample number.
    b, h = board
    b.i2c_devices[0x57].finger_bpm = 90
    out = run(h, "import tinkerbit, time\nhb = tinkerbit.Heartbeat()\n"
                 "for _ in range(16):\n    v = hb.bpm()\n    time.sleep_ms(250)\nprint(v)")
    assert 82 <= int(out.strip()) <= 98, out


def test_heartbeat_finger_lifted_goes_to_zero(board):
    b, h = board
    b.i2c_devices[0x57].finger_bpm = 72
    run(h, "import tinkerbit, time\nhb = tinkerbit.Heartbeat()\nfor _ in range(30):\n    hb.bpm()\n    time.sleep_ms(100)")
    b.i2c_devices[0x57].finger_bpm = None
    assert run(h, "time.sleep_ms(50)\nprint(hb.bpm())").strip() == "0"


def test_heartbeat_missing_sensor(board):
    b, h = board
    del b.i2c_devices[0x57]
    out = run(h, "import tinkerbit\ntinkerbit.FIND_AGAIN_MS = 0\nhb = tinkerbit.Heartbeat()\nprint(hb.bpm())\nprint(hb.bpm())")
    assert out.count("Heartbeat sensor (HW-605) not found - check the I2C cable and 3.3V.") == 1
    assert out.split()[-2:] == ["-1", "-1"]


def _load_max30102():
    spec = importlib.util.spec_from_file_location("tb_max30102", os.path.join(PROTO, "lib", "tinkerbit", "max30102.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class _ReferenceBeat:
    """heartRate.cpp again, written with ctypes integer types instead of masks."""
    FIR = (172, 321, 579, 927, 1360, 1858, 2390, 2916, 3391, 3768, 4012, 4096)

    def __init__(self):
        i16 = ctypes.c_int16
        self.ac_max, self.ac_min = i16(20), i16(-20)
        self.cur, self.prev = i16(0), i16(0)
        self.sig_min, self.sig_max = i16(0), i16(0)
        self.pos = self.neg = 0
        self.reg = ctypes.c_int32(0)
        self.cbuf = [i16(0) for _ in range(32)]
        self.offset = 0

    def check(self, sample):
        beat = False
        self.prev = ctypes.c_int16(self.cur.value)
        x = ctypes.c_uint16(sample).value
        self.reg = ctypes.c_int32(self.reg.value + ((ctypes.c_int32(x << 15).value - self.reg.value) >> 4))
        avg = ctypes.c_int16(self.reg.value >> 15).value
        din = ctypes.c_int16(ctypes.c_int32(sample - avg).value)
        self.cbuf[self.offset] = din
        z = ctypes.c_int32(self.FIR[11] * self.cbuf[(self.offset - 11) & 0x1F].value)
        for i in range(11):
            z = ctypes.c_int32(z.value + self.FIR[i] * self.cbuf[(self.offset - i) & 0x1F].value)
            z = ctypes.c_int32(z.value + self.FIR[i] * self.cbuf[(self.offset - 22 + i) & 0x1F].value)
        self.offset = (self.offset + 1) % 32
        self.cur = ctypes.c_int16(z.value >> 15)
        cur, prev = self.cur.value, self.prev.value
        if prev < 0 and cur >= 0:
            self.ac_max, self.ac_min = ctypes.c_int16(self.sig_max.value), ctypes.c_int16(self.sig_min.value)
            self.pos, self.neg = 1, 0
            self.sig_max = ctypes.c_int16(0)
            if 20 < self.ac_max.value - self.ac_min.value < 1000:
                beat = True
        if prev > 0 and cur <= 0:
            self.pos, self.neg = 0, 1
            self.sig_min = ctypes.c_int16(0)
        if self.pos and cur > prev:
            self.sig_max = ctypes.c_int16(cur)
        if self.neg and cur < prev:
            self.sig_min = ctypes.c_int16(cur)
        return beat


def test_beat_detector_matches_the_c_integer_rules():
    mod = _load_max30102()
    ours, ref = mod.BeatDetector(), _ReferenceBeat()
    beats = 0
    # DC levels across the 16-bit wrap points the C code truncates at, a pulse, and noise.
    for n in range(6000):
        dc = (60000, 65535, 98304, 131072, 250000)[n // 1200]
        s = int(dc + 300 * math.sin(n * 2 * math.pi / 80) + ((n * 7919) % 41) - 20)
        a, r = ours.check(s), ref.check(s)
        assert a == r and ours.cur == ref.cur.value, n
        beats += a
    assert beats > 25


# ---------------- Bluetooth LE ----------------

SERVICE_LE = bytes.fromhex("4fafc2011fb5459e8fccc5c9c331914b")[::-1]


def test_ble_advertises_the_arduino_service_and_name(board):
    b, h = board
    run(h, "import tinkerbit\nble = tinkerbit.Ble('ESP')\nble.advertise('Desk Lamp')")
    adv = b.ble["advertising"]
    assert SERVICE_LE in adv["adv"]
    assert adv["resp"] == bytes((10, 0x09)) + b"Desk Lamp"
    assert b.ble["name"] == b"Desk Lamp"
    assert list(b.ble["values"].values()) == [b"ready"]


def test_ble_same_name_does_not_restart_advertising(board):
    b, h = board
    run(h, "import tinkerbit\nble = tinkerbit.Ble()\nfor _ in range(5):\n    ble.advertise('TinkerBit')")
    assert b.ble["adverts"] == 1
    run(h, "ble.advertise('Other')")
    assert b.ble["adverts"] == 2 and b.ble["name"] == b"Other"


def test_ble_send_keeps_20_bytes_and_notifies_a_phone(board):
    b, h = board
    run(h, "import tinkerbit\nble = tinkerbit.Ble()\nble.advertise('TB')\nble.send('no phone yet')")
    assert b.ble["notified"] == []
    b.ble_connect(1)
    assert b.ble["advertising"] is None
    out = run(h, "print(ble.connected())\nprint(ble.send('Hello from TinkerBit board'))")
    assert out.split()[0] == "True"
    assert b.ble["notified"] == [(1, b"Hello from TinkerBit")]
    b.ble_disconnect(1)
    assert b.ble["advertising"] is not None
    assert run(h, "print(ble.connected())").strip() == "False"


def test_ble_long_name_is_cut_on_a_character_boundary(board):
    b, h = board
    run(h, "import tinkerbit\ntinkerbit.Ble().advertise('Jardin ' + '\u00e9' * 20)")
    name = b.ble["name"]
    assert len(name) <= 29
    name.decode("utf-8")


def test_ble_off_after_stop_all_and_on_again(board):
    b, h = board
    run(h, "import tinkerbit\nble = tinkerbit.Ble()\nble.advertise('TB')\ntinkerbit.stop_all()")
    assert b.ble["active"] is False
    run(h, "ble.advertise('TB')")
    assert b.ble["active"] is True and b.ble["advertising"] is not None


def test_ble_refused_while_cloud_is_on(board):
    b, h = board
    msg = run_err(h, "import tinkerbit\ntinkerbit.radio(True)\ntinkerbit.Ble()")
    assert "Cloud and Bluetooth can't run together" in msg
