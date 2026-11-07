"""TinkerBit ESP32 board simulator (CPython).

Models what the test page talks to over USB serial:
  * the ESP32 auto-reset circuit (EN low iff RTS and not DTR, IO0 low iff DTR and not RTS),
    ROM boot text and download mode;
  * the MicroPython v1.24.1 boot sequence from ports/esp32/main.c: frozen _boot.py, boot.py,
    then main.py only in friendly-REPL mode when boot.py finished without an exception;
  * the friendly REPL, raw REPL and raw-paste protocol from shared/runtime/pyexec.c,
    including the 128-byte flow-control window (violations are counted);
  * the REPL UART receive interrupt (ports/esp32/uart.c): the interrupt character raises
    KeyboardInterrupt in running code, everything else goes to a 260-byte stdin ring buffer;
  * UART0 baud changes (machine.UART(0, baudrate=...)) that survive soft reset, and garbled
    bytes when host and board baud rates differ;
  * flash as a host folder.
Python code runs in CPython with fake machine/network/dht/... modules (sim/mocks.py).
"""
import builtins
import codeop
import ctypes
import importlib
import math
import os
import re
import threading
import time
import traceback
import types

try:
    from . import mocks
except ImportError:
    import mocks

HERE = os.path.dirname(os.path.abspath(__file__))
PROTO = os.path.dirname(HERE)
LIB_DIR = os.path.join(PROTO, "lib")
FROZEN_BOOT = os.path.join(PROTO, "firmware", "frozen", "_boot.py")

CTRL_A, CTRL_B, CTRL_C, CTRL_D, CTRL_E = 1, 2, 3, 4, 5
FORCED_EXIT = 0x100
STDIN_RINGBUF = 260
PASTE_WINDOW = 128
CLOUD_KEYS = ("switch1", "switch2", "switch3", "switch4", "slider1", "slider2")

ROM_BOOT = (
    "ets Jul 29 2019 12:21:46\r\n\r\n"
    "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)\r\n"
    "configsip: 0, SPIWP:0xee\r\n"
    "clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00\r\n"
    "mode:DIO, clock div:2\r\nload:0x3fff0030,len:4728\r\nload:0x40078000,len:14876\r\n"
    "ho 0 tail 12 room 4\r\nload:0x40080400,len:3368\r\nentry 0x400805cc\r\n"
)
ROM_DOWNLOAD = (
    "ets Jul 29 2019 12:21:46\r\n\r\n"
    "rst:0x1 (POWERON_RESET),boot:0x3 (DOWNLOAD_BOOT(UART0/UART1/SDIO_REI_REO_V2))\r\n"
    "waiting for download\r\n"
)
BANNER = 'MicroPython v1.24.1 on 2024-11-29; Generic ESP32 module with ESP32\r\nType "help()" for more information.\r\n'
DEFAULT_BOOT_PY = (
    "# This file is executed on every boot (including wake-boot from deepsleep)\n"
    "#import esp\n#esp.osdebug(None)\n#import webrepl\n#webrepl.start()\n"
)

# CPython modules that behave like their MicroPython counterparts for our purposes.
REAL_MODULES = {
    "json": "json", "ujson": "json", "math": "math", "cmath": "cmath", "array": "array",
    "binascii": "binascii", "ubinascii": "binascii", "struct": "struct", "ustruct": "struct",
    "random": "random", "re": "re", "errno": "errno", "io": "io", "hashlib": "hashlib",
    "collections": "collections", "heapq": "heapq",
}


class HardReset(BaseException):
    """Raised inside the MicroPython thread of a board that was reset."""


def _async_raise(tid, exc):
    return ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_ulong(tid), ctypes.py_object(exc) if exc else None)


class _Stdin:
    def __init__(self, board):
        self._b = board
        self.buffer = types.SimpleNamespace(read=lambda n=1: bytes(board.rx_chr() for _ in range(n)))

    def read(self, n=1):
        return "".join(chr(self._b.rx_chr()) for _ in range(n))

    def readline(self):
        s = ""
        while not s.endswith("\n"):
            s += chr(self._b.rx_chr())
        return s


class _Stdout:
    def __init__(self, board):
        self._b = board
        self.buffer = types.SimpleNamespace(write=lambda b: (board.out_raw(bytes(b)), len(b))[1])

    def write(self, s):
        self._b.out_text(str(s))
        return len(s)

    def flush(self):
        pass


