# Results: MicroPython prototype on the TinkerBit kit

Status: **simulation done; first hardware runs on a CH340 board from a Python host
(see "Hardware runs so far").** The per-check tables below are still empty: they are for
the runs through the test page in Chrome. Fill in one row per board (CP210x and
CH340/CH9102) and write the firmware stage on every row.

## Hardware runs so far

Board: CH340 (`1a86:7523`) on COM19, ESP32-D0WD-V3 rev 3.1, 4 MB flash (3.3 V), no
PSRAM. It came with an Arduino sketch (printing `LED: OFF` at 9600), which was erased.
Firmware: Stage A, stock `ESP32_GENERIC-20241129-v1.24.1.bin` (SHA-256 `21d61b52...f048`),
library copied with mpremote. Host: Windows, Python 3.11 + pyserial 3.5 driving the
same protocol code as the simulator tests (`sim/host.py`), **not** Chrome Web Serial.
Measured 2026-11-06.

| What | Result |
|---|---|
| Opening the port with DTR/RTS held low (pyserial) | no reset (no ROM banner, `up_ms` kept counting) |
| Opening the port with mpremote | reset the board (ROM banner) |
| EN reset reported as | `rst:0x1 (POWERON_RESET)`, as expected on the classic ESP32 |
| Idle Python heap after boot | 164,688 bytes free at 160 MHz |
| `import tinkerbit` from source (Stage A) | 498 ms, peak 23.7 KB, 17.6 KB kept |
| `TB_INFO` | one correct line (`fw: stock`, 13 jacks, uid `28562f4a41f4`) |
| Soft reset to default `main.py` done (`TB_INFO`) | 1,403 ms after Ctrl-D (includes the 300 ms safe-mode window) |
| Hard reset (EN) to default `main.py` done | 2,047 ms (ROM at 7 ms, app entry at 34 ms) |
| Hard reset to `TB_SAFE_OK` | 811 ms (5/5), 1,214 ms (10/10) in a second series |
| Safe mode on a stuck `while True: pass`, 2500 ms burst | **10/10** |
| Safe mode, spec's 500 ms burst | **0/10**: the board starts listening after the burst ends |

Upload speed (check 5 logic, same commands as `index.html`, 2048 data bytes per command):

| File | Transfer | Encoding | Wire bytes | ms | Target | Result |
|---|---|---|---|---|---|---|
| 3 KB | raw-paste | hex | 6,406 | 1,219 | < 1500 | PASS |
| 3 KB | raw-paste | base64 | 4,383 | 979 | < 1500 | PASS |
| 3 KB | chunked 256 B / 8 ms | hex | 6,406 | 910 | < 1500 | PASS |
| 3 KB | chunked 256 B / 8 ms | base64 | 4,383 | 785 | < 1500 | PASS |
| 25 KB | raw-paste | hex | 52,144 | 8,668 | < 5000 | FAIL |
| 25 KB | raw-paste | base64 | 34,985 | 6,122 | < 5000 | FAIL |
| 25 KB | chunked 256 B / 8 ms | hex | 52,144 | 5,691 to 6,255 | < 5000 | FAIL |
| 25 KB | chunked 256 B / 8 ms | base64 | 34,985 | 3,862 to 5,005 | < 5000 | PASS (one run at 5,005) |
| 25 KB | chunked, no pause | hex | 52,144 | 5,028 to 5,066 | < 5000 | FAIL |
| 25 KB | chunked, no pause | base64 | 34,985 | 3,483 to 3,521 | < 5000 | **PASS** |

Every no-pause run (256, 512 and 1024-byte writes, 3 runs each) was checked with
SHA-256 on the board: 24/24 correct. The first raw-paste run, with a host reader that
waited up to 10 ms per read, was slower still (25 KB hex 15.0 s), which shows how
sensitive raw-paste is to read latency.

What this means:

