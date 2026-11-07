# TinkerBit boot.py.
# 1. Relays off (active-low outputs driven HIGH) and the last program's pumps, locks and
#    buzzers LOW, as early as possible. Only board.py is read here: importing the whole
#    library would mean compiling it on every boot.
# 2. Serial safe mode (Stage A, stock MicroPython): if "TB_SAFE\n" arrives within SAFE_MS,
#    skip main.py. MicroPython only runs main.py when boot.py finishes without an
#    exception, so raising here is how main.py gets skipped. Stage B firmware does this in
#    frozen _boot.py instead.
SAFE_MS = 300


def _tb_relays_off():
    from machine import Pin

    ns = {}
    try:
        with open("/lib/tinkerbit/board.py") as f:
            exec(f.read(), ns)
        jacks, safe_high = ns["JACKS"], ns["SAFE_HIGH"]
    except OSError:
        from tinkerbit import board  # frozen in Stage B firmware

        jacks, safe_high = board.JACKS, board.SAFE_HIGH
    for name in safe_high:
        for gpio in jacks[name]["pins"].values():
            Pin(gpio, Pin.OUT, value=1)
    # Pumps, locks and buzzers the last program used (the library writes this file).
    try:
        import json

        with open("/tb_boot.json") as f:
            keep_off = json.load(f).get("off", [])
    except (OSError, ValueError):
        keep_off = []
    for name in keep_off:
        spec = jacks.get(name)
        if spec and spec["kind"] == "io":
            Pin(spec["pins"]["sig"], Pin.OUT, value=0)


def _tb_safe(window_ms):
    import select
    import sys
    import time

    poll = select.poll()
    poll.register(sys.stdin, select.POLLIN)
    end = time.ticks_add(time.ticks_ms(), window_ms)
    seen = ""
    while time.ticks_diff(end, time.ticks_ms()) > 0:
        if not poll.poll(10):
            continue
        seen = (seen + sys.stdin.read(1))[-16:]
        if "TB_SAFE\n" in seen:
            # The page keeps sending TB_SAFE until it sees TB_SAFE_OK: answer first, then
            # swallow the repeats so they do not reach the REPL as typed text.
            print("TB_SAFE_OK")
            quiet = time.ticks_ms()
            give_up = time.ticks_add(quiet, 1000)
            while time.ticks_diff(time.ticks_ms(), quiet) < 150 and time.ticks_diff(give_up, time.ticks_ms()) > 0:
                if poll.poll(10):
                    sys.stdin.read(1)
                    quiet = time.ticks_ms()
            return True
    return False


try:
    _tb_relays_off()
except Exception as e:
    print("TB_BOOT relays:", e)

try:
    # TinkerBit firmware (Stage B): frozen _boot.py already listened for TB_SAFE.
    import tbsys

    _tb_check = False
except ImportError:
    _tb_check = True

if _tb_check and _tb_safe(SAFE_MS):
    raise Exception("TB_SAFE: main.py skipped")
del _tb_relays_off, _tb_safe, _tb_check
