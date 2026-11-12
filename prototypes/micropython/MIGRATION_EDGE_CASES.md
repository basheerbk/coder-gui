# Replacing the Arduino compile in Beginner Studio with MicroPython: edge cases

What changes, what can break, and how to handle it, if Beginner Studio stops sending C++
to the compile server and instead uploads Python to a board running MicroPython. Based
on the current Beginner code (`codegen.js`, `cloudFirmware.js`, `aiFirmware.js`, the
upload and monitor hooks) and on the measurements in [RESULTS.md](RESULTS.md).

Labels:

- **Blocker**: must be solved before Beginner can drop the Arduino path.
- **Must handle**: a known failure; the generator, library or page has to deal with it.
- **Watch**: probably fine; needs a test or a soak run to be sure.

## 1. Board firmware lifecycle

1. **Board still has an Arduino sketch** (every kit board today). It never answers the
   raw REPL, and a sketch printing at 9600 looks like zero bytes at 115200 (seen on the
   COM19 board). *Must handle:* the probe has to time out cleanly, not mistake the
   garbage for a REPL, and offer "Install TinkerBit firmware". That costs about 100 s per
   board at 115200 (measured 99 s write plus 6.5 s erase).
2. **The Advanced IDE wipes MicroPython.** Any Advanced upload (Arduino) replaces the
   firmware. Coming back to Beginner then needs the 100 s install again. *Decided
   (2026-11-07):* the Advanced IDE stays Arduino and we accept the reinstall. Beginner
   reads the board info on every upload and never caches "this port has MicroPython".
3. **Going back to Arduino from MicroPython.** The compile server's ESP32 images must
   include the bootloader and partition table, not just the app, or the board keeps the
   MicroPython layout. *Watch:* test one Arduino upload over a MicroPython board.
4. **Wrong chip or flash.** The image is for the classic ESP32 with 4 MB flash. A kit
   board with 2 MB flash, an S3 or a C3 must be refused before flashing (read the chip and
   flash ID first, the way esptool's `flash-id` did on COM19). *Must handle.*
5. **Install interrupted** (cable pulled, laptop sleeps). The ROM bootloader survives, so
   the board can always be reinstalled, but the page must say so instead of "Upload
   failed". If auto-reset fails on a laptop, the BOOT-button fallback from
   `esptool-flash.js` is still needed. *Must handle.*
6. **Firmware and library versions drift.** Boards in a classroom will carry different
   library or firmware versions. `TB_INFO` already reports `lib`, `api` and `fw`; the
   page must refuse or update when the generator needs a newer API. With Stage B (frozen
   library) a library fix means a firmware reflash. *Done in the Studio:* the board info
   reports `fw`, `api` and `ver`; an older firmware is refused with "Choose Update
   board", a newer one with "Reload the page". On the TinkerBit firmware Upload writes
   only `/boot.py` and removes any copied `/lib/tinkerbit`; stock MicroPython still gets
   the library copy.
7. **Stock firmware cannot run Cloud.** Cloud needs the custom Stage B build (C MQTT
   module). Shipping stock MicroPython plus `/lib` is fine for everything else, but then
   Cloud projects need a second firmware. *Done:* one TinkerBit firmware for everyone,
   `static/firmware/tinkerbit-esp32-v1.24.1.bin`, checked against its SHA-256 and served
   from our own origin. "Update board" in the Studio menu installs it; Upload never
   does. A board on stock MicroPython runs everything except Cloud, which asks for
   Update board. Service-worker caching for offline use is still open (section 8).
8. **Filesystem full or corrupt.** Writes fail with `ENOSPC` or `EIO`. *Must handle:*
   friendly text and a "Reset board storage" action (reformat, reinstall library).
9. **Students edit board files by hand** (Thonny, mpremote). A broken `boot.py` is not
   covered by safe mode on stock firmware. *Watch:* Stage B's frozen `_boot.py` still
   works; "Install library" rewrites `boot.py`.

## 2. Connect, upload and stop

1. **Opening the port may reset the board.** pyserial with DTR/RTS held low did not
   reset the CH340 board; mpremote's open did. Chrome's Web Serial behaviour is not
   measured yet. *Watch:* check 3 in Chrome on CH340 and CP210x.
2. **The running program fights the upload.** Upload has to stop it first:
   - A normal loop: Ctrl-C works.
   - A program inside a long C call (`time_pulse_us`, a DHT read, an I2C hang): Ctrl-C
     waits for the call to finish.
   - HC-05 programs turn Ctrl-C off on purpose.

   *Must handle:* Ctrl-C, then after 1 s a hard reset plus safe mode (built and passing
   10/10 on CH340 with a 2.5 s burst).
3. **The spec's 500 ms safe-mode burst fails** (0/10 on CH340: the board only listens
   about 0.8 s after reset). *Must handle:* keep 2.5 s.