- **Raw-paste is the slowest option on CH340.** Its 128-byte flow-control window needs a
  credit byte back from the board; one window took about 21 ms against 11 ms of wire
  time, so the USB round trip, not the baud rate, sets the speed.
- **Hex cannot pass 25 KB in 5 s at 115200**, even with no pauses: 52 KB on the wire is
  4.5 s before any command overhead.
- **Base64 over the plain raw REPL with no pause passes** (about 3.5 s) and kept every
  byte. This is the combination to use, which changes two spec choices (hex chunks and
  preferring raw-paste). Still to confirm in Chrome and on CP210x.

Retest after the gap fixes (same board and host, 2026-11-07). Library installed with the
page's new default transfer (base64, plain raw REPL, no pause). Pin states were read from
the ESP32 GPIO matrix and LEDC registers, not from the library.

| What | Result |
|---|---|
| Install `__init__.py` (21.7 KB), `cloud.py` (8.1 KB), `boot.py` (2.8 KB) | 3,448 / 1,441 / 769 ms, SHA-256 correct on all three |
| 3 KB upload, default transfer, 3 runs | 526 to 1,234 ms, **PASS**, SHA-256 correct |
| 25 KB upload, default transfer, 3 runs | 3,694 to 3,789 ms, **PASS**, SHA-256 correct |
| Run with a servo (D13) and a 440 Hz tone (A3), then Ctrl-C only | both PWM channels **still running** (the risk is real) |
| Same, then `stop_all()` as the page now does | tone pin driven LOW; servo channel stopped, idle LOW (arm limp) |
| Same two steps on an uploaded `main.py` | identical results |
| `Pump('A2')`, `Lock('D13')`, then hard reset (EN) | `/tb_boot.json` = `{"off": ["A2", "D13"]}`; after boot A2 and D13 are outputs at LOW, A1 (not listed) stays an input |
| Hard reset to `main.py` output | 1,466 to 1,641 ms |

Not measured: how long after reset `boot.py` drives the pins (earlier runs put
`boot.py` at about 0.8 s after reset; before that the pins float as inputs).

| # | Risk | Firmware | Pass when | Simulation | CP210x | CH340 |
|---|---|---|---|---|---|---|
| 1 | Memory with Cloud on WROOM without PSRAM | Stage B | at least 30 KB free after connecting, 0 crashes in 24 h | flow only (no real heap) | | |
| 2 | Mic sampling on A1 (GPIO 4, ADC2) | Stage B | at least 8 kHz, jitter under 10 % | flow only (no real timing) | | |
| 3 | Connect without reset, safe mode 10/10 | Stage A | no reset on open, 10/10 recoveries | passes 10/10 | | Python host: no reset on open, 10/10 at 2500 ms, 0/10 at 500 ms; page run pending |
| 4 | HC-05 upload-only, Stop 10/10, back to 115200 | Stage A | 10/10 and page at 115200 | passes | | |
| 5 | Upload speed | Stage A | 3 KB under 1.5 s, 25 KB under 5 s | not meaningful (no baud-rate delay) | | Python host: the new default (base64, no pause) passes, 25 KB in 3.5 to 3.8 s; page run pending |

## Before you start

- Two boards: one with CP210x (`10c4:ea60`), one with CH340/CH9102 (`1a86`). Write
  down which kit revision each is. Use known data cables.
- Desktop Chrome or Edge, page served from `localhost` (see README, "Use the test page").
- Close Arduino IDE, Thonny, PuTTY and any other TinkerBit tab.
- Stage A: flash `ESP32_GENERIC-20241129-v1.24.1.bin` after `erase_flash`, Connect,
  Install library. The status line must show `TB_INFO` with `fw: stock`.
- Stage B: run `firmware/build.sh`, record `firmware/build/size.txt` below, flash the
  `.bin` after `erase_flash`, Connect, Install library (for `/boot.py`). The status line
  must show `fw: tinkerbit`.

