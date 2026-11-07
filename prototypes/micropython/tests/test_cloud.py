"""tinkerbit.cloud wrapper against the simulated tbcloud module (Stage B)."""
import json

from conftest import gpio, read

CONFIG = {
    "wifi_ssid": "test-ssid",
    "wifi_password": "not-a-real-password",
    "host": "test.mosquitto.org",
    "port": 8886,
    "ws_port": 8081,
    "device_id": "proto-001",
    "token": "not-a-real-token",
}
BEGIN = "from tinkerbit import cloud\ncloud.begin()\nprint(cloud.connected())\n"


def stage_b(make_board, config=True):
    b, h = make_board(firmware="stage_b")
    h.read_until(">>> ")
    h.enter_raw()
    if config:
        h.install_files({"/config.json": json.dumps(CONFIG)})
    return b, h


def online(make_board):
    b, h = stage_b(make_board)
    out, err = h.exec_raw(BEGIN)
    assert err == "" and out.splitlines()[-1] == "True"
    return b, h, out


def sent(b, suffix):
    return [p for t, p in b.cloud_sent if t == "tb/proto-001/" + suffix]


def test_cloud_begin_prints_the_checklist_lines(make_board):
    b, h, out = online(make_board)
    lines = out.splitlines()
    assert lines[:5] == [
        'Cloud: joining WiFi "test-ssid"',
        "Cloud: WiFi connected (RSSI -55)",
        "Cloud: connecting to mqtts://test.mosquitto.org:8886",
        "Cloud: connected (port 8886)",
        "True",
    ]
    assert b.cloud["port"] == 8886 and b.cloud["ws_port"] == 8081 and b.cloud["has_token"]
    assert b.cloud["subscribed"] == "tb/proto-001/state/#"
    status = json.loads(b.cloud["retained"]["status"])
    assert status["s"] == "online" and status["fw"] == "mpy-1" and status["tr"] == "mqtts"
    # Secrets never reach the serial log.
    log = h.log.decode("utf-8", "replace")
    assert "not-a-real-password" not in log and "not-a-real-token" not in log


def test_cloud_heartbeat_then_readings_in_the_service_format(make_board):
    b, h, out = online(make_board)
    boot = b.cloud["boot"]
    assert sent(b, "telemetry") == ['{"seq":1,"boot":"%s","v":{}}' % boot]
    out, err = h.exec_raw("print(cloud.send({'temp': 21.456, 'moving': True, 'count': 3}))")
    assert err == "" and out.strip() == "True"
    # Within the 5 s minimum gap: waits.
    assert len(sent(b, "telemetry")) == 1
    b.cloud_skew_ms += 5000
    h.exec_raw("cloud.status()")
    assert sent(b, "telemetry")[-1] == '{"seq":2,"boot":"%s","v":{"temp":21.46,"moving":1,"count":3}}' % boot
    # set() alone waits for the interval; None stops reporting; NaN is skipped.
    h.exec_raw("cloud.set('count', None)\ncloud.set('temp', float('nan'))")
    b.cloud_skew_ms += 10000
    h.exec_raw("cloud.status()")
    assert sent(b, "telemetry")[-1] == '{"seq":3,"boot":"%s","v":{"moving":1}}' % boot


def test_cloud_reading_names_and_limit(make_board):
    b, h, out = online(make_board)
    out, err = h.exec_raw("cloud.set('bad name', 1)")
    assert "reading names use letters, digits and _" in err
    out, err = h.exec_raw("print([cloud.set('r%d' % i, i) for i in range(25)][-2:])")
    assert out.strip() == "[True, False]"


def test_dashboard_controls_ack_and_failsafe(make_board):
    b, h, out = online(make_board)
    b.cloud_message("switch1", '{"v":1,"ver":7}')
    b.cloud_message("slider2", '{"v":150,"ver":8,"fs":2,"fv":30}')
    out, err = h.exec_raw("print(cloud.switch(1), cloud.slider(2), cloud.switch(3))")
    assert err == ""
    assert out.splitlines() == ["Cloud: switch1 = 1", "Cloud: slider2 = 100", "1 100 0"]
    assert sent(b, "ack") == ['{"key":"switch1","ver":7}', '{"key":"slider2","ver":8}']
    # Broker gone: slider2 falls back after its 2 s, switch1 after the default 120 s.
    b.cloud_broker_down = True
    h.exec_raw("cloud.status()")
    b.cloud_skew_ms += 2000
    out, err = h.exec_raw("print(cloud.switch(1), cloud.slider(2))")
    assert out.splitlines() == ["Cloud: offline 2s - slider2 set to safe value 30", "1 30"]
    b.cloud_skew_ms += 118000
    out, err = h.exec_raw("print(cloud.switch(1))")
    lines = out.splitlines()
    assert lines[0] == "Cloud: offline 120s - switch1 set to safe value 0" and lines[-1] == "0"
    assert len(lines) == 6  # every control still on the default 120 s, like the Arduino firmware


