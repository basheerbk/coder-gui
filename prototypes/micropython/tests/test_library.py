"""The tinkerbit library running inside the simulator, driven through the raw REPL."""
import json
import os
import re
import time

from conftest import BOARD_MAP, PROTO, gpio, library_files


def run(h, code):
    out, err = h.exec_raw(code)
    assert err == "", err
    return out


def run_err(h, code):
    out, err = h.exec_raw(code)
    assert err, "expected an error, got output %r" % out
    return err.strip().splitlines()[-1]


def test_info_prints_one_tb_info_line(board):
    b, h = board
    out = run(h, "import tinkerbit\ntinkerbit.info()")
    lines = [l for l in out.splitlines() if l]
    assert len(lines) == 1 and lines[0].startswith("TB_INFO ")
    data = json.loads(lines[0][len("TB_INFO "):])
    for key in ("board", "rev", "mcu", "lib", "api", "jacks", "uid", "mpy", "flash_free", "heap_free", "reset", "up_ms"):
        assert key in data, key
    assert data["uid"] == b.uid.hex()
    assert data["mpy"] == "1.24.1"
    assert data["jacks"] == len(BOARD_MAP.JACKS)
    assert data["reset"] == "power_on"


def test_default_main_blinks_reports_and_exits_fast(board):
    b, h = board
    h.install_files({"/main.py": library_files()["/main.py"]})
    t0 = time.monotonic()
    h.soft_reset_run_main()
    out = h.read_until(">>> ").decode()
    assert "TB_INFO " in out
    assert time.monotonic() - t0 < 1.5
    assert (gpio("D13"), 1) in b.pin_log and b.pins[gpio("D13")]["value"] == 0


def test_boot_py_drives_relays_high_without_importing_library(board):
    b, h = board
    h.soft_reset_run_main()
    h.read_until(">>> ")
    for role in ("a1", "a2", "b1", "b2"):
        assert b.pins[gpio("MD", role)]["value"] == 1
    h.enter_raw()
    assert run(h, "import sys\nprint('tinkerbit' in sys.modules)").strip() == "False"


def test_begin_twice_and_relays_high(board):
    b, h = board
    run(h, "import tinkerbit\ntinkerbit.begin()\ntinkerbit.begin()")
    for role in ("a1", "a2", "b1", "b2"):
        assert b.pins[gpio("MD", role)]["value"] == 1


def test_one_object_per_jack(board):
    b, h = board
    assert run(h, "import tinkerbit\nprint(tinkerbit.Led('D13') is tinkerbit.Led('D13'))").strip() == "True"
    assert run(h, "print(tinkerbit.Oled('I2C') is tinkerbit.Oled('I2C1'))").strip() == "True"


def test_two_parts_on_one_jack(board):
    b, h = board
    run(h, "import tinkerbit\ntinkerbit.Led('A2')")
    assert "A2 already has the LED" in run_err(h, "tinkerbit.Button('A2')")


def test_d13_and_3d_conflict(board):
    b, h = board
    run(h, "import tinkerbit\ntinkerbit.Led('D13')")
    msg = run_err(h, "tinkerbit.Rfid('3D')")
    assert "3D and D13 can't be used together" in msg and "TinkerBitError" in msg


def test_digital_part_on_d5(board):
    b, h = board
    msg = run_err(h, "import tinkerbit\ntinkerbit.Led('D5')")
    assert "D5 is only for the distance sensor" in msg


def test_unknown_jack(board):
    b, h = board
    assert "There is no jack called Z9" in run_err(h, "import tinkerbit\ntinkerbit.Led('Z9')")


def test_analog_part_needs_a_jack(board):
    b, h = board
    assert "needs an A jack" in run_err(h, "import tinkerbit\ntinkerbit.Pot('D13')")


def test_a_jack_refused_while_cloud_on(board):
    b, h = board
    msg = run_err(h, "import tinkerbit\ntinkerbit.radio(True)\ntinkerbit.Pot('A1')")
    assert "A ports are off while Cloud/WiFi is on" in msg


