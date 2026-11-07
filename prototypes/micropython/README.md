# TinkerBit MicroPython prototype

A throwaway prototype that proves or disproves five risks of moving Beginner Studio to
MicroPython on the existing kit (classic ESP32 WROOM-32, no PSRAM, 4 MB flash, CP210x or
CH340/CH9102 USB-serial at 115200). It is not a product rewrite: nothing outside this
folder depends on it. Results go in [RESULTS.md](RESULTS.md).

## What is here

| Path | What it is |
|---|---|
| `lib/tinkerbit/board.py` | The jack map. The only file that knows GPIO numbers. |
| `lib/tinkerbit/__init__.py` | The `tinkerbit` library (parts, jack ownership, friendly errors, `info()`). |
| `lib/tinkerbit/cloud.py` | Cloud API (`begin/set/send/alert/switch/slider/connected/status/end`). Stage B firmware only. |
| `lib/ssd1306.py` | OLED driver, vendored from micropython-lib (MIT). |
| `boot.py` | Stage A: relays off at boot, serial safe mode (`TB_SAFE`). |
| `main.py` | Default program: short blink, `info()`, exits within 1 s. |
| `index.html` | Single-file test page: Web Serial transport, raw REPL, Upload, Live, Stop, Recover, HC-05 mode, firmware install, checks 3 to 5. |
| `checks/` | Board-side programs for checks 1 and 2. |
| `firmware/` | Stage B: Docker build script, freeze manifest, frozen `_boot.py`, C modules `tbsys` (ADC sampler, safe mode) and `tbcloud` (esp-mqtt). |
| `sim/` | CPython board simulator, host-side protocol helper, WebSocket bridge for Playwright. |
| `tests/` | pytest (library, simulator, cloud, checks, Studio programs) and Playwright (`tests/e2e/`). |
| `tools/studio_python.js` | Prints the MicroPython Beginner Studio writes for every template (JSON), for `tests/test_studio_programs.py`. |
| `config.example.json` | Template for `/config.json` on the board (Cloud credentials). Placeholders only. |

## Firmware stages

- **Stage A:** stock MicroPython v1.24.1 (`ESP32_GENERIC`) with the library copied to `/lib`
  by the test page. Used for checks 3, 4 and 5.
- **Stage B:** custom MicroPython v1.24.1 with the library frozen in, the `tbsys` and
  `tbcloud` C modules, and our frozen `_boot.py` (serial safe mode before `boot.py`).
  Used for checks 1 and 2.

### Flash Stage A

