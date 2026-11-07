# Check 2: microphone sampling on A1 (ADC2) with WiFi off. Run it from the test page.
# Prints TB_MIC JSON lines: pure-Python rates (both firmware stages) and the C sampler
# (Stage B). Pass = C sampler >= 8000 Hz with max jitter under 10 %.
import array
import json
import time

import machine

from tinkerbit import board

RATE = 8000
SECONDS = 0.5
N = int(RATE * SECONDS)

# MicroPython starts the ESP32 at 160 MHz; the check runs at the chip's full speed.
machine.freq(240000000)
adc = machine.ADC(machine.Pin(board.pin("A1")), atten=machine.ADC.ATTN_11DB)
buf = array.array("h", bytes(2 * N))
read = adc.read_u16


def report(kind, **values):
    values["kind"] = kind
    values["cpu_mhz"] = machine.freq() // 1000000
    values["min"] = min(buf)
    values["max"] = max(buf)
    print("TB_MIC " + json.dumps(values))


# 1. Pure Python, as fast as it goes.
t0 = time.ticks_us()
for i in range(N):
    buf[i] = read() >> 4
dt = max(1, time.ticks_diff(time.ticks_us(), t0))
report("python_free_running", rate_hz=N * 1000000 // dt)

# 2. Pure Python, paced at RATE.
period = 1000000 // RATE
nxt = time.ticks_us()
prev = None
max_dev = 0
total_dev = 0
late = 0
for i in range(N):
    while time.ticks_diff(nxt, time.ticks_us()) > 0:
        pass
    t = time.ticks_us()
    buf[i] = read() >> 4
    if prev is not None:
        dev = abs(time.ticks_diff(t, prev) - period)
        total_dev += dev
        if dev > max_dev:
            max_dev = dev
    prev = t
    nxt = time.ticks_add(nxt, period)
    if time.ticks_diff(t, nxt) >= 0:
        late += 1
        nxt = time.ticks_add(t, period)
report("python_paced", target_hz=RATE, max_jitter_pct=max_dev * 100 / period,
       mean_jitter_pct=total_dev * 100 / period / (N - 1), overruns=late)

# 3. C sampler (Stage B firmware only).
try:
    import tbsys
except ImportError:
    print('TB_MIC {"kind": "c_sampler", "error": "needs TinkerBit firmware (Stage B)"}')
else:
    rate, jmax, jmean, over = tbsys.sample(adc, buf, RATE)
    report("c_sampler", target_hz=RATE, rate_hz=rate, max_jitter_pct=jmax, mean_jitter_pct=jmean, overruns=over,
           result="PASS" if rate >= RATE * 0.99 and jmax < 10 else "FAIL")
