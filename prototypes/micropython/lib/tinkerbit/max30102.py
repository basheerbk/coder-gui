# MAX30102 (HW-605) pulse sensor on I2C, and the beat detector from the SparkFun MAX3010x
# library (heartRate.cpp, Maxim's PBA algorithm) that Beginner Studio's Arduino code used.
import time

ADDR = 0x57

_FIFO_WR = 0x04
_FIFO_OVF = 0x05
_FIFO_RD = 0x06
_FIFO_DATA = 0x07
_FIFO_CONFIG = 0x08
_MODE_CONFIG = 0x09
_SPO2_CONFIG = 0x0A
_LED_RED = 0x0C
_LED_IR = 0x0D
_PART_ID = 0xFF
_MAX30102_ID = 0x15

# Red + IR (6 bytes a sample). The SparkFun setup() asked for a green LED the MAX30102 does not have.
_MODE_SPO2 = 0x03
_RESET = 0x40
# 4 samples averaged, FIFO rolls over when full.
_FIFO_SETUP = 0x50
# ADC range 4096 nA, 400 samples/s, 411 us pulses: SparkFun's setup() defaults.
_SPO2_SETUP = 0x2F
_RED_POWER = 0x0A
_IR_POWER = 0x1F

# 400 samples/s averaged by 4.
SAMPLE_MS = 10
FIFO_DEPTH = 32


def _s16(v):
    v &= 0xFFFF
    return v - 0x10000 if v & 0x8000 else v


def _s32(v):
    v &= 0xFFFFFFFF
    return v - 0x100000000 if v & 0x80000000 else v


_FIR = (172, 321, 579, 927, 1360, 1858, 2390, 2916, 3391, 3768, 4012, 4096)


class BeatDetector:
    """checkForBeat() from heartRate.cpp, with its C integer sizes (int16/uint16/int32 wrap
    the same way), so the same samples give the same beats as the Arduino code."""

    def __init__(self):
        self.ac_max = 20
        self.ac_min = -20
        self.cur = 0
        self.prev = 0
        self.sig_min = 0
        self.sig_max = 0
        self.pos = False
        self.neg = False
        self._avg_reg = 0
        self._cbuf = [0] * 32
        self._offset = 0

    def _average(self, x):
        # averageDCEstimator(int32_t *p, uint16_t x)
        x &= 0xFFFF
        self._avg_reg = _s32(self._avg_reg + ((_s32(x << 15) - self._avg_reg) >> 4))
        return _s16(self._avg_reg >> 15)

    def _low_pass(self, din):
        cb = self._cbuf
        o = self._offset
        cb[o] = din
        z = _FIR[11] * cb[(o - 11) & 0x1F]
        for i in range(11):
            z += _FIR[i] * cb[(o - i) & 0x1F]
            z += _FIR[i] * cb[(o - 22 + i) & 0x1F]
        self._offset = (o + 1) % 32
        return _s16(_s32(z) >> 15)

    def check(self, sample):
        beat = False
        self.prev = self.cur
        avg = self._average(sample)
        self.cur = self._low_pass(_s16(sample - avg))
        if self.prev < 0 and self.cur >= 0:
            self.ac_max = self.sig_max
            self.ac_min = self.sig_min
            self.pos = True
            self.neg = False
            self.sig_max = 0
            if 20 < self.ac_max - self.ac_min < 1000:
                beat = True
        if self.prev > 0 and self.cur <= 0:
            self.pos = False
            self.neg = True
            self.sig_min = 0
        if self.pos and self.cur > self.prev:
            self.sig_max = self.cur
        if self.neg and self.cur < self.prev:
            self.sig_min = self.cur
        return beat


class MAX30102:
    def __init__(self, i2c, addr=ADDR):
        self._i2c = i2c
        self._addr = addr

    def _write(self, reg, value):
        self._i2c.writeto_mem(self._addr, reg, bytes((value,)))

    def _read(self, reg):
        return self._i2c.readfrom_mem(self._addr, reg, 1)[0]

    def begin(self):
        """Reset and start sampling. False when no MAX30102 answers (OSError is passed on)."""
        if self._read(_PART_ID) != _MAX30102_ID:
            return False
        self._write(_MODE_CONFIG, _RESET)
        end = time.ticks_add(time.ticks_ms(), 100)
        while self._read(_MODE_CONFIG) & _RESET:
            if time.ticks_diff(end, time.ticks_ms()) <= 0:
                return False
            time.sleep_ms(1)
        self._write(_FIFO_CONFIG, _FIFO_SETUP)
        self._write(_MODE_CONFIG, _MODE_SPO2)
        self._write(_SPO2_CONFIG, _SPO2_SETUP)
        self._write(_LED_RED, _RED_POWER)
        self._write(_LED_IR, _IR_POWER)
        self._write(_FIFO_WR, 0)
        self._write(_FIFO_OVF, 0)
        self._write(_FIFO_RD, 0)
        return True

    def read_ir(self):
        """(IR samples since the last call, oldest first; samples lost to a full FIFO)."""
        wr = self._read(_FIFO_WR)
        lost = self._read(_FIFO_OVF)
        rd = self._read(_FIFO_RD)
        n = (wr - rd) & (FIFO_DEPTH - 1)
        if n == 0 and lost:
            n = FIFO_DEPTH
        if not n:
            return [], 0
        raw = self._i2c.readfrom_mem(self._addr, _FIFO_DATA, n * 6)
        out = []
        for i in range(0, len(raw) - 5, 6):
            out.append(((raw[i + 3] << 16) | (raw[i + 4] << 8) | raw[i + 5]) & 0x3FFFF)
        return out, lost