class Board:
    def __init__(self, flash_dir, firmware="stage_a", on_output=None, boot_ms=700, uid=b"\x24\x6f\x28\xa1\xb2\xc3"):
        if firmware not in ("stage_a", "stage_b", "none"):
            raise ValueError(firmware)
        self.flash_dir = os.path.abspath(flash_dir)
        os.makedirs(self.flash_dir, exist_ok=True)
        self.firmware = firmware
        self.on_output = on_output or (lambda b: None)
        self.boot_ms = boot_ms
        self.uid = uid
        self._fresh = not os.listdir(self.flash_dir)

        self._lock = threading.RLock()
        self._rx = bytearray()
        self._rx_cv = threading.Condition(self._lock)
        self._tls = threading.local()
        self._gen = 0
        self._thread = None
        self.dtr = False
        self.rts = False
        self.in_reset = False
        self.host_baud = 115200
        self.uart_baud = 115200
        self.interrupt_char = -1
        self.mode = "friendly"
        self.paste_credit = None
        self.overflow_wait = 0.5
        self.boot_epoch = time.monotonic()
        self.boot_epoch_us = time.perf_counter()
        self.reset_cause = mocks.PWRON_RESET

        # Counters and logs for tests.
        self.resets = 0
        self.boots = 0
        # Tests can make the program's sleeps shorter (ticks stay real time).
        self.time_scale = 1.0
        self.soft_reboots = 0
        self.paste_violations = 0
        self.rx_overflow = 0

        # Hardware the fake modules read and write.
        self.pins = {}
        self.inputs = {}
        self.analog = {}
        self.pwm = {}
        self.pin_log = []
        self.uarts = {}
        self.wifi = {}
        self.wifi_connected = False
        self.echo_us = 1160
        self.dht = {}
        self.dht_default = (24, 55)
        self.i2c_devices = {0x3C: OledDevice(), 0x68: Mpu6050Device(), 0x57: Max30102Device(self)}
        self.i2c_freq = None
        self.spi_device = Rc522Device()
        self.ble = _ble_state()
        self.screen = []
        self.neopixels = []
        self.heap_total = 113664
        self.heap_free = 98000
        self.idf_heap_free = 61000
        self.flash_blocks = 512
        self.cloud = {}
        self.cloud_sent = []
        self.cloud_lines = []
        self.cloud_skew_ms = 0
        self.cloud_broker_down = False
        self.cwd = "/"

        self.modules = {}
        self._mocks = {}
        self.globals = {}
        self._user_files = set()
        self._builtins = dict(builtins.__dict__)
        self._builtins.update(__import__=self._import, print=self.print, open=self.open, input=self.input)
        self.stdin = _Stdin(self)
        self.stdout = _Stdout(self)

    # ================= host side =================
    def power_on(self):
        with self._lock:
            self._start(mocks.PWRON_RESET)

    def shutdown(self):
        with self._lock:
            self._kill()

    def host_write(self, data):
        with self._lock:
            if self.in_reset or self._thread is None:
                return
            garbled = self.host_baud != self.uart_baud
            for b in data:
                if garbled:
                    b = _garble(b)
                if self.paste_credit is not None and b not in (CTRL_C, CTRL_D):
                    if self.paste_credit <= 0:
                        self.paste_violations += 1
                        continue
                    self.paste_credit -= 1
                if b == self.interrupt_char:
                    _async_raise(self._thread.ident, KeyboardInterrupt)
                    continue
                if len(self._rx) >= STDIN_RINGBUF:
                    # The real wire (11.5 KB/s) is slower than a board that is reading, so
                    # wait for the reader; a board that stays busy loses the bytes.
                    self._rx_cv.notify_all()
                    deadline = time.monotonic() + self.overflow_wait
                    while len(self._rx) >= STDIN_RINGBUF and time.monotonic() < deadline and not self.in_reset:
                        self._rx_cv.wait(0.01)
                if len(self._rx) < STDIN_RINGBUF:
                    self._rx.append(b)
                else:
                    self.rx_overflow += 1
            self._rx_cv.notify_all()

    def set_signals(self, dtr=None, rts=None):
        with self._lock:
            if dtr is not None:
                self.dtr = bool(dtr)
            if rts is not None:
                self.rts = bool(rts)
            en_low = self.rts and not self.dtr
            if en_low and not self.in_reset:
                self.in_reset = True
                self.resets += 1
                self._kill()
            elif not en_low and self.in_reset:
                self.in_reset = False
                self._start(mocks.PWRON_RESET, download=self.dtr and not self.rts)

    def set_host_baud(self, baud):
        with self._lock:
            self.host_baud = int(baud)

    # ================= threads =================
    def _start(self, cause, download=False):
        self._kill()
        self._gen += 1
        gen = self._gen
        t = threading.Thread(target=self._mp_task, args=(gen, cause, download), daemon=True)
        self._thread = t
        t.start()

    def _kill(self):
        self._gen += 1
        t = self._thread
        if t is not None and t.is_alive() and t is not threading.current_thread():
            _async_raise(t.ident, HardReset)
        self.interrupt_char = -1
        self.paste_credit = None

    def _alive(self):
        return getattr(self._tls, "gen", None) == self._gen

    def check(self):
        if not self._alive():
            raise HardReset()

    def machine_reset(self):
        with self._lock:
            self._start(mocks.SOFT_RESET)
        raise HardReset()

    # ================= board side primitives =================
    def ticks_ms(self):
        return int((time.monotonic() - self.boot_epoch) * 1000)

    def ticks_us(self):
        return int((time.perf_counter() - self.boot_epoch_us) * 1e6)

    def sleep(self, seconds):
        end = time.monotonic() + max(0.0, seconds) * self.time_scale
        while True:
            self.check()
            left = end - time.monotonic()
            if left <= 0:
                return
            time.sleep(min(left, 0.01))

    def rx_chr(self):
        with self._rx_cv:
            while not self._rx:
                self.check()
                self._rx_cv.wait(0.02)
            c = self._rx.pop(0)
            if len(self._rx) == STDIN_RINGBUF - 1:
                self._rx_cv.notify_all()
            return c

    def stdin_ready(self):
        return bool(self._rx)

    def out_raw(self, data):
        with self._lock:
            self.check()
            if self.host_baud != self.uart_baud:
                data = bytes(_garble(b) for b in data)
            self.on_output(bytes(data))

    def out_text(self, s):
        self.out_raw(s.replace("\n", "\r\n").encode("utf-8"))

    def print(self, *args, sep=" ", end="\n", file=None):
        text = sep.join(str(a) for a in args) + end
        if file is not None and file is not self.stdout:
            file.write(text)
        else:
            self.out_text(text)

    def input(self, prompt=""):
        self.out_text(prompt)
        line = ""
        while True:
            c = chr(self.rx_chr())
            if c == "\r":
                self.out_text("\n")
                return line
            line += c
            self.out_text(c)

    def set_interrupt_char(self, c):
        with self._lock:
            self.interrupt_char = c

    def set_uart_baud(self, baud):
        with self._lock:
            self.uart_baud = int(baud)

    def set_raw_mode(self):
        self.mode = "raw"

    def ble_connect(self, conn=1):
        """A phone connects (the IRQ runs on the board's thread in MicroPython; here, on the caller's)."""
        self.ble["conns"].add(conn)
        self.ble["advertising"] = None
        if self.ble["irq"]:
            self.ble["irq"](1, (conn, 0, b"\x00" * 6))

    def ble_disconnect(self, conn=1):
        self.ble["conns"].discard(conn)
        if self.ble["irq"]:
            self.ble["irq"](2, (conn, 0, b"\x00" * 6))

    @property
    def wifi_on(self):
        return any(self.wifi.values())

    # ================= flash =================
    def norm(self, path):
        path = str(path).replace("\\", "/")
        if not path.startswith("/"):
            path = self.cwd.rstrip("/") + "/" + path
        parts = []
        for p in path.split("/"):
            if p in ("", "."):
                continue
            if p == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(p)
        return "/" + "/".join(parts)

    def real_path(self, path):
        return os.path.join(self.flash_dir, *self.norm(path).split("/")[1:])

    def open(self, path, mode="r", *args, **kw):
        real = self.real_path(path)
        try:
            if "b" in mode:
                return builtins.open(real, mode)
            return builtins.open(real, mode, encoding="utf-8", newline="")
        except FileNotFoundError:
            raise OSError(2, "ENOENT")

    def files(self):
        """Every file on the fake flash as a sorted list of '/path' strings."""
        out = []
        for root, _dirs, names in os.walk(self.flash_dir):
            for n in names:
                rel = os.path.relpath(os.path.join(root, n), self.flash_dir).replace("\\", "/")
                out.append("/" + rel)
        return sorted(out)

    def read_file(self, path):
        with open(self.real_path(path), encoding="utf-8") as f:
            return f.read()

    # ================= import system =================
    def _search_dirs(self):
        dirs = []
        for p in self._mocks["sys"].path:
            if p == "":
                dirs.append(self.real_path(self.cwd))
            elif p == ".frozen":
                if self.firmware == "stage_b":
                    dirs.append(LIB_DIR)
            elif p.startswith("/"):
                dirs.append(self.real_path(p))
        return dirs

    def _import(self, name, globals=None, locals=None, fromlist=(), level=0):
        if level:
            pkg = (globals or {}).get("__package__") or ""
            if not pkg:
                raise ImportError("can't perform relative import")
            bits = pkg.split(".")
            if level > 1:
                bits = bits[: -(level - 1)]
            full = ".".join(bits) + ("." + name if name else "")
        else:
            full = name
        mod = self._load(full)
        if fromlist:
            for item in fromlist:
                if item != "*" and not hasattr(mod, item) and hasattr(mod, "__path__"):
                    try:
                        self._load(full + "." + item)
                    except ImportError:
                        pass
            return mod
        return self._load(full.split(".")[0])

    def _load(self, full):
        if full in self.modules:
            return self.modules[full]
        parts = full.split(".")
        parent = None
        if len(parts) > 1:
            parent = self._load(".".join(parts[:-1]))
            search = getattr(parent, "__path__", [])
        else:
            # Built-in modules: like MicroPython, they never appear in sys.modules.
            if full in self._mocks:
                return self._mocks[full]
            if full in REAL_MODULES:
                return importlib.import_module(REAL_MODULES[full])
            search = self._search_dirs()
        leaf = parts[-1]
        for d in search:
            pkg_init = os.path.join(d, leaf, "__init__.py")
            if os.path.isfile(pkg_init):
                return self._exec_module(full, pkg_init, os.path.join(d, leaf), parent, leaf)
            path = os.path.join(d, leaf + ".py")
            if os.path.isfile(path):
                return self._exec_module(full, path, None, parent, leaf)
        raise ImportError("no module named '%s'" % full)

    def _shown_name(self, real):
        real = os.path.abspath(real)
        if real.startswith(self.flash_dir):
            return "/" + os.path.relpath(real, self.flash_dir).replace("\\", "/")
        return os.path.relpath(real, LIB_DIR).replace("\\", "/")

    def _exec_module(self, full, path, pkgdir, parent, leaf):
        m = types.ModuleType(full)
        shown = self._shown_name(path)
        m.__file__ = shown
        m.__dict__["__builtins__"] = self._builtins
        if pkgdir:
            m.__path__ = [pkgdir]
            m.__package__ = full
        else:
            m.__package__ = full.rpartition(".")[0]
        self.modules[full] = m
        try:
            with builtins.open(path, encoding="utf-8") as f:
                src = f.read()
            self._user_files.add(shown)
            exec(compile(src, shown, "exec"), m.__dict__)
        except BaseException:
            self.modules.pop(full, None)
            raise
        if parent is not None:
            setattr(parent, leaf, m)
        return m

    # ================= execution =================
    def print_exception(self, e):
        lines = ["Traceback (most recent call last):"]
        for frame, lineno in traceback.walk_tb(e.__traceback__):
            fn = frame.f_code.co_filename
            if fn in self._user_files:
                lines.append('  File "%s", line %d, in %s' % (fn, lineno, frame.f_code.co_name))
        if isinstance(e, SyntaxError):
            lines.append('  File "%s", line %s' % (e.filename, e.lineno))
            msg = e.msg
        elif isinstance(e, OSError) and len(e.args) >= 2:
            msg = "[Errno %s] %s" % (e.args[0], e.args[1])
        else:
            msg = ", ".join(str(a) for a in e.args) if len(e.args) != 1 else str(e.args[0])
        lines.append("%s: %s" % (type(e).__name__, msg))
        self.out_text("\n".join(lines) + "\n")

    def _pce(self, src, filename, kind, print_eof):
        """parse_compile_execute: returns 1 ok, 0 exception, FORCED_EXIT on SystemExit."""
        self._user_files.add(filename)
        ret = 0
        try:
            try:
                code = None
                if kind == "single":
                    try:
                        code = compile(src, filename, "eval")
                    except SyntaxError:
                        code = None
                is_expr = code is not None
                if code is None:
                    code = compile(src, filename, "exec")
                with self._lock:
                    self.interrupt_char = CTRL_C
                if is_expr:
                    value = eval(code, self.globals)
                    if value is not None:
                        self.out_text(repr(value) + "\n")
                else:
                    exec(code, self.globals)
            finally:
                with self._lock:
                    self.interrupt_char = -1
                    _async_raise(threading.get_ident(), None)
            ret = 1
            if print_eof:
                self.out_raw(b"\x04")
        except HardReset:
            raise
        except SystemExit:
            if print_eof:
                self.out_raw(b"\x04")
            ret = FORCED_EXIT
        except BaseException as e:
            if print_eof:
                self.out_raw(b"\x04")
            self.print_exception(e)
            ret = 0
        if print_eof:
            self.out_raw(b"\x04")
        return ret

    def _exec_file(self, name):
        real = self.real_path(name)
        if not os.path.isfile(real):
            return 1
        with builtins.open(real, encoding="utf-8") as f:
            src = f.read()
        return self._pce(src, name, "exec", False)

    def _new_session(self):
        self.modules = {}
        self._mocks = mocks.build(self)
        self._mocks.update(self._boot_mocks())
        self.globals = {"__name__": "__main__", "__builtins__": self._builtins}
        self.pins.clear()
        self.pwm.clear()
        self.wifi.clear()
        self.wifi_connected = False
        # A soft reset turns Bluetooth off (mp_bluetooth_deinit).
        self.ble = _ble_state()
        self.cwd = "/"
        self.interrupt_char = -1

    def _boot_mocks(self):
        board = self

        def setup():
            with builtins.open(board.real_path("/boot.py"), "w", encoding="utf-8", newline="") as f:
                f.write(DEFAULT_BOOT_PY)

        return {
            "vfs": mocks._module("vfs", mount=lambda bdev, path: None),
            "flashbdev": mocks._module("flashbdev", bdev=object()),
            "inisetup": mocks._module("inisetup", setup=setup),
        }

    def _mp_task(self, gen, cause, download):
        self._tls.gen = gen
        try:
            with self._lock:
                self.uart_baud = 115200
                self.interrupt_char = -1
                self._rx.clear()
            self.boot_epoch = time.monotonic()
            self.boot_epoch_us = time.perf_counter()
            self.reset_cause = cause
            self.mode = "friendly"
            self.boots += 1
            if download:
                self.out_text(ROM_DOWNLOAD.replace("\r\n", "\n"))
                while True:
                    self.sleep(1)
            self.out_raw(ROM_BOOT.encode())
            self.sleep(self.boot_ms / 1000)
            with self._lock:
                # uart_stdout_init() resets the RX FIFO: bytes sent during boot are lost.
                self._rx.clear()
            if self.firmware == "none":
                while True:
                    self.out_raw(b"sensor=512\r\n")
                    self.sleep(1)
            if self._fresh:
                self._fresh = False
                with builtins.open(self.real_path("/boot.py"), "w", encoding="utf-8", newline="") as f:
                    f.write(DEFAULT_BOOT_PY)
            while True:
                self._new_session()
                if self.firmware == "stage_b" and os.path.isfile(FROZEN_BOOT):
                    with builtins.open(FROZEN_BOOT, encoding="utf-8") as f:
                        self._pce(f.read(), "_boot.py", "exec", False)
                ret = self._exec_file("boot.py")
                if not ret & FORCED_EXIT and self.mode == "friendly" and ret != 0:
                    ret = self._exec_file("main.py")
                if not ret & FORCED_EXIT:
                    while True:
                        r = self._raw_repl() if self.mode == "raw" else self._friendly_repl()
                        if r != 0:
                            break
                self.soft_reboots += 1
                self.out_text("MPY: soft reboot\n")
        except HardReset:
            return

    # ================= REPLs =================
    def _readline(self, prompt):
        self.out_text(prompt)
        line = ""
        while True:
            c = self.rx_chr()
            if CTRL_A <= c <= CTRL_E and (not line or c == CTRL_C):
                return line, c
            if c == 0x0D:
                self.out_text("\n")
                return line, None
            if c in (0x08, 0x7F):
                if line:
                    line = line[:-1]
                    self.out_raw(b"\x08 \x08")
                continue
            if c == 0x0A or c < 0x20:
                continue
            line += chr(c)
            self.out_raw(bytes([c]))

    def _friendly_repl(self):
        self.out_raw(BANNER.encode())
        while True:
            line, ctrl = self._readline(">>> ")
            if ctrl == CTRL_A:
                self.out_text("\n")
                self.mode = "raw"
                return 0
            if ctrl == CTRL_B:
                self.out_text("\n")
                self.out_raw(BANNER.encode())
                continue
            if ctrl == CTRL_C:
                self.out_text("\n")
                continue
            if ctrl == CTRL_D:
                self.out_text("\n")
                return FORCED_EXIT
            if ctrl == CTRL_E:
                self.out_text("\npaste mode; Ctrl-C to cancel, Ctrl-D to finish\n=== ")
                buf = bytearray()
                cancelled = False
                while True:
                    c = self.rx_chr()
                    if c == CTRL_C:
                        self.out_text("\n")
                        cancelled = True
                        break
                    if c == CTRL_D:
                        self.out_text("\n")
                        break
                    buf.append(c)
                    self.out_text("\n=== " if c == 0x0D else chr(c))
                if not cancelled:
                    r = self._pce(buf.decode("utf-8", "replace").replace("\r", "\n"), "<stdin>", "exec", False)
                    if r & FORCED_EXIT:
                        return r
                continue
            if not line:
                continue
            src = line
            cancelled = False
            while _needs_more(src):
                more, ctrl = self._readline("... ")
                if ctrl == CTRL_C:
                    self.out_text("\n")
                    cancelled = True
                    break
                if ctrl == CTRL_D:
                    break
                src += "\n" + more
                if not more:
                    break
            if cancelled:
                continue
            r = self._pce(src + "\n", "<stdin>", "single", False)
            if r & FORCED_EXIT:
                return r

    def _raw_repl(self):
        self.out_raw(b"raw REPL; CTRL-B to exit\r\n")
        while True:
            line = bytearray()
            self.out_raw(b">")
            while True:
                c = self.rx_chr()
                if c == CTRL_A:
                    if len(line) == 2 and line[0] == CTRL_E:
                        ret = self._raw_paste(line[1])
                        if ret & FORCED_EXIT:
                            return ret
                        line = bytearray()
                        self.out_raw(b">")
                        continue
                    self.out_raw(b"raw REPL; CTRL-B to exit\r\n")
                    line = bytearray()
                    self.out_raw(b">")
                    continue
                if c == CTRL_B:
                    self.out_raw(b"\r\n")
                    self.mode = "friendly"
                    return 0
                if c == CTRL_C:
                    line = bytearray()
                elif c == CTRL_D:
                    break
                else:
                    line.append(c)
            self.out_raw(b"OK")
            if not line:
                self.out_raw(b"\r\n")
                return FORCED_EXIT
            ret = self._pce(line.decode("utf-8", "replace"), "<stdin>", "exec", True)
            if ret & FORCED_EXIT:
                return ret

    def _raw_paste(self, c):
        if c != ord("A"):
            self.out_raw(b"R\x00")
            return 0
        with self._lock:
            self.paste_credit = 2 * PASTE_WINDOW
        self.out_raw(b"R\x01" + bytes([PASTE_WINDOW & 0xFF, PASTE_WINDOW >> 8, 0x01]))
        src = bytearray()
        remain = PASTE_WINDOW
        interrupted = False
        try:
            while True:
                b = self.rx_chr()
                if b in (CTRL_C, CTRL_D):
                    self.out_raw(b"\x04")
                    interrupted = b == CTRL_C
                    break
                src.append(b)
                remain -= 1
                if remain == 0:
                    with self._lock:
                        self.paste_credit += PASTE_WINDOW
                    self.out_raw(b"\x01")
                    remain = PASTE_WINDOW
        finally:
            with self._lock:
                self.paste_credit = None
        if interrupted:
            self.out_raw(b"\x04")
            self.out_text("Traceback (most recent call last):\nKeyboardInterrupt: \n")
            self.out_raw(b"\x04")
            return 0
        return self._pce(src.decode("utf-8", "replace"), "<stdin>", "exec", True)

    # ================= Cloud (fake tbcloud C module) =================
    def cloud_now(self):
        return self.ticks_ms() + self.cloud_skew_ms

    def cloud_publish(self, suffix, payload, retain=False):
        self.cloud_sent.append(("tb/%s/%s" % (self.cloud["device_id"], suffix), payload))
        if retain:
            self.cloud["retained"][suffix] = payload

    def cloud_message(self, key, body):
        """The broker delivers tb/<id>/state/<key> (what the dashboard sends)."""
        c = self.cloud
        if not c.get("connected") or key not in CLOUD_KEYS:
            return

        def number(name):
            m = re.search(r'"%s":(-?\d+)' % name, body)
            return int(m.group(1)) if m else None

        v, ver = number("v"), number("ver")
        if v is None or ver is None:
            return
        fs, fv = number("fs"), number("fv")
        idx = CLOUD_KEYS.index(key)
        top = 1 if idx < 4 else 100
        c["values"][idx] = max(0, min(top, v))
        c["failsafe_sec"][idx] = max(0, min(3600, 120 if fs is None else fs))
        c["failsafe_value"][idx] = max(0, min(top, fv or 0))
        c["failsafe_on"][idx] = False
        self.cloud_publish("ack", '{"key":"%s","ver":%d}' % (key, ver))
        self.cloud_lines.append("Cloud: %s = %d" % (key, c["values"][idx]))

    def cloud_tick(self):
        """One pass of the C supervisor task."""
        c = self.cloud
        if not c:
            return
        now = self.cloud_now()
        if self.wifi_connected and not c["wifi_noted"]:
            c["wifi_noted"] = True
            self.cloud_lines.append("Cloud: WiFi connected (RSSI -55)")
        if c["connected"] and self.cloud_broker_down:
            c["connected"] = False
            c["state"] = 2
            c["reconnects"] += 1
            c["down_since"] = now
            self.cloud_lines.append("Cloud: disconnected - retrying")
        if not c["connected"] and self.wifi_connected and not self.cloud_broker_down:
            if not c["client"]:
                c["client"] = True
                self.cloud_lines.append("Cloud: connecting to mqtts://%s:%d" % (c["host"], c["port"]))
            c["connected"] = True
            c["state"] = 3
            self.cloud_publish("status", '{"s":"online","fw":"%s","rssi":-55,"boot":"%s","tr":"mqtts"}' % (c["fw"], c["boot"]), retain=True)
            c["subscribed"] = "tb/%s/state/#" % c["device_id"]
            self.cloud_lines.append("Cloud: connected (port %d)" % c["port"])
        if not c["connected"]:
            down = now - c["down_since"]
            for i, key in enumerate(CLOUD_KEYS):
                fs = c["failsafe_sec"][i]
                if fs > 0 and not c["failsafe_on"][i] and down >= fs * 1000:
                    c["failsafe_on"][i] = True
                    c["values"][i] = c["failsafe_value"][i]
                    self.cloud_lines.append("Cloud: offline %ds - %s set to safe value %d" % (fs, key, c["failsafe_value"][i]))
            return
        if c["alert"] is not None:
            self.cloud_publish("alert", c["alert"])
            c["alert"] = None
        since = now - c["last_send"] if c["last_send"] is not None else None
        if since is None or since >= c["interval_ms"] or (c["send_now"] and since >= c["min_gap_ms"]):
            c["send_now"] = False
            c["last_send"] = now
            parts = []
            for key, (value, is_int) in c["readings"].items():
                if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
                    continue
                parts.append('"%s":%d' % (key, value) if is_int else '"%s":%.2f' % (key, value))
            c["seq"] += 1
            self.cloud_publish("telemetry", '{"seq":%d,"boot":"%s","v":{%s}}' % (c["seq"], c["boot"], ",".join(parts)))

    def fake_cloud_module(self):
        board = self

        # Same API as firmware/cmodules/tbcloud. The supervisor task runs (cloud_tick) and its
        # scheduled lines are printed whenever Python calls into the module.
        def run():
            board.cloud_tick()
            while board.cloud_lines:
                board.out_text(board.cloud_lines.pop(0) + "\n")

        def start(host, port, ws_port, device_id, token, ca, *, ws_path=None, interval_ms=10000, min_gap_ms=5000, fw=None):
            if not board.wifi_on:
                raise OSError("WiFi is off")
            if "BEGIN CERTIFICATE" not in ca:
                raise ValueError("ca must be PEM")
            board.cloud = {
                "host": host, "port": port, "ws_port": ws_port, "device_id": device_id,
                "ws_path": ws_path or "/mqtt", "interval_ms": interval_ms, "min_gap_ms": min_gap_ms,
                "fw": fw or "mpy-1", "boot": "%08x" % (hash(device_id) & 0xFFFFFFFF),
                "has_token": bool(token), "state": 1, "connected": False, "client": False,
                "wifi_noted": False, "reconnects": 0, "down_since": board.cloud_now(),
                "last_send": None, "send_now": False, "seq": 0, "readings": {},
                "values": [0] * 6, "failsafe_sec": [120] * 6, "failsafe_value": [0] * 6,
                "failsafe_on": [False] * 6, "alert": None, "alert_at": None, "alert_note_at": None,
                "retained": {}, "subscribed": None,
            }

        def set(key, value):
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,22}", str(key)):
                raise ValueError("reading names use letters, digits and _ (up to 23)")
            r = board.cloud["readings"]
            if value is None:
                r.pop(key, None)
                run()
                return True
            if isinstance(value, (bool, int)):
                entry = (int(value), True)
            elif isinstance(value, float):
                entry = (value, False)
            else:
                raise TypeError("readings are numbers")
            if key not in r and len(r) >= 24:
                run()
                return False
            r[key] = entry
            run()
            return True

        def send_now():
            board.cloud["send_now"] = True
            run()

        def alert(text):
            c = board.cloud
            now = board.cloud_now()
            if c["alert"] is not None or (c["alert_at"] is not None and now - c["alert_at"] < 10000):
                if c["alert_note_at"] is None or now - c["alert_note_at"] >= 10000:
                    c["alert_note_at"] = now
                    result = 1
                else:
                    result = 2
            else:
                c["alert"] = str(text)[:483]
                c["alert_at"] = now
                result = 0
            run()
            return result

        def get(key):
            if key not in CLOUD_KEYS:
                raise ValueError("dashboard controls are switch1-4 and slider1-2")
            run()
            return board.cloud["values"][CLOUD_KEYS.index(key)]

        def status():
            run()
            c = board.cloud
            return (c.get("state", 0), c.get("reconnects", 0), "mqtts", 0, 0, 0, c.get("seq", 0))

        def stop():
            c = board.cloud
            if c and c["connected"]:
                board.cloud_publish("status", "offline", retain=True)
            board.cloud = {}
            board.cloud_lines.clear()

        return mocks._module("tbcloud", start=start, set=set, send_now=send_now, alert=alert, get=get,
                             status=status, stop=stop)


