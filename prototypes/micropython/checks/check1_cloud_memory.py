# Check 1: memory with Cloud on a WROOM-32 without PSRAM (Stage B firmware).
# Put /config.json on the board (see README), Upload this file as main.py and log the
# serial output for 24 h. Every TB_MEM / TB_CLOUD line is one JSON record.
# A crash shows up as a new "boot" record with a reset cause other than power_on.
import gc
import json
import time

import esp32
import network

import tinkerbit
from tinkerbit import cloud

SEND_EVERY_S = 5
REPORT_EVERY = 60  # sends between memory records (5 min)


def mem(tag, **extra):
    gc.collect()
    heap = esp32.idf_heap_info(esp32.HEAP_DATA)
    rec = {
        "tag": tag,
        "t_s": time.ticks_ms() // 1000,
        "gc_free": gc.mem_free(),
        "idf_free": sum(h[1] for h in heap),
        "idf_largest": max(h[2] for h in heap),
        "idf_min_ever": min(h[3] for h in heap),
    }
    rec.update(extra)
    print("TB_MEM " + json.dumps(rec))


def wait(cond, seconds):
    end = time.ticks_add(time.ticks_ms(), seconds * 1000)
    while not cond():
        if time.ticks_diff(end, time.ticks_ms()) <= 0:
            return False
        time.sleep_ms(200)
    return True


tinkerbit.info()
mem("boot")
cloud.begin()
sta = network.WLAN(network.STA_IF)
mem("wifi", ok=wait(sta.isconnected, 30))
mem("mqtt", ok=wait(cloud.connected, 60))

sent = 0
failed = 0
while True:
    if cloud.send({"n": sent, "gc": gc.mem_free()}):
        sent += 1
    else:
        failed += 1
    if (sent + failed) % REPORT_EVERY == 0:
        mem("run", sent=sent, failed=failed)
        print("TB_CLOUD " + json.dumps(cloud.status()))
    time.sleep(SEND_EVERY_S)