### Stage B build record

| Item | Value |
|---|---|
| Build host (WSL / Linux / macOS) | Windows, Docker Desktop (engine 29.9.2), the `docker run` step of `build.sh` run from PowerShell; MicroPython checkout kept in the `tb-mp` volume |
| `build.sh` exit status | 0 (2026-11-07) |
| Image size (bytes) / app partition size | First build: 1,773,264 bytes, 16 % free. Rebuilt 2026-11-07 with library 0.2.0 (RFID, heartbeat, BLE frozen in): 1,781,600 bytes (SHA-256 `23236190...0ea9a822`); app 1.71 MB, 15 % of the app partition free |
| Linker errors fixed (if any) | `tbcloud` no longer links `idf::mqtt` (it broke MicroPython's module scan); it adds the MQTT header folders instead. `LINE_MAX` renamed `TB_LINE_MAX` (clashed with libc). One harmless warning left: implicit `xTaskCreatePinnedToCore` |
| `import tbsys, tbcloud` on the board | yes on COM19: `TB_INFO` reports `fw: tinkerbit`, `lib: 0.1.0`, `api: 1`; 154 KB heap free after the library; safe mode recovered a Ctrl-C-proof `main.py`. After the rebuild: `lib: 0.2.0`, `api: 2`; with no parts plugged in, `Rfid("3D").card()` gives "" and `Heartbeat("I2C1").bpm()` gives -1, each with its "not found" message once; `Ble("ESP")` advertises, sends and stops cleanly; 152 KB heap free afterwards. Not yet tried with a real reader, sensor or phone |

The Studio now ships this image as `static/firmware/tinkerbit-esp32-v1.24.1.bin`.

## Check 1: memory with Cloud (Stage B)

Steps:

1. Fill in `config.json` from `config.example.json` (your WiFi, keep
   `test.mosquitto.org`, a unique `device_id`). Copy it to the board with
   `mpremote connect COMx fs cp config.json :/config.json`. Never paste the password
   into the editor, `main.py` or the console.
2. Optional: watch `tb/<device_id>/#` on test.mosquitto.org with any MQTT client to see
   the `status` message, the telemetry heartbeat and the readings arrive. Publishing
   `{"v":1,"ver":1}` to `tb/<device_id>/state/switch1` should print
   `Cloud: switch1 = 1` and answer on `tb/<device_id>/ack`.
3. Open `checks/check1_cloud_memory.py` in the page editor and click **Upload**. Save
   the console output (it is all `TB_INFO`, `TB_MEM` and `TB_CLOUD` lines). For the
   24 h run you can instead close the page and log with a serial terminal at 115200
   (for example PuTTY with session logging to a file), as long as nothing else holds the
   port.
4. Record the `boot`, `wifi` and `mqtt` records. `ok` must be `true` on both.
5. Leave it 24 h. Take reconnects, WiFi restarts and fresh MQTT starts from the last
   `TB_CLOUD` line (`reconnects`, `wifi_restarts`, `fresh_starts`), and count crashes
   (a new `TB_INFO` line at any time after the first one = the board restarted; write
   down its `reset` field).
6. Pass = `gc_free` **and** `idf_free` both at least 30 KB at the `mqtt` record, and
   0 crashes. Also record `idf_largest` and `idf_min_ever`: TLS reconnects need a large
   contiguous block, so these matter more than the total.
7. Repeat once with the WSS fallback forced (set `port` in `config.json` to a closed
   port, for example 1, so the module swaps to WSS after 3 failures). Record whether it
   connects on 8081.

| Board | Stage | Point | gc_free | idf_free | idf_largest | idf_min_ever | Notes |
|---|---|---|---|---|---|---|---|
| | B | boot | | | | | |
| | B | wifi | | | | | |
| | B | mqtt (TLS 8886) | | | | | |
| | B | after 24 h | | | | | |
| | B | mqtt (WSS 8081) | | | | | |

| Board | Stage | Hours | Sends | Failed sends | Reconnects | WiFi restarts | Fresh starts | Crashes | Result |
|---|---|---|---|---|---|---|---|---|---|
| | B | 24 | | | | | | | |

## Check 2: mic sampling on A1 / ADC2 (Stage B, WiFi off)

Steps:

1. Plug the microphone into A1. Power cycle the board so WiFi has never been on.
2. Open `checks/check2_mic_rate.py` in the editor and click **Run**. It sets the CPU to
   240 MHz and captures 4000 samples (0.5 s) three ways.
3. Copy the three `TB_MIC` lines. The `c_sampler` line carries PASS/FAIL (rate at least
   99 % of 8000 Hz and max jitter under 10 %).
4. Run it 3 times; record the worst run. Also run it once on Stage A for the
   pure-Python numbers on stock firmware.
5. Sanity check the data: `min`/`max` should move when you clap or talk.

| Board | Stage | Method | Rate (Hz) | Max jitter % | Mean jitter % | Overruns | min/max | Result |
|---|---|---|---|---|---|---|---|---|
| | A | Python free-running | | | | | | info |
| | A | Python paced 8 kHz | | | | | | info |
| | B | Python free-running | | | | | | info |
| | B | Python paced 8 kHz | | | | | | info |
| | B | C sampler 8 kHz | | | | | | |

## Check 3: connect without reset, serial safe mode (Stage A, both USB chips)

Steps:

1. Stage A with the library installed and the default `main.py`. Connect.
2. Click **Check 3**. It closes and reopens the port 5 times and compares the board's
   uptime (`ticks_ms`) and looks for the ROM banner (`rst:0x`) to tell whether opening
   reset the board. The `reset` field of `TB_INFO` cannot tell: an EN reset reports
   `power_on` on the classic ESP32.
3. It then writes `while True: pass` to `main.py` and runs **Recover** 10 times (hard
   reset, `TB_SAFE` burst, wait for `TB_SAFE_OK`). It restores the default `main.py`
   at the end.
4. Copy the report box into the table. Do it on both boards.
5. By hand, once per board: unplug and replug the USB cable while the page is open. The
   page should reconnect by itself without a second picker.
6. Once per board: run Check 3 with `?recoverMs=500` (the spec's burst length) and record
   the recovery count. This tells whether 500 ms is enough on real boot timing.
7. Once per board: plug a button into A4 and hold it during Recover. Note the result
   (holding GPIO 0 LOW at reset should enter the ROM download mode, so Recover is
   expected to fail; the note just confirms it).

| Board | Stage | Open resets board? (5 tries) | Recover 10/10 (2500 ms) | Recover times (ms) | Recover with 500 ms | Auto-reconnect after replug | Result |
|---|---|---|---|---|---|---|---|
| CP210x | A | | | | | | |
| CH340 | A | | | | | | |

## Check 4: HC-05 upload-only mode (Stage A)

Background: HC-05 TX and the USB chip's TX both drive GPIO 3. Run the check twice per
board.

Steps, pass 1 (HC-05 unplugged, the page plays the phone):

1. Tick **HC-05 mode** so the warning shows. Connect.
2. Click **Check 4**. Each round uploads an echo program that uses `tinkerbit.HC05()`,
   switches the page to 9600, sends `ping<n>`, expects `echo:ping<n>`, then runs Stop
   (hard reset, safe mode, back to 115200). 10 rounds.
3. Copy the report table.

Steps, pass 2 (HC-05 plugged in, a phone does the talking):

1. Unplug the HC-05, Upload the echo program (it is in `index.html`, function `check4`;
   or type it: `bt = tinkerbit.HC05()`, then echo lines back with `echo:` in front).
2. Plug the HC-05 in, pair the phone, open a Bluetooth serial terminal app at 9600.
3. Send 10 lines from the phone; count the echoes on the phone.
4. Click **Stop** with the HC-05 still plugged in. Record whether the page reaches
   `TB_SAFE_OK` and returns to 115200. Repeat 10 times (re-upload in between with the
   HC-05 unplugged, as the page says).

| Board | Stage | HC-05 | Lines echoed at 9600 | Stop recovered | Page back at 115200 | Result |
|---|---|---|---|---|---|---|
| CP210x | A | unplugged (page echo) | /10 | /10 | | |
| CP210x | A | plugged (phone) | /10 | /10 | | |
| CH340 | A | unplugged (page echo) | /10 | /10 | | |
| CH340 | A | plugged (phone) | /10 | /10 | | |

## Check 5: upload speed (Stage A)

Steps:

1. Connect, then click **Check 5**. It writes a 3 KB and a 25 KB file with each
   transfer (raw REPL with no pause, raw-paste, chunked 256 B / 8 ms), each in hex and
   base64, and times each write from the first byte to the rename.
2. Copy the report table. Run it twice per board and keep the slower run.
3. Also time a real Upload by hand: put a 3 KB program in the editor and click Upload;
   note the time from the click to `TB_INFO`/program output (soft reset included).

| Board | Stage | File | Transfer | Encoding | ms | Target | Result |
|---|---|---|---|---|---|---|---|
| | A | 3 KB | no pause | hex | | < 1500 | |
| | A | 3 KB | no pause | base64 | | < 1500 | |
| | A | 3 KB | raw-paste | hex | | < 1500 | |
| | A | 3 KB | raw-paste | base64 | | < 1500 | |
| | A | 3 KB | chunked | hex | | < 1500 | |
| | A | 3 KB | chunked | base64 | | < 1500 | |
| | A | 25 KB | no pause | hex | | < 5000 | |
| | A | 25 KB | no pause | base64 | | < 5000 | |
| | A | 25 KB | raw-paste | hex | | < 5000 | |
| | A | 25 KB | raw-paste | base64 | | < 5000 | |
| | A | 25 KB | chunked | hex | | < 5000 | |
| | A | 25 KB | chunked | base64 | | < 5000 | |
| | A | 3 KB Upload incl. reset | no pause | base64 | | < 1500 | |

## What simulation verified

Run on Windows, Python 3.11, Chrome via Playwright 1.49.1. pytest: **66 passed**.
Playwright: **18 passed**.

The simulator (`sim/board_sim.py`) follows MicroPython v1.24.1 behaviour read from the
source: the boot order (`_boot.py`, `boot.py`, then `main.py` only in friendly mode when
`boot.py` did not raise), the raw REPL and raw-paste protocol with the 128-byte window
(violations are counted), the REPL UART interrupt character, a 260-byte stdin buffer,
DTR/RTS wired like the auto-reset circuit, baud-rate mismatch garbling, and the
ADC2-off-while-WiFi `OSError`. Within that model, these are verified:

- Library: one `TB_INFO` line with all fields; `begin()` twice; `stop_all()`; relays HIGH
  at boot without importing the library; one object per jack; D13+3D, digital-on-D5,
  unknown jack, A-jack-only parts, A jack with Cloud/WiFi on (at creation and when the
  program starts WiFi itself) all give the friendly text; 12-sample averaging, soil %,
  HC-SR04 cm and -1, DHT11, OLED text and missing OLED, MPU6050 tilt/shake/missing,
  LED brightness, button pull-up, the A4 BOOT note, HC-05 at 9600 with Ctrl-C off; no
  bare `except:`; no GPIO numbers outside `board.py` (scanned over every source file).
- Protocol: raw REPL framing, exceptions after the first `\x04`, raw-paste flow control
  honoured by the host, Ctrl-C stopping busy and sleeping loops, soft reset from friendly
  and raw mode.
- Reset control: opening the port with DTR/RTS dropped in the page's order does not
  reset; a glitchy RTS-first open does; hard reset through RTS; the esptool classic
  sequence enters download mode.
- Safe mode: Stage A (`boot.py`) and Stage B (frozen `_boot.py`) both recover a stuck
  `main.py` (Ctrl-C disabled) 10/10.
- Motion and keep-off parts: servo pulse widths, motor duty and direction, buzzer tones,
  stepper coils released after a move, the active-low 4-channel relay, and the ESP32
  running out of PWM timers. Pump, lock and buzzer jacks are recorded in
  `/tb_boot.json` and driven LOW by `boot.py` on the next power-up.
- Cloud against a fake `tbcloud` that follows the C module: `/config.json` loading, the
  exact `Cloud: ...` checklist lines, retained `online` status, `tb/<id>/state/#`
  subscription, the heartbeat and `{"seq","boot","v"}` telemetry (`%.2f`, NaN skipped,
  24 readings), minimum gap and interval, switch/slider acks with clamping, failsafe
  values, disconnect and reconnect lines, alert rate limit and offline queue, Stop ending
  the Cloud with `offline`, secrets never in the log; A jacks locked, never together with
  Bluetooth, friendly errors for missing config and Stage A.
- Checks: check 2 prints Python rates on Stage A and the C-sampler record on Stage B;
  check 1 reaches its `mqtt` record (fake module).
- Test page (Playwright, fake `navigator.serial` over a WebSocket to the simulator):
  probe without the library, install, `TB_INFO`; Run streams output; Upload then reset
  runs `main.py`; base64 and chunked uploads; Stop on Run and on an uploaded loop, with
  motors and tones off afterwards (`stop_all`); Stop
  falling back to hard reset and safe mode; Recover on a stuck `main.py`; friendly jack
  and ADC2 errors; Live commands; stale `.tmp` cleanup; HC-05 Upload-only at 9600 and
  back to 115200; busy port, cancelled picker and no-Web-Serial messages; no firmware
  offers the install; Stage B safe mode into the raw REPL; no console errors.

## What still needs real hardware

Unless a bullet says otherwise, nothing below was observed on a real ESP32.

- **All five pass/fail numbers.** The simulator has no real heap, no real ADC timing
  and no baud-rate delay, so checks 1, 2 and 5 are flow tests only.
- **Stage B is built and boots on COM19** (see the build record), and safe mode works
  on it. A Studio upload printed `Cloud: joining WiFi` and the "WiFi name not found"
  line for a missing network. Still unverified, because no broker run has happened:
  a real MQTT connection, the WiFi event handlers after a successful join, the NVS
  namespace `tbcloud`, the `offline` publish on stop, `tbcloud.stop()` in `_boot.py`
  ending the task on soft reset while connected, and the memory numbers of check 1.
- **Real USB chips:** whether opening the port resets the board on CP210x and on CH340
  with Chrome's Web Serial (driver and OS can toggle DTR/RTS before the page does);
  real boot timing for the `TB_SAFE` window; `getPorts()` reconnect after replug.
- **TLS and the test broker:** the ISRG roots against test.mosquitto.org 8886, and which
  CA the WSS endpoint on 8081 uses (not checked). The 30 s / 2 min / 3 min reconnect
  timers have not run against a real outage.
- **HC-05 on a shared UART0:** electrical contention on GPIO 3 with the HC-05 plugged in.
- **Library on real parts:** DHT11 timing, `time_pulse_us` on the HC-SR04, the OLED
  driver, MPU6050 reads, PWM brightness, and the import time and RAM cost of compiling
  the 15.7 KB `__init__.py` on the board in Stage A.
- **esptool-js 0.5.7** firmware install from the page (only the "offer install" path was
  tested; the flashing itself needs a board).

## Risks that already look bad on paper

1. **25 KB upload in hex likely fails the 5 s target.** At 115200 baud the wire carries
   about 11.5 KB/s. Hex doubles 25 KB to about 52 KB on the wire, which is 4.5 s before
   any command overhead; about 13 write commands at roughly 60 ms each (round trip plus
   flash write) add about 0.8 s, so about 5.3 s. Base64 is about 35 KB, roughly 3.8 s,
   and should pass. The chunked fallback (256 bytes then an 8 ms pause) adds about 1.6 s
   in hex (about 7 s, fail) and about 1.1 s in base64 (about 4.9 s, borderline).
   Recommendation: base64 by default. A 3 KB `main.py` should take about 0.9 s and pass.
2. **Raw-paste flow control can slow everything down.** The window is 128 bytes and the
   host can have 2 windows (256 bytes) in flight, which covers about 22 ms of round trip
   at 115200. If the Windows USB driver plus Chrome take longer than that to return the
   board's credit byte, throughput drops below the wire speed. Check 5 will show it.
3. **The spec's 500 ms `TB_SAFE` burst is shorter than the ESP32's boot.** From EN
   release to `boot.py` takes roughly 0.5 to 1 s (ROM, bootloader, MicroPython start,
   filesystem mount), and `boot.py` only listens for 300 ms after that. A 500 ms burst
   would end before the board listens. The page sends for 2500 ms by default; check 3
   measures both.
4. **Check 2 jitter under 10 % at 8 kHz means every sample within 12.5 us of its slot.**
   A single ADC2 read costs roughly 20 to 50 us in the IDF driver, and the FreeRTOS tick
   and other interrupts can each add several microseconds. The average rate should pass;
   **max** jitter under 10 % over 4000 samples is at risk even in C. The sampler reports
   max and mean jitter separately so you can decide which one the product needs.
5. **HC-05 Stop with the HC-05 plugged in may fail.** HC-05 TX and the USB chip's TX both
   drive GPIO 3. Without a series resistor on the kit board, the page's `TB_SAFE` may not
   reach the ESP32 while the HC-05 holds the line idle-high. If pass 2 of check 4 fails,
   the product needs "unplug HC-05, then Stop", or a series resistor.
6. **Memory with Cloud is tight.** MicroPython v1.24.1 grows the Python heap on demand
   out of the same IDF heap that mbedTLS needs for each TLS handshake (tens of KB). The
   first connect at boot is the easy case; reconnects hours later, after the Python heap
   has grown, are where a WROOM without PSRAM can run out. Watch `idf_largest` and
   `idf_min_ever`, not only the totals.
7. **Stage B safe mode still runs the filesystem `boot.py`.** Safe mode skips `main.py`
   only. A `boot.py` that hangs would still need a reflash. The test page only ever
   writes our own `boot.py`, so this matters only if students can edit it.
8. **Stage A compiles the library on the board at every boot that imports it.** The
   15.7 KB `__init__.py` is compiled from source on the ESP32, which costs time and a
   peak of RAM. Stage B freezes it. For a Stage A product, ship precompiled `.mpy`
   files.
9. **The reset cause cannot detect an EN reset.** The classic ESP32 reports an EN-pin
   reset as power-on, so the page uses the uptime (`up_ms` in `TB_INFO`) instead.

## Notes on deviations from the spec

- Test broker port: the spec suggests `test.mosquitto.org:8883`, but 8883 uses
  Mosquitto's own CA, not ISRG. The config uses 8886 (Let's Encrypt certificate, so the
  ISRG roots from `cloudCerts.js` work) and 8081 for WSS. `config.json` can name a
  `ca_file` to use another broker.
- The Recover burst defaults to 2500 ms instead of 500 ms (risk 3); `?recoverMs=500`
  restores the spec value for the measurement.
- Check 2 raises the CPU to 240 MHz (MicroPython starts the ESP32 at 160 MHz).
- `cloud.begin()` takes the spec's arguments but they are optional: anything missing
  comes from `/config.json`, which is the only place credentials should live.
