"""Fake MicroPython modules for the CPython board simulator.

Each Board builds a fresh set at every soft reset (MicroPython clears sys.modules then too).
Behaviour follows MicroPython v1.24.1 on a classic ESP32 closely enough for the protocol and
library tests; electrical behaviour is not modelled.
"""
import errno
import os as _os
import types

# ESP32 (classic) GPIO facts used by the fake machine module.
VALID_GPIO = set(range(0, 6)) | set(range(12, 20)) | {21, 22, 23, 25, 26, 27} | set(range(32, 40))
INPUT_ONLY = set(range(34, 40))
ADC1_GPIO = set(range(32, 40))
ADC2_GPIO = {0, 2, 4, 12, 13, 14, 15, 25, 26, 27}

PWRON_RESET, HARD_RESET, WDT_RESET, DEEPSLEEP_RESET, SOFT_RESET = 1, 2, 3, 4, 5


def _module(name, **attrs):
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    return m


def _oserror(code):
    return OSError(code, errno.errorcode.get(code, str(code)))


def build(board):
    """Return {module name: module} for one soft-reset session of `board`."""
    mods = {}

    # ---------------- time ----------------
    def ticks_ms():
        return board.ticks_ms() & 0x3FFFFFFF

    def ticks_us():
        return board.ticks_us() & 0x3FFFFFFF

    def ticks_diff(a, b):
        d = (a - b) & 0x3FFFFFFF
        return d - 0x40000000 if d & 0x20000000 else d

    def ticks_add(a, b):
        return (a + b) & 0x3FFFFFFF

    import time as _time

    mods["time"] = _module(
        "time",
        sleep=lambda s: board.sleep(s),
        sleep_ms=lambda ms: board.sleep(ms / 1000),
        sleep_us=lambda us: board.sleep(us / 1e6),
        ticks_ms=ticks_ms,
        ticks_us=ticks_us,
        ticks_cpu=ticks_us,
        ticks_diff=ticks_diff,
        ticks_add=ticks_add,
        time=lambda: int(_time.time()),
        time_ns=_time.time_ns,
        localtime=_time.localtime,
        gmtime=_time.gmtime,
        mktime=lambda t: int(_time.mktime(t)),
    )

    # ---------------- machine ----------------
    class Pin:
        IN, OUT, OPEN_DRAIN = 1, 3, 7
        PULL_UP, PULL_DOWN = 1, 2
        IRQ_RISING, IRQ_FALLING = 1, 2

        def __init__(self, id, mode=-1, pull=-1, *, value=None, drive=None):
            if isinstance(id, Pin):
                id = id.id
            if id not in VALID_GPIO:
                raise ValueError("invalid pin")
            self.id = id
            self.init(mode, pull, value=value)

        def init(self, mode=-1, pull=-1, *, value=None, drive=None):
            st = board.pins.setdefault(self.id, {"mode": None, "pull": None, "value": 0})
            if mode != -1 and mode is not None:
                if mode in (Pin.OUT, Pin.OPEN_DRAIN) and self.id in INPUT_ONLY:
                    raise ValueError("pin can only be input")
                st["mode"] = "out" if mode in (Pin.OUT, Pin.OPEN_DRAIN) else "in"
            if pull != -1:
                st["pull"] = {Pin.PULL_UP: "up", Pin.PULL_DOWN: "down"}.get(pull)
            if value is not None:
                self.value(value)

        def value(self, v=None):
            st = board.pins[self.id]
            if v is None:
                if st["mode"] == "out":
                    return st["value"]
                if self.id in board.inputs:
                    return board.inputs[self.id]
                return 1 if st["pull"] == "up" else 0
            st["value"] = 1 if v else 0
            board.pin_log.append((self.id, st["value"]))
            del board.pin_log[:-200]
            return None

        def __call__(self, v=None):
            return self.value(v)

        def on(self):
            self.value(1)

        def off(self):
            self.value(0)

        def irq(self, handler=None, trigger=3):
            return None

        def __repr__(self):
            return "Pin(%d)" % self.id

    # ESP32 LEDC: 16 channels, and 8 timers (4 per speed mode), so at most 8 different
    # frequencies at once. Approximates ports/esp32/machine_pwm.c.
    PWM_CHANNELS = 16
    PWM_TIMERS = 8

    class PWM:
        def __init__(self, dest, freq=None, duty=None, duty_u16=None, duty_ns=None):
            self.pin = dest if isinstance(dest, Pin) else Pin(dest)
            self._freq = freq or 5000
            self._duty = 0
            others = {k: v for k, v in board.pwm.items() if k != self.pin.id}
            if len(others) >= PWM_CHANNELS:
                raise ValueError("out of PWM channels:%d" % PWM_CHANNELS)
            if self._freq not in {p._freq for p in others.values()} and \
                    len({p._freq for p in others.values()}) >= PWM_TIMERS:
                raise ValueError("out of PWM timers:%d" % PWM_TIMERS)
            board.pwm[self.pin.id] = self
            st = board.pins.setdefault(self.pin.id, {"mode": None, "pull": None, "value": 0})
            st["mode"] = "pwm"
            if duty_u16 is not None:
                self.duty_u16(duty_u16)
            elif duty_ns is not None:
                self.duty_ns(duty_ns)
            elif duty is not None:
                self.duty(duty)

        def freq(self, f=None):
            if f is None:
                return self._freq
            self._freq = f

        def duty_ns(self, ns=None):
            period = 1000000000 // self._freq
            if ns is None:
                return self._duty * period // 65535
            self.duty_u16(int(ns) * 65535 // period)

        def duty_u16(self, d=None):
            if d is None:
                return self._duty
            self._duty = max(0, min(65535, int(d)))

        def duty(self, d=None):
            if d is None:
                return self._duty >> 6
            self.duty_u16(int(d) << 6)

        def deinit(self):
            if board.pwm.get(self.pin.id) is self:
                del board.pwm[self.pin.id]
                board.pins[self.pin.id]["mode"] = "out"
                board.pins[self.pin.id]["value"] = 0

    class ADC:
        ATTN_0DB, ATTN_2_5DB, ATTN_6DB, ATTN_11DB = 0, 1, 2, 3
        WIDTH_9BIT, WIDTH_10BIT, WIDTH_11BIT, WIDTH_12BIT = 9, 10, 11, 12

        def __init__(self, pin, *, atten=None):
            gpio = pin.id if isinstance(pin, Pin) else int(pin)
            if gpio not in ADC1_GPIO and gpio not in ADC2_GPIO:
                raise ValueError("invalid Pin for ADC")
            self.gpio = gpio

        def atten(self, a):
            pass

        def width(self, w):
            pass

        def read_u16(self):
            if self.gpio in ADC2_GPIO and board.wifi_on:
                # ESP-IDF adc2_get_raw() times out while the WiFi driver owns ADC2.
                raise OSError("ESP_ERR_TIMEOUT")
            return (board.analog.get(self.gpio, 2048) << 4) & 0xFFFF

        def read(self):
            return self.read_u16() >> 4

        def read_uv(self):
            return self.read() * 3_300_000 // 4095

    class I2C:
        def __init__(self, id=0, *, scl=None, sda=None, freq=400000, timeout=50000):
            self.freq = freq
            board.i2c_freq = freq

        def _dev(self, addr):
            dev = board.i2c_devices.get(addr)
            if dev is None:
                raise _oserror(errno.ENODEV)
            return dev

        def scan(self):
            return sorted(board.i2c_devices)

        def writeto(self, addr, buf, stop=True):
            self._dev(addr).write(bytes(buf))
            return 1

        def writevto(self, addr, vector, stop=True):
            self._dev(addr).write(b"".join(bytes(v) for v in vector))
            return 1

        def readfrom(self, addr, n, stop=True):
            return self._dev(addr).read(None, n)

        def readfrom_mem(self, addr, reg, n, addrsize=8):
            return self._dev(addr).read(reg, n)

        def readfrom_mem_into(self, addr, reg, buf, addrsize=8):
            buf[:] = self.readfrom_mem(addr, reg, len(buf))

        def writeto_mem(self, addr, reg, buf, addrsize=8):
            self._dev(addr).write_mem(reg, bytes(buf))

    class SPI:
        """Hardware SPI 1 or 2 on any pins (GPIO matrix); talks to board.spi_device."""
        MSB, LSB = 0, 1

        def __init__(self, id, baudrate=1000000, *, polarity=0, phase=0, bits=8, firstbit=0,
                     sck=None, mosi=None, miso=None):
            if id not in (1, 2):
                raise ValueError("SPI(%d) doesn't exist" % id)
            for p in (sck, mosi):
                if p is not None and (p.id if isinstance(p, Pin) else p) in INPUT_ONLY:
                    raise ValueError("pin can only be input")
            self.baudrate = baudrate

        def _xfer(self, data):
            dev = board.spi_device
            # Nothing on the bus: MISO idles low.
            return dev.transfer(bytes(data)) if dev is not None else bytes(len(data))

        def write(self, buf):
            self._xfer(buf)

        def read(self, n, write=0):
            return self._xfer(bytes([write]) * n)

        def readinto(self, buf, write=0):
            buf[:] = self.read(len(buf), write)

        def write_readinto(self, out, into):
            into[:] = self._xfer(out)

        def deinit(self):
            pass

    class UART:
        def __init__(self, id, baudrate=None, **kw):
            self.id = id
            self.init(baudrate, **kw)

        def init(self, baudrate=None, **kw):
            if baudrate:
                if self.id == 0:
                    board.set_uart_baud(baudrate)
                else:
                    board.uarts[self.id] = baudrate

        def write(self, buf):
            if self.id == 0:
                board.out_raw(bytes(buf))
            return len(buf)

        def read(self, n=-1):
            # UART0 RX belongs to the REPL interrupt handler (ports/esp32/uart.c), so the
            # driver buffer behind this object never sees data.
            return None

        def any(self):
            return 0

        def deinit(self):
            pass

    def time_pulse_us(pin, level, timeout_us=1000000):
        us = board.echo_us
        if us is None or us > timeout_us:
            return -1
        return us

    def reset():
        board.machine_reset()

    def soft_reset():
        raise SystemExit

    mods["machine"] = _module(
        "machine",
        Pin=Pin,
        PWM=PWM,
        ADC=ADC,
        I2C=I2C,
        SoftI2C=I2C,
        SPI=SPI,
        SoftSPI=SPI,
        UART=UART,
        time_pulse_us=time_pulse_us,
        reset=reset,
        soft_reset=soft_reset,
        reset_cause=lambda: board.reset_cause,
        unique_id=lambda: board.uid,
        freq=lambda f=None: 160000000 if f is None else None,
        idle=lambda: board.sleep(0.001),
        disable_irq=lambda: 0,
        enable_irq=lambda state=0: None,
        PWRON_RESET=PWRON_RESET,
        HARD_RESET=HARD_RESET,
        WDT_RESET=WDT_RESET,
        DEEPSLEEP_RESET=DEEPSLEEP_RESET,
        SOFT_RESET=SOFT_RESET,
    )

    # ---------------- micropython / gc / esp ----------------
    def kbd_intr(c):
        board.set_interrupt_char(c)

    mods["micropython"] = _module(
        "micropython",
        const=lambda x: x,
        kbd_intr=kbd_intr,
        opt_level=lambda level=None: 0,
        alloc_emergency_exception_buf=lambda n: None,
        mem_info=lambda verbose=None: board.print("stack: 736 out of 15360\ngc: total: %d, used: %d, free: %d" % (board.heap_total, board.heap_total - board.heap_free, board.heap_free)),
        qstr_info=lambda verbose=None: None,
        stack_use=lambda: 736,
        heap_lock=lambda: 0,
        heap_unlock=lambda: 0,
        schedule=lambda f, a: f(a),
    )
    mods["gc"] = _module(
        "gc",
        collect=lambda: None,
        mem_free=lambda: board.heap_free,
        mem_alloc=lambda: board.heap_total - board.heap_free,
        enable=lambda: None,
        disable=lambda: None,
        isenabled=lambda: True,
        threshold=lambda n=None: -1,
    )
    mods["esp"] = _module(
        "esp",
        flash_size=lambda: 4 * 1024 * 1024,
        flash_user_start=lambda: 0x200000,
        osdebug=lambda *a: None,
    )
    mods["esp32"] = _module(
        "esp32",
        HEAP_DATA=4,
        HEAP_EXEC=1,
        idf_heap_info=lambda caps: [(board.idf_heap_free + 20000, board.idf_heap_free, board.idf_heap_free // 2, board.idf_heap_free - 4000)],
        raw_temperature=lambda: 120,
    )

    # ---------------- network ----------------
    class WLAN:
        def __init__(self, iface=0):
            self.iface = iface

        def active(self, v=None):
            if v is None:
                return board.wifi.get(self.iface, False)
            board.wifi[self.iface] = bool(v)
            if not v and self.iface == 0:
                board.wifi_connected = False
            return None

        def connect(self, ssid=None, key=None, **kw):
            if not board.wifi.get(self.iface):
                raise OSError("Wifi Not Started")
            board.wifi_connected = True

        def disconnect(self):
            board.wifi_connected = False

        def isconnected(self):
            return board.wifi_connected and board.wifi.get(self.iface, False)

        def status(self, *a):
            return 1010 if self.isconnected() else 1000

        def ifconfig(self, *a):
            return ("192.168.4.20", "255.255.255.0", "192.168.4.1", "192.168.4.1")

        def config(self, *a, **kw):
            if a and a[0] == "mac":
                return bytes(board.uid)
            return None

        def scan(self):
            return []

    mods["network"] = _module("network", WLAN=WLAN, STA_IF=0, AP_IF=1, hostname=lambda n=None: "tinkerbit")

    # ---------------- bluetooth ----------------
    class UUID:
        def __init__(self, value):
            if isinstance(value, UUID):
                self._b = value._b
            elif isinstance(value, int):
                self._b = value.to_bytes(2, "little")
            else:
                self._b = bytes.fromhex(str(value).replace("-", ""))[::-1]

        def __bytes__(self):
            return self._b

        def __eq__(self, other):
            return isinstance(other, UUID) and other._b == self._b

        def __hash__(self):
            return hash(self._b)

    class BLE:
        """State lives in board.ble, so tests can play the phone (Board.ble_connect)."""

        def _need_active(self):
            if not board.ble["active"]:
                raise _oserror(errno.EPERM)

        def active(self, v=None):
            if v is None:
                return board.ble["active"]
            board.ble["active"] = bool(v)
            if not v:
                board.ble.update(advertising=None, values={}, conns=set())

        def config(self, *a, **kw):
            if "gap_name" in kw:
                name = kw["gap_name"]
                board.ble["name"] = name.encode() if isinstance(name, str) else bytes(name)
            if a and a[0] == "gap_name":
                return board.ble["name"]
            return None

        def irq(self, handler):
            board.ble["irq"] = handler

        def gatts_register_services(self, services):
            self._need_active()
            out = []
            for _uuid, chars in services:
                handles = []
                for _c in chars:
                    board.ble["next_handle"] += 2
                    handles.append(board.ble["next_handle"])
                    board.ble["values"][board.ble["next_handle"]] = b""
                out.append(tuple(handles))
            return tuple(out)

        def gatts_write(self, handle, data, send_update=False):
            # The default attribute buffer is 20 bytes; longer writes are cut.
            board.ble["values"][handle] = bytes(data)[:20]

        def gatts_read(self, handle):
            return board.ble["values"][handle]

        def gatts_notify(self, conn, handle, data=None):
            if conn not in board.ble["conns"]:
                raise _oserror(errno.ENOTCONN)
            board.ble["notified"].append((conn, bytes(data if data is not None else board.ble["values"][handle])))

        def gap_advertise(self, interval_us, adv_data=None, resp_data=None, connectable=True):
            self._need_active()
            if interval_us is None:
                board.ble["advertising"] = None
            else:
                if len(adv_data or b"") > 31 or len(resp_data or b"") > 31:
                    raise _oserror(errno.EINVAL)
                board.ble["advertising"] = {"adv": bytes(adv_data or b""), "resp": bytes(resp_data or b"")}
                board.ble["adverts"] += 1

    mods["bluetooth"] = _module("bluetooth", BLE=BLE, UUID=UUID, FLAG_READ=0x0002, FLAG_WRITE=0x0008, FLAG_NOTIFY=0x0010)

    # ---------------- dht / neopixel / framebuf ----------------
    class _DHT:
        def __init__(self, pin):
            self.gpio = pin.id

        def measure(self):
            reading = board.dht.get(self.gpio, board.dht_default)
            if reading is None:
                raise _oserror(errno.ETIMEDOUT)
            self._t, self._h = reading

        def temperature(self):
            return self._t

        def humidity(self):
            return self._h

    mods["dht"] = _module("dht", DHT11=type("DHT11", (_DHT,), {}), DHT22=type("DHT22", (_DHT,), {}))

    class NeoPixel:
        def __init__(self, pin, n, bpp=3, timing=1):
            self.n = n
            self.buf = [(0,) * bpp for _ in range(n)]

        def __len__(self):
            return self.n

        def __setitem__(self, i, v):
            self.buf[i] = tuple(v)

        def __getitem__(self, i):
            return self.buf[i]

        def fill(self, v):
            self.buf = [tuple(v)] * self.n

        def write(self):
            board.neopixels = list(self.buf)

    mods["neopixel"] = _module("neopixel", NeoPixel=NeoPixel)

    class FrameBuffer:
        def __init__(self, buf, width, height, fmt, stride=None):
            self._w, self._h = width, height
            self._texts = []

        def fill(self, c):
            self._texts = []
            board.screen = []

        def text(self, s, x, y, c=1):
            self._texts.append((str(s), x, y))
            board.screen = list(self._texts)

        def pixel(self, x, y, c=None):
            return 0 if c is None else None

        def hline(self, *a):
            pass

        vline = line = rect = fill_rect = ellipse = poly = blit = scroll = hline

    mods["framebuf"] = _module("framebuf", FrameBuffer=FrameBuffer, MONO_VLSB=0, RGB565=1, GS4_HMSB=2, MONO_HLSB=3, MONO_HMSB=4, GS2_HMSB=5, GS8=6)

    # ---------------- os ----------------
    def _st_mode(real):
        return 0x4000 if _os.path.isdir(real) else 0x8000

    def listdir(path=""):
        real = board.real_path(path or board.cwd)
        if not _os.path.isdir(real):
            raise _oserror(errno.ENOENT)
        return sorted(_os.listdir(real))

    def ilistdir(path=""):
        real = board.real_path(path or board.cwd)
        for name in listdir(path):
            full = _os.path.join(real, name)
            yield (name, _st_mode(full), 0, _os.path.getsize(full) if _os.path.isfile(full) else 0)

    def _wrap(fn):
        def inner(*a):
            try:
                return fn(*a)
            except FileNotFoundError:
                raise _oserror(errno.ENOENT)
            except FileExistsError:
                raise _oserror(errno.EEXIST)
            except IsADirectoryError:
                raise _oserror(errno.EISDIR)
            except OSError as e:
                raise _oserror(e.errno or errno.EIO)
        return inner

    def stat(path):
        real = board.real_path(path)
        s = _os.stat(real)
        return (_st_mode(real), 0, 0, 0, 0, 0, s.st_size if _st_mode(real) == 0x8000 else 0, 0, int(s.st_mtime), 0)

    def rename(a, b):
        # LittleFS (the ESP32 default) replaces an existing target.
        _os.replace(board.real_path(a), board.real_path(b))

    def statvfs(path="/"):
        bsize = 4096
        total = board.flash_blocks
        used = 0
        for root, dirs, files in _os.walk(board.flash_dir):
            used += 1 + sum((_os.path.getsize(_os.path.join(root, f)) + bsize - 1) // bsize for f in files)
        free = max(0, total - used)
        return (bsize, bsize, total, free, free, 0, 0, 0, 0, 255)

    def chdir(path):
        real = board.real_path(path)
        if not _os.path.isdir(real):
            raise _oserror(errno.ENOENT)
        board.cwd = board.norm(path)

    mods["os"] = _module(
        "os",
        listdir=_wrap(listdir),
        ilistdir=_wrap(ilistdir),
        mkdir=_wrap(lambda p: _os.mkdir(board.real_path(p))),
        rmdir=_wrap(lambda p: _os.rmdir(board.real_path(p))),
        remove=_wrap(lambda p: _os.remove(board.real_path(p))),
        rename=_wrap(rename),
        stat=_wrap(stat),
        statvfs=statvfs,
        getcwd=lambda: board.cwd,
        chdir=_wrap(chdir),
        sync=lambda: None,
        uname=lambda: ("esp32", "esp32", "1.24.1", "v1.24.1 on 2024-11-29", "Generic ESP32 module with ESP32"),
        urandom=_os.urandom,
        dupterm=lambda *a: None,
        sep="/",
    )

    # ---------------- sys ----------------
    impl = types.SimpleNamespace(name="micropython", version=(1, 24, 1, ""), _machine="Generic ESP32 module with ESP32", _mpy=10502)

    def sys_exit(code=0):
        raise SystemExit(code)

    mods["sys"] = _module(
        "sys",
        modules=board.modules,
        path=["", ".frozen", "/lib"],
        argv=[],
        implementation=impl,
        platform="esp32",
        version="3.4.0; MicroPython v1.24.1 on 2024-11-29",
        version_info=(3, 4, 0),
        byteorder="little",
        maxsize=2**31 - 1,
        stdin=board.stdin,
        stdout=board.stdout,
        stderr=board.stdout,
        exit=sys_exit,
        print_exception=lambda e, file=None: board.print_exception(e),
    )

    # ---------------- select ----------------
    class _Poll:
        def __init__(self):
            self._objs = {}

        def register(self, obj, mask=1):
            self._objs[id(obj)] = (obj, mask)

        def unregister(self, obj):
            self._objs.pop(id(obj), None)

        def modify(self, obj, mask):
            self._objs[id(obj)] = (obj, mask)

        def poll(self, timeout=-1):
            return list(self.ipoll(timeout))

        def ipoll(self, timeout=-1, flags=0):
            deadline = None if timeout is None or timeout < 0 else board.ticks_ms() + timeout
            while True:
                ready = [(o, 1) for o, m in self._objs.values() if o is board.stdin and board.stdin_ready()]
                if ready or (deadline is not None and board.ticks_ms() >= deadline):
                    return iter(ready)
                board.sleep(0.002)

    mods["select"] = _module("select", poll=_Poll, POLLIN=1, POLLOUT=4, POLLERR=8, POLLHUP=16)

    # ---------------- Stage B native modules ----------------
    if board.firmware == "stage_b":
        def sample(adc, buf, rate_hz):
            # Same signature and result shape as firmware/cmodules/tbsys; no real timing.
            for i in range(len(buf)):
                buf[i] = adc.read_u16() >> 4
            return (int(rate_hz), 0.0, 0.0, 0)

        mods["tbsys"] = _module("tbsys", sample=sample, skip_main=lambda: board.set_raw_mode())
        mods["tbcloud"] = board.fake_cloud_module()

    # MicroPython's old u-prefixed names still resolve.
    for name in ("time", "os", "sys", "select"):
        mods["u" + name] = mods[name]
    return mods
