# TinkerBit library: kit parts by jack name. GPIO numbers live only in board.py.
import gc
import json
import os
import sys
import time

import machine
from machine import Pin

from . import board

VERSION = "0.1.0"
API = 1

ANALOG_SAMPLES = 12
DHT_PERIOD_MS = 2000
MPU_RETRY_MS = 5000
ULTRA_TIMEOUT_US = 30000


class TinkerBitError(Exception):
    pass


_parts = {}
_begun = False
_radio = False
_ble = False
_i2c = None
_pwms = []
_said = {}


def _fail(msg):
    raise TinkerBitError(msg)


def _say_once(key, msg):
    if key not in _said:
        _said[key] = True
        print(msg)


def radio(on):
    """Tell the library WiFi/Cloud is on or off (tinkerbit.cloud calls this)."""
    global _radio
    _radio = bool(on)


def bluetooth(on):
    """Mark Bluetooth on or off. Cloud and Bluetooth never run together."""
    global _ble
    if on and _radio:
        _fail("Cloud and Bluetooth can't run together. Turn Cloud off first.")
    _ble = bool(on)


def _wifi_on():
    # Asking network.WLAN() would start the WiFi driver (RAM cost), and built-in modules
    # never appear in sys.modules, so only the Cloud flag is checked here. Programs that
    # start WiFi themselves get the same message from the OSError that ADC2 raises.
    return _radio


_RESET_NAMES = (
    ("PWRON_RESET", "power_on"),
    ("HARD_RESET", "hard"),
    ("WDT_RESET", "watchdog"),
    ("DEEPSLEEP_RESET", "deepsleep"),
    ("SOFT_RESET", "soft"),
)


def _reset_name():
    cause = machine.reset_cause()
    for const, name in _RESET_NAMES:
        if getattr(machine, const, None) == cause:
            return name
    return str(cause)


def info():
    try:
        st = os.statvfs("/")
        flash_free = st[0] * st[3]
    except Exception:
        flash_free = -1
    try:
        import tbsys  # only in TinkerBit firmware (Stage B)

        fw = "tinkerbit"
    except ImportError:
        fw = "stock"
    gc.collect()
    data = {
        "board": board.BOARD,
        "rev": board.REV,
        "mcu": board.MCU,
        "lib": VERSION,
        "api": API,
        "jacks": len(board.JACKS),
        "uid": "".join("%02x" % b for b in machine.unique_id()),
        "mpy": ".".join(str(n) for n in sys.implementation.version[:3]),
        "fw": fw,
        "flash_free": flash_free,
        "heap_free": gc.mem_free(),
        "reset": _reset_name(),
        "up_ms": time.ticks_ms(),
    }
    print("TB_INFO " + json.dumps(data))


def begin():
    """Put every output in a safe state. Safe to call more than once."""
    global _begun
    for name in board.SAFE_HIGH:
        for gpio in board.JACKS[name]["pins"].values():
            Pin(gpio, Pin.OUT, value=1)
    _begun = True


def stop_all():
    """Turn off motors, buzzer, LEDs and pumps, release the relays, stop PWM and the Cloud."""
    cloud = sys.modules.get("tinkerbit.cloud")
    if cloud and cloud._started:
        try:
            cloud.end()
        except Exception as e:
            print("stop_all:", e)
    for part in list(_parts.values()):
        try:
            part._stop()
        except Exception as e:
            print("stop_all:", e)
    while _pwms:
        try:
            _pwms.pop().deinit()
        except Exception:
            pass
    begin()


def _bus_of(jack):
    return board.JACKS[jack].get("bus", jack)


