# TinkerBit Cloud (Stage B firmware): WiFi from Python, MQTT over TLS in the tbcloud C module.
# Same topics, telemetry, dashboard controls, alerts and printed checklist lines as the
# Arduino Cloud firmware. Settings and secrets come from /config.json on the board, never
# from main.py, and are never printed. See README.md for the file format.
import json

import tinkerbit

CONFIG = "/config.json"
FW = "mpy-1"
INTERVAL_S = 10
MIN_INTERVAL_S = 5

# Let's Encrypt roots (ISRG Root X1 and X2), same as Beginner Studio's cloudCerts.js.
ISRG_ROOTS = """-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw
CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg
R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00
MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT
ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw
EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW
+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9
ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T
AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI
zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW
tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1
/q4AaOeMSQ+2b1tbFfLn
-----END CERTIFICATE-----
"""

STATES = ("stopped", "waiting for WiFi", "connecting", "connected")

_started = False
_wlan = None


def _config():
    try:
        with open(CONFIG) as f:
            cfg = json.load(f)
    except OSError:
        raise tinkerbit.TinkerBitError("Cloud settings missing: put config.json on the board (see README).")
    except ValueError:
        raise tinkerbit.TinkerBitError("config.json is not valid JSON.")
    for key in ("wifi_ssid", "host", "device_id"):
        if not cfg.get(key):
            raise tinkerbit.TinkerBitError("config.json needs '%s'." % key)
    return cfg


def _ca(cfg):
    path = cfg.get("ca_file")
    if not path:
        return ISRG_ROOTS
    with open(path) as f:
        return f.read()


def _seconds(value, default, low):
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(low, min(3600, n))


def begin(ssid=None, pw=None, host=None, device_id=None, token=None):
    """Start WiFi and the cloud connection. Missing arguments come from /config.json."""
    global _started, _wlan
    try:
        import tbcloud
    except ImportError:
        raise tinkerbit.TinkerBitError("Cloud needs TinkerBit firmware (Stage B).")
    if tinkerbit._ble:
        raise tinkerbit.TinkerBitError("Cloud and Bluetooth can't run together. Turn Bluetooth off first.")
    for part in tinkerbit._parts.values():
        spec = tinkerbit.board.jack(part.jack) or {}
        if spec.get("adc2"):
            raise tinkerbit.TinkerBitError("A ports are off while Cloud/WiFi is on. Move the {} from {} to D13.".format(part.NAME, part.jack))
    cfg = _config() if None in (ssid, host, device_id) else {}
    ssid = ssid or cfg["wifi_ssid"]
    pw = pw if pw is not None else cfg.get("wifi_password", "")
    host = host or cfg["host"]
    device_id = device_id or cfg["device_id"]
    token = token if token is not None else cfg.get("token", "")
    min_gap = _seconds(cfg.get("min_interval_sec"), MIN_INTERVAL_S, 1)
    interval = _seconds(cfg.get("interval_sec"), INTERVAL_S, min_gap)

    import network

    print('Cloud: joining WiFi "%s"' % ssid)
    tinkerbit.radio(True)
    _wlan = network.WLAN(network.STA_IF)
    _wlan.active(True)
    try:
        # Modem sleep delays incoming packets and can miss broker pings.
        _wlan.config(pm=_wlan.PM_NONE)
    except Exception:
        pass
    # Started before connect() so the WiFi events (wrong password, name not found) are seen.
    tbcloud.start(
        host,
        int(cfg.get("port", 8883)),
        int(cfg.get("ws_port", 443)),
        device_id,
        token,
        _ca(cfg),
        ws_path=cfg.get("ws_path", "/mqtt"),
        interval_ms=interval * 1000,
        min_gap_ms=min_gap * 1000,
        fw=FW,
    )
    _started = True
    if pw:
        _wlan.connect(ssid, pw)
    else:
        _wlan.connect(ssid)


def _cloud():
    if not _started:
        raise tinkerbit.TinkerBitError("Call cloud.begin() first.")
    import tbcloud

    return tbcloud


def set(name, value):
    """Report a reading on the dashboard (number or True/False; None stops reporting it).
    The board sends every reading on its interval, even while the program waits."""
    return _cloud().set(name, value)


def send(values=None):
    """Set several readings and send them as soon as the minimum gap allows.
    Returns False while not connected (the values still go out once it connects)."""
    c = _cloud()
    for name, value in (values or {}).items():
        c.set(name, value)
    c.send_now()
    return connected()


def alert(text):
    """Send a notification: at most one every 10 s, kept until the board is online."""
    text = str(text)
    result = _cloud().alert(text)
    if result == 0:
        print('Cloud: alert "%s"%s' % (text, "" if connected() else " (sends when connected)"))
    elif result == 1:
        print("Cloud: alert skipped (at most one every 10 s)")
    return result == 0


def switch(n=1):
    """Dashboard switch 1 to 4: 1 on, 0 off."""
    return _cloud().get("switch%d" % n)


def slider(n=1):
    """Dashboard slider 1 or 2: 0 to 100."""
    return _cloud().get("slider%d" % n)


def connected():
    import tbcloud

    return tbcloud.status()[0] == 3


def status():
    import tbcloud

    st = tbcloud.status()
    return {
        "state": STATES[st[0]] if 0 <= st[0] < len(STATES) else st[0],
        "reconnects": st[1],
        "transport": st[2],
        "last_error": st[3],
        "wifi_restarts": st[4],
        "fresh_starts": st[5],
        "sent": st[6],
        "wifi": bool(_wlan and _wlan.isconnected()),
    }


def end():
    global _started
    import tbcloud

    tbcloud.stop()
    _started = False
    if _wlan is not None:
        _wlan.active(False)
    tinkerbit.radio(False)