def test_a_jack_read_fails_friendly_when_program_starts_wifi(board):
    b, h = board
    run(h, "import tinkerbit\np = tinkerbit.Pot('A1')\nprint(p.read())")
    msg = run_err(h, "import network\nnetwork.WLAN(network.STA_IF).active(True)\np.read()")
    assert "A ports are off while Cloud/WiFi is on" in msg


def test_pot_average_and_soil_percent(board):
    b, h = board
    b.analog[gpio("A1")] = 1000
    b.analog[gpio("A2")] = 2200
    out = run(h, "import tinkerbit\nprint(tinkerbit.Pot('A1').read(), tinkerbit.Soil('A2').percent())")
    assert out.split() == ["1000", "50"]
    b.analog[gpio("A2")] = 0
    assert run(h, "print(tinkerbit.Soil('A2').percent())").strip() == "-1"


def test_on_off_sensors_follow_their_active_level(board):
    b, h = board
    run(h, "import tinkerbit\nir = tinkerbit.Obstacle('D13')\npir = tinkerbit.Pir('A1')")
    b.inputs[gpio("D13")] = 0
    b.inputs[gpio("A1")] = 0
    assert run(h, "print(ir.detected(), pir.detected())").split() == ["True", "False"]
    b.inputs[gpio("D13")] = 1
    b.inputs[gpio("A1")] = 1
    assert run(h, "print(ir.detected(), pir.detected())").split() == ["False", "True"]
    assert b.pins[gpio("D13")]["mode"] == "in"


def test_soil_percent_from_one_reading(board):
    b, h = board
    out = run(h, "import tinkerbit\ns = tinkerbit.Soil('A2')\nprint(s.percent_from(2200), s.percent_from(10), s.percent_from(4000))")
    assert out.split() == ["50", "-1", "0"]


def test_oled_show_clears_and_wraps(board):
    b, h = board
    run(h, "import tinkerbit\no = tinkerbit.Oled()\no.text('old', 3)\no.show('0123456789abcdefWRAP')")
    assert b.screen == [("0123456789abcdef", 0, 0), ("WRAP", 0, 8)]


def test_motion_read_is_one_measurement(board):
    b, h = board
    b.i2c_devices[0x68].accel = (16384, 0, 0)
    assert run(h, "import tinkerbit\nprint(tinkerbit.Motion().read())").strip() == "(90, 0)"


def test_ultrasonic_cm_and_invalid(board):
    b, h = board
    assert run(h, "import tinkerbit\nu = tinkerbit.Ultrasonic()\nprint(u.cm())").strip() == "20"
    b.echo_us = None
    assert run(h, "print(u.cm())").strip() == "-1"
    assert b.pins[gpio("D5", "echo")]["mode"] == "in"


def test_dht11(board):
    b, h = board
    assert run(h, "import tinkerbit\nd = tinkerbit.DHT11('A1')\nprint(d.temperature(), d.humidity())").split() == ["24", "55"]
    b.dht_default = None
    out = run(h, "d2 = tinkerbit.DHT11('A3')\nprint(d2.temperature())")
    assert out.strip().endswith("-1") and "DHT11 not answering" in out


def test_oled_text(board):
    b, h = board
    run(h, "import tinkerbit\no = tinkerbit.Oled()\no.text('Hello', 0)\no.number(42, 1)")
    assert b.screen == [("Hello", 0, 0), ("42", 0, 8)]
    assert b.i2c_freq == BOARD_MAP.I2C_FREQ


def test_oled_missing_is_friendly(board):
    b, h = board
    del b.i2c_devices[0x3C]
    assert "OLED screen not found" in run_err(h, "import tinkerbit\ntinkerbit.Oled().text('x')")