def _check(cls, jack):
    spec = board.jack(jack)
    if spec is None:
        _fail("There is no jack called {}. Jacks: {}".format(jack, ", ".join(board.JACK_NAMES)))
    kind = spec["kind"]
    if kind not in cls.KINDS:
        if kind == "ultra":
            _fail("D5 is only for the distance sensor (HC-SR04). Plug the {} into {}.".format(cls.NAME, cls.WHERE))
        _fail("The {} can't go on {}. Use {}.".format(cls.NAME, jack, cls.WHERE))
    if cls.ANALOG and not spec.get("adc2"):
        _fail("The {} needs an A jack ({}).".format(cls.NAME, cls.WHERE))
    for other in spec.get("shares", ()):
        if other in _parts:
            _fail("{} and {} can't be used together (they share a wire). Unplug one.".format(jack, other))
    if spec.get("adc2") and _wifi_on():
        _fail("A ports are off while Cloud/WiFi is on. Move the {} to D13, or turn Cloud off.".format(cls.NAME))
    if spec.get("boot"):
        _say_once(jack, "Note: A4 is the BOOT pin. If the board will not start, unplug the {} from A4.".format(cls.NAME))


class _Part:
    KINDS = ("io",)
    DEFAULT = "D13"
    NAME = "part"
    WHERE = "D13 or A1-A4"
    ANALOG = False
    SHARED_BUS = False

    def __new__(cls, jack=None):
        jack = jack or cls.DEFAULT
        # Parts on the shared I2C bus are cached per bus and type (I2C and I2C1 are the same
        # wires); every other part owns its jack.
        key = (_bus_of(jack), cls.__name__) if cls.SHARED_BUS and jack in board.JACKS else jack
        part = _parts.get(key)
        if part is not None:
            if type(part) is cls:
                return part
            _fail("{} already has the {}. One part per jack: pick another jack.".format(jack, part.NAME))
        _check(cls, jack)
        if not _begun:
            begin()
        part = object.__new__(cls)
        part.jack = jack
        part._setup()
        _parts[key] = part
        return part

    def __init__(self, jack=None):
        pass

    def _gpio(self, role="sig"):
        return board.pin(self.jack, role)

    def _setup(self):
        pass

    def _stop(self):
        pass

    def __repr__(self):
        return "<{} on {}>".format(self.NAME, self.jack)


class _Output(_Part):
    OFF_AT_START = True

    def _setup(self):
        self._pin = Pin(self._gpio(), Pin.OUT, value=0)
        self._pwm = None

    def on(self):
        self._write(1)

    def off(self):
        self._write(0)

    def value(self):
        return self._pin.value()

    def _write(self, v):
        if self._pwm is not None:
            self._pwm.duty_u16(65535 if v else 0)
        else:
            self._pin.value(1 if v else 0)

    def _stop(self):
        if self._pwm is not None:
            try:
                self._pwm.deinit()
            except Exception:
                pass
            if self._pwm in _pwms:
                _pwms.remove(self._pwm)
            self._pwm = None
            self._pin = Pin(self._gpio(), Pin.OUT, value=0)
        self._pin.value(0)


class Led(_Output):
    NAME = "LED"

    def toggle(self):
        self._write(0 if self.value() else 1)

    def brightness(self, level):
        level = max(0, min(255, int(level)))
        if self._pwm is None:
            self._pwm = machine.PWM(self._pin, freq=1000, duty_u16=0)
            _pwms.append(self._pwm)
        self._pwm.duty_u16(level * 257)

    def blink(self, ms=500, times=1):
        for _ in range(int(times)):
            self.on()
            time.sleep_ms(int(ms))
            self.off()
            time.sleep_ms(int(ms))


BOOT_FILE = "/tb_boot.json"
_boot_off = None


def _remember_off_at_boot(jack):
    """Record a jack that must stay LOW from power-up (pump, lock, buzzer); boot.py reads
    the file. The first part of a run replaces the old list, so unplugged parts drop out.
    The file is only written when the list changes, to spare the flash."""
    global _boot_off
    try:
        with open(BOOT_FILE) as f:
            saved = json.load(f).get("off", [])
    except (OSError, ValueError):
        saved = []
    if _boot_off is None:
        _boot_off = []
    if jack not in _boot_off:
        _boot_off.append(jack)
    if sorted(saved) != sorted(_boot_off):
        try:
            with open(BOOT_FILE, "w") as f:
                json.dump({"off": sorted(_boot_off)}, f)
        except OSError as e:
            print("Could not save the boot settings:", e)