4. **Stop leaves outputs running.** Ctrl-C stops the Python code, but PWM keeps
   running: motors keep spinning, a servo holds its angle, a tone keeps sounding. Today
   every Arduino upload resets the chip, so this never happened. *Done in the
   prototype:* after a successful Ctrl-C (Run, uploaded program, or a program that ends
   with an error) the page runs `tinkerbit.stop_all()`, which also ends the Cloud
   connection. Playwright checks that no PWM is left running. Confirmed on the CH340
   board: after Ctrl-C alone the servo and tone channels kept running; after
   `stop_all()` both were off (RESULTS.md, retest 2026-11-07).
5. **A soft reset does not reset hardware.** Upload ends in a soft reset; pins, PWM, I2C
   devices and possibly the WiFi state carry over into the next program. *Must handle:*
   `boot.py` (or the library's `begin()`) puts every output the project uses into its
   safe state.
6. **A program that prints in a tight loop floods the serial line.** The page must drain
   and still find the raw REPL prompt. *Watch:* add a "print with no wait" case to the
   Playwright and hardware checks.
7. **Upload speed.** Measured on CH340: hex and raw-paste fail the 5 s target for 25 KB;
   base64 over the plain raw REPL with no pause passes (3.5 s). A normal Beginner
   program is 1 to 5 KB, but an Edge AI model table can be much bigger. *Done in the
   prototype:* base64 with no pause is now the page default (25 KB in 3.7 to 3.8 s on
   the CH340 board). Still to do: keep the model compact (section 6) and confirm the
   speed in Chrome and on CP210x.
8. **The cable is pulled mid-upload.** The `.tmp` plus rename keeps the old `main.py`
   whole; stale `.tmp` files are removed on the next connect. *Done in the prototype.*
9. **Port held by something else** (Arduino IDE, Thonny, PuTTY, another TinkerBit tab,
   the Advanced IDE monitor). *Done:* friendly text names them.
10. **Monitor and upload share one port.** Today the upload pipeline stops the monitor,
    closes the port, flashes and reopens. With MicroPython the monitor, Upload, Stop,
    the AI recorder and the Cloud checklist must all share one open connection. *Must
    handle:* one serial owner in the Studio, not three hooks each opening the port at
    9600.
11. **Laptop sleep or a USB replug mid-session.** *Done in the prototype:* `getPorts()`
    plus the `connect` event, no second picker.
12. **Nothing listed in the picker** (charge-only cable, missing CH340 driver on
    Windows). Same as today. *Done:* hint text.

## 3. Generating Python from the block tree

`codegen.js` writes C++ line by line. A Python generator needs the same tree walk, plus
these Python-specific rules. *Status:* `pycodegen.js` handles 1 to 5, 7 and 8 and the
float printing in 6 (`"%.2f" %`); `map()` is written inline with `//`, not a helper
module. For 9, the prototype tests compile every template with CPython and run the fully
supported ones in the simulator (Cloud templates on the simulated Stage B board); this
is not in CI yet, and there is no fuzzing or browser-side check.

1. **Empty bodies are a syntax error in Python.** An If with nothing inside, an empty
   Repeat, or an empty program must emit `pass`. *Must handle.*
2. **Indentation is the syntax.** One fixed indent (4 spaces), never mixed, at every
   nesting depth. *Must handle.*
3. **Student text must be escaped for Python.** Print text, OLED text, alerts, the BLE
   name and HC-05 text can contain quotes, backslashes, newlines, emoji or other scripts.
   One `pyStr()` helper must turn any text into a safe Python string literal; otherwise
   a student can break the program or inject code. *Must handle.*
4. **Text inside comments.** `codegen.js` puts the port label and other text in `//`
   comments. In Python a newline inside a comment becomes code. *Must handle:* strip
   newlines or leave text out of comments.
5. **Legacy free-text conditions.** `formatCondition` returns `params.condition` as-is
   for old projects. That is a C expression (`&&`, `||`, `!`, `.length()`). *Must
   handle:* translate the common forms or turn the If into `False` with a "redo this
   If" note (the same way a removed sensor is handled today).
6. **C idioms that change meaning:**
   - `true`/`false` become `True`/`False`.
   - `x.length() > 0` becomes `len(x) > 0` (for `rfidUid` and `hc05Line`).
   - Arduino `map()` with integers needs `//` in Python, not `/`.
   - C `int` overflow and truncation do not exist in Python.
   - `Serial.println(float)` prints `23.00`; Python prints `23.0`.

   *Must handle:* a small runtime helper module so generated code calls
   `tb.map_range(...)` rather than reimplementing it inline.
7. **Variable names.** Part values (`knobValue`, `distance2`, `temperature`, ...) become
   module globals. They must not shadow Python or library names (`print`, `time`,
   `min`, `id`, `tinkerbit`). If the loop is wrapped in a function, every assigned value
   needs a `global` line. *Must handle:* keep the loop at module level, or emit
   `global` lines.
8. **The loop.** Arduino's `loop()` becomes `while True:`. *Watch:* behaviour with no
   wait at all (Ctrl-C still works; the console floods).
9. **Errors happen on the board now, not on the server.** Today a generator bug fails at
   compile time on the server. With Python it becomes a `NameError` or `SyntaxError` on
   the board after upload. *Must handle:*
   - CI compiles every template and a fuzzed set of block trees with `mpy-cross`, or at
     least CPython `ast.parse` plus a name check.
   - The browser checks the code before upload (mpy-cross WebAssembly, or a light
     check).
10. **Runtime errors must not look like a dead board.** In Arduino a missing OLED prints
    a line and the loop goes on. In Python an uncaught `OSError` ends the program and the
    board sits at the REPL. *Must handle:* library methods catch hardware errors and
    return the same fallbacks as today (-1, 0, a printed hint). The generated program
    wraps the loop so an unexpected error prints one friendly line (the prototype's
    `hintFor` texts) instead of a traceback.
11. **Big programs and memory.** `main.py` is compiled on the board at every boot, which
    costs RAM and time. The library import alone takes 498 ms and 17.6 KB on stock
    firmware. *Must handle:* freeze the library (Stage B). For large programs, either
    precompile to `.mpy` in the browser (mpy-cross WebAssembly) or keep the generated
    code small by moving logic into the library.
12. **The code panel shows Python, not C++.** The "Arduino IDE users: install
    ESP32Servo..." note and Copy-to-Arduino go away. Copy becomes "open in Thonny".
    Secrets still never appear (section 5).
13. **The Studio's Arduino-specific wording.** For example `friendlyUpload.js` talks
    about compiling, the compile server and the BOOT button during upload. *Must
    handle:* new messages (no compile step; BOOT only during a firmware install).

## 4. Runtime behaviour, part by part

| Part | Edge case | Label |
|---|---|---|
| All analog parts (pot, mic, gas, soil, water) | MicroPython's ADC defaults to 0 dB attenuation (about 0 to 1.1 V); the library must set 11 dB (the prototype does). Raw values can still differ from Arduino's `analogRead`, so thresholds saved in projects (knob > 2000, gas > 700, soil 3200/1200) may shift. Measure the same sensor on both firmwares. | Must handle |
| All analog parts | ADC2 is off while WiFi is on: same rule as today, plus a friendly error if a program reads A1 to A4 with WiFi on. | Done |
| LED brightness, L293D, servo, buzzer tone | ESP32 PWM has 16 channels and 8 timers, and each distinct frequency takes a timer. Several parts at different frequencies (LED 1 kHz, servo 50 Hz, motors, a changing tone) can run out: "out of PWM timers". Arduino allocates differently. The simulator now raises the same error. | Must handle (test the worst template) |
| Servo | `tinkerbit.Servo`: 50 Hz, 500 to 2400 us pulses via `duty_ns`, centred at 90 on creation, limp after Stop. | Done in the library; compare angles with `ESP32Servo` on the board |
| Stepper | `tinkerbit.Stepper`: 200 steps a turn, 1 to 60 RPM from Python sleeps. Unlike the Arduino `Stepper`, the coils are released after every move, because ST has a strapping pin; the motor holds less torque between moves. Long moves block Ctrl-C until the sleep ends. | Watch |
| L293D motors | `tinkerbit.Motors`: speed 0 to 255, forward/back, 1 kHz. | Done in the library |
| Active and passive buzzer | `Buzzer.tone(freq)` is 50 % PWM, `no_tone()` deinits. | Done in the library |
| 4-ch relay (active-low) | Arduino drives it HIGH in `setup()` (about 0.3 s after reset). MicroPython reaches `boot.py` about 0.8 s after reset, so the relay inputs float longer at power-up. | Watch (look at the relays during a reset) |
| Pump, solenoid, buzzer (`offAtStart`) | Today `setup()` drives them LOW. On MicroPython nothing touches them until `main.py` runs (about 1.4 s after a soft reset, 2 s after a hard reset). A pump or lock could run for a second at power-up. | Done in the prototype: creating a `Pump`, `Lock` or `Buzzer` records its jack in `/tb_boot.json` (rewritten only when the set changes) and `boot.py` drives those pins LOW. Confirmed on the CH340 board after a hard reset. Still to measure: the gap before `boot.py` (about 0.8 s), when the pins float |
| DHT11 | MicroPython's `dht` module is C, so timing is fine. Keep the 2 s minimum gap and the A1-first rule. | Watch |
| HC-SR04 | `time_pulse_us` is C, so fine. Echo must never be an output. | Done |
| OLED | The `ssd1306` driver is vendored. Its font is ASCII only, so student text in other scripts or emoji shows as boxes. | Must handle (filter or warn) |
| MPU6050 | Ported; retries every 5 s; shake -1 when missing. | Done |
| HW-605 pulse (MAX30102) | Needs a Python port of the SparkFun beat detector. BPM depends on sampling fast enough, and other blocks' waits slow the loop (already true in Arduino). | Done in the library (`max30102.py`, `Heartbeat`): the detector is a line-by-line port with C integer wrap-around, checked sample by sample against a C-typed reference in the tests. Each `bpm()` drains the 32-sample FIFO (320 ms at 100 Hz), so waits longer than that lose samples, as in Arduino. Still to try with a finger on a real sensor |
| RFID RC522 | Needs a Python MFRC522 driver on SPI with the 3D pins (SCK 16, MOSI 23, MISO 34). | Done in the library (`rc522.py`, `Rfid`): hardware SPI 2 at 1 MHz, pins from `board.py`, 4-, 7- and 10-byte UIDs, the same hex text as Arduino. Still to try with a real reader and card |
| BLE | MicroPython's `bluetooth` module uses about 40 to 50 KB of RAM. It must keep the same service and characteristic UUIDs and the 20-byte limit so phone apps still work. Changing the name means restarting advertising. | Done in the library (`ble.py`, `Ble`): same UUIDs, READ, WRITE and NOTIFY, 20 bytes, the name in the scan response. Cloud and BLE refuse to run together. Advertising checked on the board; still to try with a phone |
| HC-05 | Shares UART0 with the REPL: Upload-only, Ctrl-C off, the monitor at 9600, Stop by hard reset (built). Today the monitor and HC-05 both sit at 9600, so the student sees HC-05 traffic; with MicroPython the monitor has to follow the board between 115200 and 9600. Some HC-05 modules ship at 38400. | Done in the Studio: the monitor and the Cloud dashboard open at 9600 when the project has an HC-05, else at 115200; Upload falls back to safe mode when Ctrl-C is off. 38400 modules are still not handled |
| Copies of a part (LED 2, knob 2) | Each copy is its own cached object per jack; variable names keep the `2` suffix. | Must handle in the generator |

## 5. TinkerBit Cloud

The production Cloud firmware in `cloudFirmware.js` did much more than the prototype's
first `tbcloud` C module, which only published. Items 1 to 7 and 9 are now written into
`tbcloud.c` and `tinkerbit/cloud.py`, and tested against a fake module in the simulator.
Stage B is built and runs on the COM19 board (RESULTS.md, build record), and the Studio
generates Cloud projects in Python. A run against a real broker has **not happened
yet**, so items 1 to 5, 7, 9 and 10 still need it.

1. **Dashboard controls.** The board subscribes to `tb/<id>/state/#`, applies switch 1 to
   4 and slider 1 and 2 with version numbers, and sends an `ack` for each. *Written:*
   the C module subscribes, clamps and acks; Python reads `cloud.switch(1)`,
   `cloud.slider(2)`.
2. **Failsafe values.** When offline for `fs` seconds, each control falls back to its
   safe value. *Written* in the C task, so it still works while the program is in a long
   Wait.
3. **Heartbeat while the program blocks.** Today the Cloud task runs on its own FreeRTOS
   task and keeps sending while `loop()` sits in `delay()`. In Python the readings are
   Python variables that the C task cannot read. *Written:* Python pushes values into a
   table in the C module (`cloud.set('knobValue', v)`) and the C task sends the table
   on its interval, or the empty `{"v":{}}` heartbeat. The generator has to call
   `cloud.set` after each read (and `cloud.set(name, None)` for an invalid value such as
   distance -1).
4. **Telemetry format.** `{"seq":n,"boot":"xxxxxxxx","v":{...}}`, at most 24 readings,
   `%.2f` floats, NaN skipped. *Written.* MicroPython floats are single precision, so
   values above about 100,000 lose their last digits.
5. **Alerts.** At most one every 10 s, up to 483 bytes, queued while offline, with the
   same printed notes. *Written.*
6. **The going-live checklist reads the USB lines** (`cloudProgress.js`). *Written:* the
   C module prints the same `Cloud: ...` lines through `mp_sched_schedule` (so they never
   land in the middle of other output), and `cloud.begin()` prints `joining WiFi`. Port
   numbers in the lines are the configured ones, so on production they read 8883 and
   443 exactly. The checklist reads them at 115200 instead of 9600. If Python is stuck in
   a long C call, lines wait (up to 8 are kept). *Done in the Studio:* the checklist
   replays what the board printed during the upload, then keeps reading at 115200.
   Confirmed on COM19 up to "WiFi name not found" for a missing network.
7. **Remembering WSS.** *Written:* NVS namespace `tbcloud`, key `wss`, retested daily.
8. **Credentials.** Today they are compiled into the sketch, masked in the panel and
   logs, and sent over HTTPS to the compile server. With MicroPython:
   - Studio writes `/config.json` over USB at upload time. They never leave the
     computer, which is better than today.
   - They sit in plain text in board flash, readable by anyone with a USB cable. That is
     no worse than today: the sketch also holds them in plain text.
   - The write command must never be echoed into the console or the "Details" log.
   - "Use for this project", a new device key or a new WiFi password only rewrites
     `config.json`: a 1 s action, not a reflash.

   *Done in the Studio:* Upload writes `/config.json` for Cloud projects and logs only
   "Wrote the Cloud settings to /config.json". An upload without Cloud removes the file,
   and Update board erases it. Checked on COM19: no secret in the log or on the serial
   line.
9. **Production broker.** Username is the device id, the password is the device token,
   and the ACL is `tb/<id>/#`. *Written:* the topics are now `tb/<id>/...` and the login
   is the device id and `token` from `config.json`; the status message reports
   `fw: "mpy-1"`, which the service accepts and treats as a heartbeat firmware. Still to
   do: a run against the real service with a test device (needs one from you).
10. **Memory.** Unmeasured: TLS plus MicroPython plus the program on a WROOM without
    PSRAM, and reconnects hours later. *Blocker:* check 1.
11. **Cloud plus Edge AI** (Phone AI Alert template): the AI's answers become readings
    `ai_<name>`. Memory for both together is untested. *Watch.*

## 6. Edge AI

1. **Existing examples must stay valid.** Saved projects hold examples recorded by the
   C++ recorder. A Python classifier on the board must compute features that match
   exactly (same axes, order, units, 100 Hz, the 200 ms pre-roll, the jolt threshold
   0.35). Otherwise old projects classify wrongly with no visible error. *Blocker:*
   - Either keep the recorder and classifier numerically identical (test with the same
     raw data through both),
   - or bump the parts signature so old examples are asked to be re-recorded (the
     mechanism already exists).
2. **100 Hz sampling in Python.** One MPU6050 read (14 bytes at 100 kHz I2C) is about
   1.5 ms plus Python overhead, so 10 ms slots should hold. GC pauses could make a slot
   late. *Watch:* measure jitter on the board.
3. **The model table.** Up to 4 things × 10 examples × 24 features = 960 numbers. As a
   Python list of floats that is about 15 KB of heap and a slow compile. *Must handle:*
   ship it as one `array('f')` built from a bytes literal, or as a separate data file.
4. **The recorder protocol** (`TBAI1,H/F/L/E` lines, `aiLine.js`). Keep the same lines
   and the 2 s hello. The recorder hook reads at 9600 today and must read at 115200.
   *Must handle.*
5. **The Sensors kind** reads several parts for about 1 s. With analog parts this is
   ADC2, so it never runs with Cloud WiFi on. Same rule as today. *Done.*

## 7. Studio and projects

1. **Saved projects are block trees**, so they load unchanged. Aliases (`gas` to `mq2`,
   `dc` to `l293d`) still apply. *Done.*
2. **Every template must generate valid Python that runs.** `templates.js` has about 90
   templates, from LED Blink to the Advanced scenes (Garden Station, Maker Console,
   Access Gate) and the Edge AI and Cloud ones. *Must handle:* a CI test per template,
   plus a hardware run of at least one template per part combination before release.
3. **Undo, autosave, the Build view, jack rules.** Unchanged: they work on connections
   and blocks, not on code. *Done.*
4. **"Upload complete" now means less.** Arduino's success means compiled and flashed.
   With MicroPython, success means the file was written; the program can still fail a
   second later. *Must handle:* wait for the program's first line or an error before
   saying "Done", and show the friendly error otherwise.
5. **New possibility: instant Run.** Raw REPL Run (no save) takes well under a second.
   It is optional, but it changes the lesson flow (try, then Upload to keep it).
6. **Mixed classroom during the switch.** Some boards on Arduino, some on MicroPython,
   students moving between Beginner and Advanced. *Must handle:* clear "This board needs
   TinkerBit firmware (2 minutes, once)" text and a teacher prep checklist.

## 8. Offline and classroom operations

1. **Offline really means offline.** The firmware image (1.7 MB), the library files and
   esptool-js must come from our origin and be cached by a service worker. The
   prototype loads esptool-js from jsDelivr. *Must handle.*
2. **First-time setup per board** is about 2 minutes at 115200. For 30 boards that is
   an hour of prep. *Must handle:* ship kits pre-flashed, or a teacher bulk-flash page.
3. **Chromebooks.** Web Serial works on ChromeOS with built-in CH340 and CP210x
   drivers. *Watch:* test once.
4. **Weak USB power.** WiFi or BLE start can brown out the board and loop resets. This
   is the same as today, but `TB_INFO`'s `reset` field makes it visible. *Watch.*
5. **Plugged into a laptop, the board starts in its flashing mode.** Seen on the COM19
   CH340 board (2026-11-12): after a replug the ROM bootloader answered esptool with no
   reset, and the saved `main.py` did not run; on a phone charger it ran every time, and
   RST always fixed it. Windows toggles DTR/RTS while it sets up the CH340, and the
   auto-reset circuit turns that into GPIO 0 low while EN rises. It happens before any
   firmware, so Arduino sketches are hit the same way. *Board fix:* 1 to 10 µF from EN
   to GND (Espressif's recommendation for this circuit) in the next board revision.
   *Done in the Studio:* Upload already resets a silent board (safe mode); the serial
   monitor's Start now restarts the board with GPIO 0 high, hides the ROM boot log
   (garbage at 9600), and after 4 s of silence says to press RST once. The monitor
   restarting the program on Start matches the Arduino IDE.

## 9. Security

1. **Code injection through student text.** Covered by `pyStr()` (section 3, item 3).
   *Must handle.*
2. **Anyone with the USB cable has full control** (raw REPL, read `config.json`). That
   matches today: an Arduino board can be read out with esptool. Accept it.
3. **No hardware watchdog, Secure Boot or flash encryption**, as the prototype spec
   asked. Accept it for now.

## Order of work if the checks pass

1. Hardware checks: page checks 3 to 5 on CH340 and CP210x; Stage B build; checks 1 and 2.
2. ~~Close the prototype gaps: `stop_all()` after Stop, keeping `offAtStart` pins off at
   boot, base64 with no pause by default, telemetry topics and dashboard controls in
   `tbcloud`.~~ Done in simulation; the board retest and the Stage B build remain.
3. The Python generator behind a setting, with Arduino still the default: control
   blocks and simple parts first, then OLED, MPU6050 and Edge AI, then RFID, pulse, BLE
   and Cloud. *Started (2026-11-07):* `src/beginner-studio/domain/pycodegen.js`, turned
   on with `?board=micropython` (remembered per browser, `?board=arduino` turns it off).
   Every control block and every part except Edge AI (RFID, heartbeat, BLE and HC-05
   were added later on 2026-11-07).
   Cloud was added on 2026-11-07 (`cloud.set`, `alert`, `send`, `switch(n)`,
   `slider(n)`; credentials in `/config.json`). The Studio uploads over the raw REPL.
4. Equivalence tests: each block's Python and C++ produce the same printed lines and
   the same pin activity in a simulator; every template runs on a real board.
5. ~~Switch the default to MicroPython, keep Arduino as a fallback for one term, then
   remove it.~~ *Done (2026-11-07), changed:* Beginner Studio is MicroPython only and
   Arduino is reachable only through the hidden `?board=arduino` switch for teachers.
   Edge AI is greyed out with "Coming soon in MicroPython" and cannot be added;
   templates that use it cannot be opened.
6. *Done (2026-11-07):* RFID, HC-05, BLE and heartbeat are ported (library 0.2.0,
   firmware API 2, the bundled image rebuilt). Next: the real broker run plus check 1,
   the new parts on real hardware, then Edge AI.