def test_disconnect_and_reconnect_lines(make_board):
    b, h, out = online(make_board)
    b.cloud_broker_down = True
    out, err = h.exec_raw("print(cloud.connected())")
    assert out.splitlines() == ["Cloud: disconnected - retrying", "False"]
    b.cloud_broker_down = False
    out, err = h.exec_raw("print(cloud.connected(), cloud.status()['reconnects'])")
    assert out.splitlines() == ["Cloud: connected (port 8886)", "True 1"]


def test_alerts_rate_limited_and_queued_offline(make_board):
    b, h, out = online(make_board)
    out, err = h.exec_raw("print(cloud.alert('Too hot'))\nprint(cloud.alert('Still hot'))\nprint(cloud.alert('Again'))")
    assert out.splitlines() == ['Cloud: alert "Too hot"', "True", "Cloud: alert skipped (at most one every 10 s)", "False", "False"]
    h.exec_raw("cloud.status()")
    assert sent(b, "alert") == ["Too hot"]
    b.cloud_broker_down = True
    b.cloud_skew_ms += 10000
    out, err = h.exec_raw("print(cloud.alert('x' * 600))")
    assert out.splitlines()[-1] == "True"
    assert '(sends when connected)' in out
    b.cloud_broker_down = False
    h.exec_raw("cloud.status()")
    assert sent(b, "alert")[-1] == "x" * 483


def test_stop_all_ends_the_cloud(make_board):
    b, h, out = online(make_board)
    out, err = h.exec_raw("import tinkerbit\ntinkerbit.stop_all()\nprint(cloud.connected())")
    assert err == "" and out.strip() == "False"
    assert b.cloud == {} and not b.wifi_on
    assert b.cloud_sent[-1] == ("tb/proto-001/status", "offline")


def test_cloud_before_begin(make_board):
    b, h = stage_b(make_board)
    out, err = h.exec_raw("from tinkerbit import cloud\ncloud.switch(1)")
    assert "Call cloud.begin() first." in err


def test_cloud_locks_a_jacks(make_board):
    b, h = stage_b(make_board)
    out, err = h.exec_raw("import tinkerbit\nfrom tinkerbit import cloud\ncloud.begin()\ntinkerbit.Pot('A1')")
    assert "A ports are off while Cloud/WiFi is on" in err


def test_cloud_refuses_when_a_jack_in_use(make_board):
    b, h = stage_b(make_board)
    out, err = h.exec_raw("import tinkerbit\nfrom tinkerbit import cloud\ntinkerbit.Pot('A2')\ncloud.begin()")
    assert "Move the potentiometer from A2 to D13" in err
    assert not b.wifi_on


def test_cloud_and_bluetooth_never_together(make_board):
    b, h = stage_b(make_board)
    out, err = h.exec_raw("import tinkerbit\nfrom tinkerbit import cloud\ncloud.begin()\ntinkerbit.bluetooth(True)")
    assert "Cloud and Bluetooth can't run together" in err


def test_cloud_missing_config(make_board):
    b, h = stage_b(make_board, config=False)
    out, err = h.exec_raw("from tinkerbit import cloud\ncloud.begin()")
    assert "Cloud settings missing" in err


def test_cloud_needs_stage_b(board):
    b, h = board
    h.install_files({"/lib/tinkerbit/cloud.py": read("lib/tinkerbit/cloud.py")})
    out, err = h.exec_raw("from tinkerbit import cloud\ncloud.begin()")
    assert "Cloud needs TinkerBit firmware (Stage B)" in err


def test_c_sampler_shape(make_board):
    b, h = stage_b(make_board, config=False)
    b.analog[gpio("A1")] = 1234
    out, err = h.exec_raw(
        "import array, machine, tbsys\nfrom tinkerbit import board\n"
        "adc = machine.ADC(machine.Pin(board.pin('A1')), atten=machine.ADC.ATTN_11DB)\n"
        "buf = array.array('h', bytes(200))\nr = tbsys.sample(adc, buf, 8000)\nprint(len(r), r[0], buf[0], buf[99])"
    )
    assert err == ""
    assert out.split() == ["4", "8000", "1234", "1234"]