class _KeepOffOutput(_Output):
    """Outputs that must never run while the board starts (they draw power or move things)."""

    def _setup(self):
        _Output._setup(self)
        _remember_off_at_boot(self.jack)


class Buzzer(_KeepOffOutput):
    NAME = "buzzer"

    def beep(self, ms=200):
        self.on()
        time.sleep_ms(int(ms))
        self.off()

    def tone(self, freq=1000):
        """Play a note (for a passive buzzer) until no_tone() or stop."""
        freq = max(31, min(20000, int(freq)))
        if self._pwm is None:
            self._pwm = machine.PWM(self._pin, freq=freq, duty_u16=32768)
            _pwms.append(self._pwm)
        else:
            self._pwm.freq(freq)
            self._pwm.duty_u16(32768)

    def no_tone(self):
        self._stop()


class Relay(_Output):
    NAME = "relay"


class Pump(_KeepOffOutput):
    NAME = "water pump"


class Lock(_KeepOffOutput):
    """Solenoid door lock: open() for a few seconds at a time (it heats up)."""
    NAME = "door lock"

    def open(self):
        self.on()

    def close(self):
        self.off()


class Servo(_Part):
    NAME = "servo"
    FREQ = 50
    MIN_US = 500
    MAX_US = 2400

    def _setup(self):
        self._pwm = machine.PWM(Pin(self._gpio()), freq=self.FREQ, duty_ns=0)
        _pwms.append(self._pwm)
        self._angle = None
        self.angle(90)

    def angle(self, degrees=None):
        """Move to 0-180 degrees; with no argument, the last angle set."""
        if degrees is None:
            return self._angle
        degrees = max(0, min(180, int(degrees)))
        if self._pwm is None:
            self._setup()
        us = self.MIN_US + (self.MAX_US - self.MIN_US) * degrees // 180
        self._pwm.duty_ns(us * 1000)
        self._angle = degrees
        return degrees

    def _stop(self):
        # No pulses: the arm goes limp, as after a reset.
        if self._pwm is not None:
            try:
                self._pwm.deinit()
            except Exception:
                pass
            if self._pwm in _pwms:
                _pwms.remove(self._pwm)
            self._pwm = None


class Motors(_Part):
    """L293D on MD: motor A and motor B, speed 0-255 forward or backward."""
    NAME = "motor driver"
    KINDS = ("motor",)
    DEFAULT = "MD"
    WHERE = "MD"
    FREQ = 1000
    PINS = {"A": ("a1", "a2"), "B": ("b1", "b2")}

    def _setup(self):
        self._pwm = {}
        for role in ("a1", "a2", "b1", "b2"):
            pwm = machine.PWM(Pin(self._gpio(role)), freq=self.FREQ, duty_u16=0)
            self._pwm[role] = pwm
            _pwms.append(pwm)

    def speed(self, motor="A", speed=180, forward=True):
        if not self._pwm:
            self._setup()
        motor = "B" if str(motor).upper() == "B" else "A"
        duty = max(0, min(255, int(speed))) * 257
        fwd, back = self.PINS[motor]
        self._pwm[fwd].duty_u16(duty if forward else 0)
        self._pwm[back].duty_u16(0 if forward else duty)

    def stop(self):
        for pwm in self._pwm.values():
            pwm.duty_u16(0)

    def _stop(self):
        for pwm in self._pwm.values():
            try:
                pwm.deinit()
            except Exception:
                pass
            if pwm in _pwms:
                _pwms.remove(pwm)
        self._pwm = {}


class Relay4(_Part):
    """4-channel relay board on MD. Active-low: a channel is on while its pin is LOW."""
    NAME = "4-channel relay"
    KINDS = ("motor",)
    DEFAULT = "MD"
    WHERE = "MD"
    ROLES = ("a1", "a2", "b1", "b2")

    def _setup(self):
        self._pins = [Pin(self._gpio(role), Pin.OUT, value=1) for role in self.ROLES]

    def channel(self, number, on=True):
        number = max(1, min(4, int(number)))
        self._pins[number - 1].value(0 if on else 1)

    def all(self, on=False):
        for p in self._pins:
            p.value(0 if on else 1)

    def _stop(self):
        self.all(False)