1. Download `ESP32_GENERIC-20241129-v1.24.1.bin` from
   [micropython.org/download/ESP32_GENERIC](https://micropython.org/download/ESP32_GENERIC/).
2. Either use the test page (Connect; when no MicroPython answers it shows the
   "Install TinkerBit firmware" box; pick the `.bin` and install, written at `0x1000`),
   or use esptool from a terminal:

   ```
   python -m pip install esptool
   python -m esptool --chip esp32 --port COM5 --baud 115200 erase_flash
   python -m esptool --chip esp32 --port COM5 --baud 115200 write_flash -z 0x1000 ESP32_GENERIC-20241129-v1.24.1.bin
   ```

   Replace `COM5` with your port. Stay at 115200: CP210x corrupts data above it.

### Build and flash Stage B

Needs Docker (on Windows: Docker Desktop, then run the script from WSL or Git Bash).

```
cd prototypes/micropython/firmware
./build.sh
```

The script uses the pinned `espressif/idf:v5.2.2` image, clones MicroPython `v1.24.1`,
and builds `ESP32_GENERIC` with `FROZEN_MANIFEST=manifest.py` and
`USER_C_MODULES=cmodules/micropython.cmake`. Output:

- `firmware/build/tinkerbit-stage-b-esp32.bin` (write at `0x1000`, same as Stage A)
- `firmware/build/size.txt` (image and partition usage)

Flash it the same way as Stage A (page or esptool, `erase_flash` first). The frozen
library wins over a leftover `/lib/tinkerbit` from Stage A because `.frozen` comes before
`/lib` on `sys.path`, but erasing keeps the results clean.

## Use the test page

Web Serial needs desktop Chrome or Edge and a secure origin; `localhost` counts. The page
loads the library files with `fetch`, so serve the folder instead of opening the file:

```
cd prototypes/micropython
python -m http.server 8000
```

Open <http://localhost:8000/>.

1. **Connect.** The picker only lists CP210x and CH340/CH9102 boards. If nothing is
   listed, try a data cable (charge-only cables are common). If the port is busy, close
   Arduino IDE, Thonny, PuTTY and other TinkerBit tabs. After the first pick the page
   reconnects by itself (`getPorts()` and the `connect` event).
2. **Install library** (Stage A only). Writes `/lib/tinkerbit/__init__.py`, `board.py`,
   `/lib/ssd1306.py` and `/boot.py`, and `/main.py` only if the board has none. Every
   file goes through `<path>.tmp` and a rename, so a cut cable never leaves half a file;
   stale `.tmp` files are removed on the next connect.
3. **Run** executes the editor contents through the raw REPL and streams the output.
   Nothing is saved; a reset forgets it.
4. **Upload** writes the editor contents to `/main.py` and soft-resets the board so it
   runs on its own.
5. **Live** runs one line at a time (`tinkerbit.Led('D13').on()`); expressions print
   their value.
6. **Stop** sends Ctrl-C, then runs `tinkerbit.stop_all()` so motors, servos, tones,
   pumps and the Cloud connection stop too (Ctrl-C alone leaves PWM running). If the
   board does not answer within 1 s it does Recover.

Options: the transfer mode and the file encoding. The defaults are what measured fastest
on a CH340 board: the plain raw REPL with no pause between writes, and base64 (about
30 % smaller on the wire than hex). Raw-paste and chunked (256 bytes then an 8 ms pause)
are still there for comparison. URL parameters: `?recoverMs=2500` (how long Recover sends
`TB_SAFE`) and `?chunk=2048` (bytes per write command).

## Safe mode and recovery

A4 is GPIO 0 (the BOOT pin) and may have a part on it, so the kit cannot rely on the BOOT
button. Instead, after every reset the board listens on the serial line for `TB_SAFE\n`:

- Stage A: `boot.py` listens for 300 ms. On `TB_SAFE` it prints `TB_SAFE_OK` and raises,
  which makes MicroPython skip `main.py`.
- Stage B: the frozen `_boot.py` listens for 300 ms before the filesystem `boot.py`
  runs. On `TB_SAFE` it prints `TB_SAFE_OK` and switches the board to the raw REPL, so
  `main.py` is skipped. A broken `boot.py` still runs in Stage B (see RESULTS.md).

Our `boot.py` drives the MD relay pins HIGH (off) before anything else, and it runs in
safe mode too. Stage B's frozen `_boot.py` does not touch the relays, so on Stage B
install the library once (it writes `/boot.py`) to get relays off at boot. **Recover** on the page does: hard reset
(an EN pulse through RTS), send `TB_SAFE` every 50 ms for `recoverMs` (default 2500 ms;
the spec's 500 ms is shorter than the ESP32's boot), wait for `TB_SAFE_OK`, then enter
the raw REPL. From there, Upload a fixed `main.py`.

If Recover fails (no MicroPython, or a broken `boot.py` in Stage A), reflash with the
page's "Install TinkerBit firmware" or with esptool as above.

## HC-05 programs

HC-05 sits on UART0, the same wire as USB and the REPL. Unplug the HC-05 before Connect
or Upload. Programs that use `tinkerbit.HC05()` are Upload-only (Run refuses them): the
library turns off Ctrl-C (`micropython.kbd_intr(-1)`) and switches UART0 to 9600, and
the page monitor follows to 9600. Stop does a hard reset, safe mode, and returns the page
to 115200.

## Cloud credentials (Stage B, check 1)

Cloud reads everything from `/config.json` on the board; nothing goes in `main.py` or in
the serial log. Copy `config.example.json`, fill in your WiFi, and keep the test broker
(`test.mosquitto.org`, MQTT over TLS on 8886 with a Let's Encrypt certificate, WSS
fallback on 8081). Do not point it at production `api.tinkerbit.io`.

The board speaks the production protocol: it logs in with `device_id` as the user name
and `token` as the password (leave it empty on the test broker), publishes on
`tb/<device_id>/telemetry|status|ack|alert`, and listens on `tb/<device_id>/state/#`.
`interval_sec` (default 10) and `min_interval_sec` (default 5) work like the Studio's
Cloud settings.

```python
from tinkerbit import cloud
cloud.begin()                 # prints the same "Cloud: ..." lines as the Arduino firmware
cloud.set("temp", 21.5)       # sent on the interval, even while the program sleeps
cloud.send({"moving": True})  # set, then send as soon as the minimum gap allows
cloud.alert("Too hot")        # at most one every 10 s, kept until online
cloud.switch(1), cloud.slider(2)  # dashboard controls, with failsafe values when offline
```

Stop (and `tinkerbit.stop_all()`) ends the Cloud connection and publishes `offline`.

Copy the file with mpremote while the page is disconnected:

```
python -m pip install mpremote
mpremote connect COM5 fs cp config.json :/config.json
```

Do not commit your filled-in `config.json`.

## Run the tests

Simulation only; no board needed.

```
cd prototypes/micropython
python -m pip install pytest
python -m pytest tests -q

npm install
npx playwright install chrome   # once, if Chrome is not installed
npx playwright test
```

`tests/test_studio_programs.py` needs Node and the repo's `node_modules` (it runs
`tools/studio_python.js`); it is skipped when `node` is missing and takes about two
minutes.

Playwright starts `sim/bridge.py` itself (page on port 8796, WebSocket on 8795; set
`TB_HTTP_PORT` to move both). The bridge serves this folder and connects a fake
`navigator.serial` in the page to the CPython board simulator. To run it by hand:
`python sim/bridge.py --http-port 8796 --ws-port 8795 --firmware stage_a`.

## Beginner Studio preview

Open the Studio with `?board=micropython` to see the blocks as MicroPython for this
library (`src/beginner-studio/domain/pycodegen.js`); the choice is remembered in the
browser until `?board=arduino`. Upload stays Arduino-only for now: in this mode it shows a
note, and the code panel's Copy gives the `main.py` to run from `index.html`.