def _needs_more(src):
    try:
        return codeop.compile_command(src, "<stdin>", "single") is None
    except (SyntaxError, ValueError, OverflowError):
        return False


def _garble(b):
    # Bytes read at the wrong baud rate come out as different bytes; never as the
    # REPL control characters, so a mismatch cannot accidentally drive the REPL.
    g = ((b * 37) ^ 0xA5) & 0xFF
    return g | 0x80 if g < 0x20 else g


class OledDevice:
    def __init__(self):
        self.writes = 0

    def write(self, data):
        self.writes += 1

    def write_mem(self, reg, data):
        self.writes += 1

    def read(self, reg, n):
        return bytes(n)


def _ble_state():
    return {"active": False, "name": None, "advertising": None, "adverts": 0, "values": {}, "conns": set(),
            "notified": [], "irq": None, "next_handle": 0}


def crc_a(data):
    """ISO 14443-A CRC, low byte first (what the RC522 puts in CRCResultReg)."""
    crc = 0x6363
    for b in data:
        b ^= crc & 0xFF
        b = (b ^ (b << 4)) & 0xFF
        crc = (crc >> 8) ^ (b << 8) ^ (b << 3) ^ (b >> 4)
    return bytes((crc & 0xFF, crc >> 8))


class Rc522Device:
    """RC522 reader with at most one card. put_card(uid) is a card placed on the reader;
    a halted card answers again only after take_card() and put_card(), like lifting it off."""

    def __init__(self):
        self.version = 0x92
        self.card = None
        self.halted = False
        self.regs = [0] * 64
        self.fifo = []
        self.selected = 0

    def put_card(self, uid):
        self.card = bytes(uid)
        self.halted = False

    def take_card(self):
        self.card = None
        self.halted = False

    def transfer(self, data):
        addr = data[0]
        reg = (addr >> 1) & 0x3F
        out = bytearray(len(data))
        if addr & 0x80:
            for i in range(1, len(data)):
                out[i] = self._read(reg)
        else:
            for b in data[1:]:
                self._write(reg, b)
        return bytes(out)

    def _read(self, reg):
        if reg == 0x37:
            return self.version
        if reg == 0x09:
            return self.fifo.pop(0) if self.fifo else 0
        if reg == 0x0A:
            return len(self.fifo)
        return self.regs[reg]

    def _write(self, reg, v):
        if reg == 0x09:
            self.fifo.append(v)
        elif reg == 0x0A:
            if v & 0x80:
                self.fifo = []
        elif reg in (0x04, 0x05):
            # Bit 7 set: the other marked bits are set; clear: they are cleared.
            self.regs[reg] = self.regs[reg] | (v & 0x7F) if v & 0x80 else self.regs[reg] & ~v & 0x7F
        else:
            self.regs[reg] = v
            if reg == 0x01:
                self._command(v & 0x0F)
            elif reg == 0x0D and v & 0x80 and self.regs[0x01] & 0x0F == 0x0C:
                self._transceive(v & 0x07)

    def _command(self, cmd):
        if cmd == 0x0F:
            self.regs = [0] * 64
            self.fifo = []
        elif cmd == 0x03:
            crc = crc_a(bytes(self.fifo))
            self.regs[0x22], self.regs[0x21] = crc[0], crc[1]
            self.regs[0x05] |= 0x04

    def _transceive(self, bits):
        data = bytes(self.fifo)
        self.fifo = []
        self.regs[0x06] = 0
        answer = self._answer(data, bits)
        if answer is None:
            self.regs[0x04] |= 0x01
        else:
            self.fifo = list(answer)
            self.regs[0x04] |= 0x30

    def _part(self, level):
        c = self.card
        if len(c) == 4:
            return c
        return bytes((0x88,)) + c[:3] if level == 0 else c[3:7]

    def _answer(self, data, bits):
        c = self.card
        if c is None:
            return None
        if bits == 7 and data == b"\x26":
            if self.halted:
                return None
            return b"\x44\x00" if len(c) == 7 else b"\x04\x00"
        if len(data) == 2 and data[1] == 0x20 and data[0] in (0x93, 0x95):
            part = self._part((0x93, 0x95).index(data[0]))
            return part + bytes((part[0] ^ part[1] ^ part[2] ^ part[3],))
        if len(data) == 9 and data[1] == 0x70 and data[0] in (0x93, 0x95) and crc_a(data[:7]) == data[7:]:
            level = (0x93, 0x95).index(data[0])
            sak = 0x04 if len(c) == 7 and level == 0 else 0x08
            if sak == 0x08:
                self.selected += 1
            return bytes((sak,)) + crc_a(bytes((sak,)))
        if data[:2] == b"\x50\x00":
            self.halted = True
        return None