class Stepper(_Part):
    """4-wire stepper on ST, same step order as the Arduino Stepper library (200 steps a turn).
    ST has a strapping pin (see board.py): the coils are left off after every move."""
    NAME = "stepper motor"
    KINDS = ("stepper",)
    DEFAULT = "ST"
    WHERE = "ST"
    STEPS_PER_TURN = 200
    SEQUENCE = ((1, 0, 1, 0), (0, 1, 1, 0), (0, 1, 0, 1), (1, 0, 0, 1))

    def _setup(self):
        self._pins = [Pin(self._gpio(role), Pin.OUT, value=0) for role in ("in1", "in2", "in3", "in4")]
        self._phase = 0

    def move(self, steps=100, rpm=12):
        """Turn by steps (negative = backward) at rpm (1-60)."""
        steps = int(steps)
        rpm = max(1, min(60, int(rpm)))
        delay_us = 60 * 1000000 // (self.STEPS_PER_TURN * rpm)
        direction = 1 if steps >= 0 else -1
        try:
            for _ in range(abs(steps)):
                self._phase = (self._phase + direction) % 4
                for pin, level in zip(self._pins, self.SEQUENCE[self._phase]):
                    pin.value(level)
                time.sleep_us(delay_us)
        finally:
            self._stop()

    def _stop(self):
        for pin in self._pins:
            pin.value(0)


class Button(_Part):
    NAME = "button"

    def _setup(self):
        self._pin = Pin(self._gpio(), Pin.IN, Pin.PULL_UP)

    def pressed(self):
        return self._pin.value() == 0


class _Detector(_Part):
    """On/off sensor with a digital output; ACTIVE_LOW parts pull it LOW when they detect."""
    ACTIVE_LOW = False

    def _setup(self):
        self._pin = Pin(self._gpio(), Pin.IN)

    def detected(self):
        return self._pin.value() == (0 if self.ACTIVE_LOW else 1)


class Obstacle(_Detector):
    NAME = "IR obstacle sensor"
    ACTIVE_LOW = True


class Pir(_Detector):
    """PIR motion sensor: it settles about a minute after power-up."""
    NAME = "PIR motion sensor"


class Reed(_Detector):
    NAME = "reed switch"
    ACTIVE_LOW = True


class Light(_Detector):
    """LDR module: detected() is True when it is dark (its screw sets how dark)."""
    NAME = "light sensor"


class Flame(_Detector):
    NAME = "flame sensor"
    ACTIVE_LOW = True


class Pot(_Part):
    NAME = "potentiometer"
    DEFAULT = "A1"
    WHERE = "A1-A4"
    ANALOG = True

    def _setup(self):
        self._adc = machine.ADC(Pin(self._gpio()), atten=machine.ADC.ATTN_11DB)

    def raw(self):
        """One 0-4095 reading, averaged over ANALOG_SAMPLES."""
        if _wifi_on():
            _fail("A ports are off while Cloud/WiFi is on. Turn Cloud off to read the {}.".format(self.NAME))
        total = 0
        try:
            for _ in range(ANALOG_SAMPLES):
                total += self._adc.read_u16() >> 4
                time.sleep_us(100)
        except OSError:
            _fail("A ports are off while Cloud/WiFi is on. Turn Cloud off to read the {}.".format(self.NAME))
        return total // ANALOG_SAMPLES

    def read(self):
        return self.raw()


class Mic(Pot):
    NAME = "microphone"


class Gas(Pot):
    NAME = "MQ-2 gas sensor"


class Water(Pot):
    NAME = "water level sensor"