def test_motion_flat_tilted_and_missing(board):
    b, h = board
    assert run(h, "import tinkerbit\nm = tinkerbit.Motion()\nprint(m.tilt(), m.shake())").split() == ["0", "0"]
    b.i2c_devices[0x68].accel = (16384, 0, 0)
    assert run(h, "print(m.tilt())").strip() == "90"
    b.i2c_devices[0x68].accel = (0, 0, 16384)
    b.i2c_devices[0x68].gyro = (131 * 250, 0, 0)
    assert int(run(h, "print(m.shake())")) == 50
    del b.i2c_devices[0x68]
    out = run(h, "m2 = tinkerbit.Motion('I2C1')\nprint(m2 is m)\nm._ready = False\nm._retry_at = None\nprint(m.shake())")
    assert "MPU6050 not found" in out and out.strip().endswith("-1")


def test_led_brightness_and_stop_all(board):
    b, h = board
    run(h, "import tinkerbit\nl = tinkerbit.Led('D13')\nl.brightness(128)\nbz = tinkerbit.Buzzer('A3')\nbz.on()")
    assert b.pwm[gpio("D13")].duty_u16() == 128 * 257
    run(h, "tinkerbit.stop_all()")
    assert gpio("D13") not in b.pwm
    assert b.pins[gpio("D13")]["value"] == 0 and b.pins[gpio("A3")]["value"] == 0
    for role in ("a1", "a2", "b1", "b2"):
        assert b.pins[gpio("MD", role)]["value"] == 1


def test_motion_parts_and_stop_all(board):
    b, h = board
    run(h, "import tinkerbit\n"
           "sv = tinkerbit.Servo('D13')\n"
           "m = tinkerbit.Motors('MD')\n"
           "m.speed('A', 200)\n"
           "m.speed('B', 100, forward=False)\n"
           "bz = tinkerbit.Buzzer('A3')\n"
           "bz.tone(440)\n"
           "st = tinkerbit.Stepper('ST')\n")
    # Servo starts at 90 degrees, like the Arduino sketch: 1450 us of a 20 ms period.
    assert abs(b.pwm[gpio("D13")].duty_ns() - 1450000) < 1000
    assert run(h, "print(sv.angle(180))").strip() == "180"
    assert abs(b.pwm[gpio("D13")].duty_ns() - 2400000) < 1000
    assert b.pwm[gpio("MD", "a1")].duty_u16() == 200 * 257 and b.pwm[gpio("MD", "a2")].duty_u16() == 0
    assert b.pwm[gpio("MD", "b1")].duty_u16() == 0 and b.pwm[gpio("MD", "b2")].duty_u16() == 100 * 257
    assert b.pwm[gpio("A3")].freq() == 440
    run(h, "st.move(8, 60)")
    assert all(b.pins[gpio("ST", r)]["value"] == 0 for r in ("in1", "in2", "in3", "in4"))
    # Stop: no PWM left anywhere, motor inputs braked HIGH, buzzer LOW.
    run(h, "tinkerbit.stop_all()")
    assert b.pwm == {}
    for role in ("a1", "a2", "b1", "b2"):
        assert b.pins[gpio("MD", role)]["value"] == 1
    assert b.pins[gpio("A3")]["value"] == 0


def test_relay4_is_active_low(board):
    b, h = board
    run(h, "import tinkerbit\nr = tinkerbit.Relay4()\nr.channel(2, True)")
    assert b.pins[gpio("MD", "a2")]["value"] == 0 and b.pins[gpio("MD", "a1")]["value"] == 1
    run(h, "r.all(True)")
    assert all(b.pins[gpio("MD", r)]["value"] == 0 for r in ("a1", "a2", "b1", "b2"))
    run(h, "tinkerbit.stop_all()")
    assert all(b.pins[gpio("MD", r)]["value"] == 1 for r in ("a1", "a2", "b1", "b2"))
    assert "MD already has the 4-channel relay" in run_err(h, "tinkerbit.Motors('MD')")