class Max30102Device:
    """MAX30102 making 100 samples a second in real time. With finger_bpm set, IR is a pulse wave
    at that rate on top of a fingertip's DC level; with None, no finger (low IR)."""

    DEPTH = 32

    def __init__(self, board):
        self.board = board
        self.finger_bpm = None
        self.mode = 0
        self.regs = {}
        self._restart()

    def _restart(self):
        self.queue = []
        self.rd = 0
        self.lost = 0
        self._t0 = None
        self._made = 0

    def _ir(self, t_ms):
        if self.finger_bpm is None:
            return 2000
        return int(80000 + 200 * math.sin(2 * math.pi * t_ms * self.finger_bpm / 60000.0))

    def _fill(self):
        now = self.board.ticks_ms()
        if self._t0 is None:
            self._t0 = now
        while self._made < (now - self._t0) // 10:
            self._made += 1
            if len(self.queue) >= self.DEPTH:
                self.queue.pop(0)
                self.rd = (self.rd + 1) % self.DEPTH
                self.lost = min(0x1F, self.lost + 1)
            self.queue.append(self._ir(self._made * 10))

    def write(self, data):
        if data:
            self.write_mem(data[0], data[1:])

    def write_mem(self, reg, data):
        v = data[0] if data else 0
        if reg == 0x09:
            # The reset bit clears itself at once.
            self.mode = v & ~0x40
            self._restart()
        elif reg in (0x04, 0x05, 0x06):
            self._restart()
        else:
            self.regs[reg] = v

    def read(self, reg, n):
        if reg == 0xFF:
            return bytes((0x15,))[:n]
        if reg == 0x09:
            return bytes((self.mode,))[:n]
        self._fill()
        if reg == 0x04:
            return bytes(((self.rd + len(self.queue)) % self.DEPTH,))[:n]
        if reg == 0x05:
            return bytes((self.lost,))[:n]
        if reg == 0x06:
            return bytes((self.rd,))[:n]
        if reg == 0x07:
            out = b""
            for _ in range(n // 6):
                ir = self.queue.pop(0) if self.queue else 0
                self.rd = (self.rd + 1) % self.DEPTH
                out += b"\x00\x10\x00" + ir.to_bytes(3, "big")
            self.lost = 0
            return out
        return bytes((self.regs.get(reg, 0),))[:n]


class Mpu6050Device:
    """Flat and still: 1 g on Z, no rotation. Tests can set accel/gyro (raw counts)."""

    def __init__(self):
        self.awake = False
        self.accel = (0, 0, 16384)
        self.gyro = (0, 0, 0)

    def write(self, data):
        if data:
            self.write_mem(data[0], data[1:])

    def write_mem(self, reg, data):
        if reg == 0x6B and data and data[0] == 0:
            self.awake = True

    def read(self, reg, n):
        if reg == 0x75:
            return bytes([0x68])[:n]
        if reg == 0x3B:
            vals = list(self.accel) + [0] + list(self.gyro)
            raw = b"".join((v & 0xFFFF).to_bytes(2, "big") for v in vals)
            return raw[:n]
        return bytes(n)