class Soil(Pot):
    NAME = "soil sensor"
    DRY = 3200
    WET = 1200

    def percent(self):
        """0 % dry to 100 % wet; -1 when the reading looks like a loose cable."""
        return self.percent_from(self.raw())

    def percent_from(self, raw):
        if raw < 50:
            return -1
        pct = (self.DRY - raw) * 100 // (self.DRY - self.WET)
        return max(0, min(100, pct))

    def read(self):
        return self.percent()


class Ultrasonic(_Part):
    NAME = "distance sensor"
    KINDS = ("ultra",)
    DEFAULT = "D5"
    WHERE = "D5"

    def _setup(self):
        self._trig = Pin(self._gpio("trig"), Pin.OUT, value=0)
        # Echo stays an input: driving it heats the module.
        self._echo = Pin(self._gpio("echo"), Pin.IN)

    def cm(self):
        """Distance in cm (2-400), or -1 when there is no valid echo."""
        self._trig.value(0)
        time.sleep_us(2)
        self._trig.value(1)
        time.sleep_us(10)
        self._trig.value(0)
        us = machine.time_pulse_us(self._echo, 1, ULTRA_TIMEOUT_US)
        if us <= 0:
            return -1
        cm = us // 58
        return cm if 2 <= cm <= 400 else -1

    def read(self):
        return self.cm()


class Rfid(_Part):
    """Claims the 3D jack (RC522). The card reader driver is not part of this prototype."""
    NAME = "RFID reader"
    KINDS = ("spi",)
    DEFAULT = "3D"
    WHERE = "3D"

    def _setup(self):
        self._ss = Pin(self._gpio("ss"), Pin.OUT, value=1)
        self._rst = Pin(self._gpio("rst"), Pin.OUT, value=1)

    def card(self):
        return None


class DHT11(_Part):
    NAME = "DHT11"
    DEFAULT = "A1"

    def _setup(self):
        import dht
        self._dev = dht.DHT11(Pin(self._gpio()))
        self._at = None
        self._t = -1
        self._h = -1

    def _measure(self):
        now = time.ticks_ms()
        if self._at is not None and time.ticks_diff(now, self._at) < DHT_PERIOD_MS:
            return
        self._at = now
        try:
            self._dev.measure()
            self._t = self._dev.temperature()
            self._h = self._dev.humidity()
        except OSError:
            self._t = -1
            self._h = -1
            _say_once("dht", "DHT11 not answering: plug it into A1 and check the cable.")

    def temperature(self):
        self._measure()
        return self._t

    def humidity(self):
        self._measure()
        return self._h

    def read(self):
        return self.temperature()


def i2c():
    """The shared I2C bus (I2C and I2C1 jacks), created once at 100 kHz."""
    global _i2c
    if _i2c is None:
        pins = board.JACKS["I2C"]["pins"]
        _i2c = machine.I2C(0, scl=Pin(pins["scl"]), sda=Pin(pins["sda"]), freq=board.I2C_FREQ)
    return _i2c


class _I2CPart(_Part):
    KINDS = ("i2c",)
    DEFAULT = "I2C"
    WHERE = "I2C or I2C1"
    SHARED_BUS = True


class Oled(_I2CPart):
    NAME = "OLED screen"
    ADDR = 0x3C

    def _setup(self):
        self._dev = None
        self._lines = [""] * 8

    def _screen(self):
        if self._dev is None:
            import ssd1306
            try:
                self._dev = ssd1306.SSD1306_I2C(128, 64, i2c(), addr=self.ADDR)
            except OSError:
                _fail("OLED screen not found on I2C: check the cable.")
        return self._dev

    def text(self, message, line=0):
        line = max(0, min(7, int(line)))
        self._lines[line] = str(message)[:16]
        self._draw()

    def number(self, value, line=0):
        self.text(value, line)

    def show(self, message):
        """Clear the screen and write the message from the top, wrapping every 16 characters."""
        s = str(message)
        self._lines = [s[i * 16:(i + 1) * 16] for i in range(8)]
        self._draw()

    def clear(self):
        self._lines = [""] * 8
        self._draw()

    def _draw(self):
        dev = self._screen()
        dev.fill(0)
        for i, s in enumerate(self._lines):
            if s:
                dev.text(s, 0, i * 8)
        dev.show()