def test_pwm_timers_run_out_like_the_esp32(board):
    b, h = board
    pins = [gpio(j) for j in ("A1", "A2", "A3", "D13")] + [gpio("MD", r) for r in ("a1", "a2", "b1", "b2")]
    pins.append(gpio("I2C", "sda"))
    msg = run_err(h, "import machine\n"
                     "ps = [machine.PWM(machine.Pin(p), freq=100 + i) for i, p in enumerate(%r)]" % (pins,))
    assert "out of PWM timers" in msg


def test_pump_lock_buzzer_stay_off_from_boot(board):
    b, h = board
    h.install_files({"/main.py": (
        "import tinkerbit, time\n"
        "p = tinkerbit.Pump('A2')\n"
        "lk = tinkerbit.Lock('D13')\n"
        "p.on()\n"
        "time.sleep_ms(300)\n"
        "print('pump on')\n"
    )})
    h.soft_reset_run_main()
    h.read_until("pump on")
    h.read_until(">>> ")
    assert json.loads(b.read_file("/tb_boot.json")) == {"off": ["A2", "D13"]}
    # Next boot: boot.py drives both LOW before main.py runs, then main.py turns the pump on.
    b.pin_log.clear()
    h.soft_reset_run_main()
    h.read_until(">>> ")
    first = [entry for entry in b.pin_log if entry[0] in (gpio("A2"), gpio("D13"))][:2]
    assert sorted(first) == sorted([(gpio("A2"), 0), (gpio("D13"), 0)])
    # A program without them drops them from the list once it records its own part.
    h.enter_raw()
    h.install_files({"/main.py": "import tinkerbit\ntinkerbit.Buzzer('A3')\n"})
    h.exit_raw()
    h.soft_reset_run_main()
    h.read_until(">>> ")
    assert json.loads(b.read_file("/tb_boot.json")) == {"off": ["A3"]}


def test_button_pull_up(board):
    b, h = board
    assert run(h, "import tinkerbit\nbt = tinkerbit.Button('A2')\nprint(bt.pressed())").strip() == "False"
    b.inputs[gpio("A2")] = 0
    assert run(h, "print(bt.pressed())").strip() == "True"


def test_a4_boot_pin_note(board):
    b, h = board
    assert "A4 is the BOOT pin" in run(h, "import tinkerbit\ntinkerbit.Button('A4')")


def test_hc05_upload_only_at_9600(board):
    b, h = board
    h.install_files({"/main.py": (
        "import tinkerbit, time\n"
        "bt = tinkerbit.HC05()\n"
        "bt.send('ready')\n"
        "while True:\n"
        "    line = bt.read_line()\n"
        "    if line is not None:\n"
        "        bt.send('echo:' + line)\n"
        "    time.sleep_ms(10)\n"
    )})
    h.soft_reset_run_main()
    b.set_host_baud(9600)
    h.read_until("ready\r\n")
    h.write(b"hi\x03there\n")
    assert "echo:hi\x03there" in h.read_until("there\r\n").decode()
    # Ctrl-C is just data now: Stop needs a hard reset, then safe mode, then 115200.
    h.write(b"\x03\x03")
    time.sleep(0.2)
    assert ">>>" not in h.text()
    b.set_host_baud(115200)
    for _ in range(10):
        assert h.recover()
        h.read_until(">>> ")
    assert b.uart_baud == 115200


def test_no_bare_except_and_gpio_only_in_board_py():
    lib = os.path.join(PROTO, "lib", "tinkerbit")
    sources = {}
    for root in (lib, PROTO):
        for name in os.listdir(root):
            if name.endswith(".py"):
                with open(os.path.join(root, name), encoding="utf-8") as f:
                    sources[os.path.join(root, name)] = f.read()
    for path, src in sources.items():
        assert not re.search(r"except\s*:", src), path
        if not path.endswith("board.py"):
            assert not re.search(r"Pin\(\s*\d", src), path
