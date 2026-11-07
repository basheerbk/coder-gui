# TinkerBit frozen _boot.py (Stage B firmware). Replaces ports/esp32/modules/_boot.py.
# MicroPython runs it before boot.py on every boot, and it cannot be broken from the
# filesystem, so serial safe mode always works.
import gc
import vfs
from flashbdev import bdev

try:
    if bdev:
        vfs.mount(bdev, "/")
except OSError:
    import inisetup

    inisetup.setup()

# A soft reset does not stop FreeRTOS tasks: end the last program's Cloud connection.
import tbcloud

tbcloud.stop()
del tbcloud


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
            # Answer first so the page stops repeating, then swallow the repeats.
            print("TB_SAFE_OK")
            quiet = time.ticks_ms()
            give_up = time.ticks_add(quiet, 1000)
            while time.ticks_diff(time.ticks_ms(), quiet) < 150 and time.ticks_diff(give_up, time.ticks_ms()) > 0:
                if poll.poll(10):
                    sys.stdin.read(1)
                    quiet = time.ticks_ms()
            return True
    return False


if _tb_safe(300):
    import tbsys

    # Switches pyexec to raw-REPL mode: main.c then skips main.py and the host lands
    # directly in the raw REPL.
    tbsys.skip_main()
del _tb_safe
gc.collect()