class Motion(_I2CPart):
    """MPU6050 with plain I2C reads (same math as Beginner Studio)."""
    NAME = "MPU6050"

    def _setup(self):
        self._addr = 0x68
        self._ready = False
        self._retry_at = None
        self._tilt = 0
        self._shake = -1

    def _write(self, reg, value):
        i2c().writeto_mem(self._addr, reg, bytes([value]))

    def _begin(self):
        for addr in (0x68, 0x69):
            self._addr = addr
            try:
                # Wake up, +-2 g, +-250 deg/s, 44 Hz filter.
                self._write(0x6B, 0)
                self._write(0x1C, 0)
                self._write(0x1B, 0)
                self._write(0x1A, 3)
                time.sleep_ms(50)
                return True
            except OSError:
                pass
        self._addr = 0x68
        return False

    def _sample(self):
        if not self._ready:
            now = time.ticks_ms()
            if self._retry_at is not None and time.ticks_diff(now, self._retry_at) < MPU_RETRY_MS:
                return None
            self._retry_at = now
            self._ready = self._begin()
            if not self._ready:
                _say_once("mpu", "MPU6050 not found - check the I2C cable")
                return None
        try:
            raw = i2c().readfrom_mem(self._addr, 0x3B, 14)
        except OSError:
            self._ready = False
            self._retry_at = time.ticks_ms()
            return None
        v = []
        for i in range(7):
            n = (raw[2 * i] << 8) | raw[2 * i + 1]
            v.append(n - 65536 if n & 0x8000 else n)
        return (v[0] / 16384, v[1] / 16384, v[2] / 16384, v[4] / 131, v[5] / 131, v[6] / 131)

    def update(self):
        import math
        sx = sy = sz = 0.0
        peak = 0.0
        n = 0
        for _ in range(10):
            s = self._sample()
            if s is not None:
                sx += s[0]
                sy += s[1]
                sz += s[2]
                g = math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2])
                spin = math.sqrt(s[3] * s[3] + s[4] * s[4] + s[5] * s[5])
                jolt = abs(g - 1.0) * 100 + spin / 5
                if jolt > peak:
                    peak = jolt
                n += 1
            elif not self._ready:
                break
            time.sleep_ms(5)
        if not n:
            self._tilt = 0
            self._shake = -1
            return
        self._tilt = int(round(math.atan2(sx, math.sqrt(sy * sy + sz * sz)) * 57.2958))
        self._shake = int(min(100.0, peak))

    def tilt(self):
        self.update()
        return self._tilt

    def shake(self):
        self.update()
        return self._shake

    def read(self):
        """(tilt, shake) from one measurement; shake is -1 when the sensor is not answering."""
        self.update()
        return self._tilt, self._shake


class HC05(_Part):
    """HC-05 on the UART jack. It shares UART0 with USB serial and the REPL, so a program
    that uses it runs from Upload only and Stop needs a hard reset."""
    NAME = "HC-05"
    KINDS = ("uart",)
    DEFAULT = "UART"
    WHERE = "UART"
    BAUD = 9600

    def _setup(self):
        import micropython
        import select
        # Bytes from the phone must reach the program, not stop it.
        micropython.kbd_intr(-1)
        # Only the baud rate changes: the REPL keeps the UART and its receive buffer,
        # so reads go through sys.stdin.
        machine.UART(board.JACKS[self.jack]["uart"], baudrate=self.BAUD)
        self._poll = select.poll()
        self._poll.register(sys.stdin, select.POLLIN)
        self._buf = ""

    def send(self, text):
        sys.stdout.write(str(text) + "\n")

    def read_line(self):
        """The next full line from the phone, or None when nothing complete arrived yet."""
        while self._poll.poll(0):
            ch = sys.stdin.read(1)
            if not ch:
                break
            if ch == "\n":
                line, self._buf = self._buf.strip("\r"), ""
                return line
            self._buf += ch
        return None
