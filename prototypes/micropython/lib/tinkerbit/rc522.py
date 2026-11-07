# MFRC522 (RC522) card reader on SPI: just enough of ISO 14443-A to read a card's UID,
# in the same steps as the Arduino MFRC522 library (PICC_IsNewCardPresent, PICC_ReadCardSerial,
# PICC_HaltA). Pins come from the caller (tinkerbit.Rfid reads them from board.py).
import time

_COMMAND = 0x01
_COM_IRQ = 0x04
_DIV_IRQ = 0x05
_ERROR = 0x06
_FIFO_DATA = 0x09
_FIFO_LEVEL = 0x0A
_CONTROL = 0x0C
_BIT_FRAMING = 0x0D
_COLL = 0x0E
_MODE = 0x11
_TX_MODE = 0x12
_RX_MODE = 0x13
_TX_CONTROL = 0x14
_TX_ASK = 0x15
_CRC_H = 0x21
_CRC_L = 0x22
_MOD_WIDTH = 0x24
_T_MODE = 0x2A
_T_PRESCALER = 0x2B
_T_RELOAD_H = 0x2C
_T_RELOAD_L = 0x2D
_VERSION = 0x37

_IDLE = 0x00
_CALC_CRC = 0x03
_TRANSCEIVE = 0x0C
_SOFT_RESET = 0x0F

_REQA = 0x26
_HALT = 0x50
_CASCADE_TAG = 0x88
_SELECT = (0x93, 0x95, 0x97)

# Genuine chips report 0x91 or 0x92; common clones 0x88, 0x12 or 0xB2. 0x00 and 0xFF mean no reader.
_NO_READER = (0x00, 0xFF)

# The chip's own timer gives up after 25 ms; this is the Python-side limit on top of it.
_WAIT_MS = 40


class RC522:
    def __init__(self, spi, cs, rst):
        self._spi = spi
        self._cs = cs
        self._rst = rst
        self._buf = bytearray(2)
        self._out = bytearray(2)

    def _write(self, reg, value):
        self._out[0] = (reg << 1) & 0x7E
        self._out[1] = value & 0xFF
        self._cs.value(0)
        self._spi.write(self._out)
        self._cs.value(1)

    def _read(self, reg):
        self._out[0] = ((reg << 1) & 0x7E) | 0x80
        self._out[1] = 0
        self._cs.value(0)
        self._spi.write_readinto(self._out, self._buf)
        self._cs.value(1)
        return self._buf[1]

    def _set(self, reg, mask):
        self._write(reg, self._read(reg) | mask)

    def _clear(self, reg, mask):
        self._write(reg, self._read(reg) & ~mask)

    def begin(self):
        """Reset and set up the reader like PCD_Init. False when no reader answers."""
        self._rst.value(0)
        time.sleep_ms(2)
        self._rst.value(1)
        time.sleep_ms(50)
        if self._read(_VERSION) in _NO_READER:
            return False
        self._write(_COMMAND, _SOFT_RESET)
        time.sleep_ms(50)
        self._write(_TX_MODE, 0x00)
        self._write(_RX_MODE, 0x00)
        self._write(_MOD_WIDTH, 0x26)
        # Timer: starts after every send, gives up after 25 ms.
        self._write(_T_MODE, 0x80)
        self._write(_T_PRESCALER, 0xA9)
        self._write(_T_RELOAD_H, 0x03)
        self._write(_T_RELOAD_L, 0xE8)
        self._write(_TX_ASK, 0x40)
        self._write(_MODE, 0x3D)
        self._set(_TX_CONTROL, 0x03)
        return True

    def present(self):
        """False when the reader stopped answering (cable pulled)."""
        return self._read(_VERSION) not in _NO_READER

    def _crc(self, data):
        self._write(_COMMAND, _IDLE)
        self._write(_DIV_IRQ, 0x04)
        self._write(_FIFO_LEVEL, 0x80)
        for b in data:
            self._write(_FIFO_DATA, b)
        self._write(_COMMAND, _CALC_CRC)
        end = time.ticks_add(time.ticks_ms(), _WAIT_MS)
        while not self._read(_DIV_IRQ) & 0x04:
            if time.ticks_diff(end, time.ticks_ms()) <= 0:
                return None
        self._write(_COMMAND, _IDLE)
        return bytes((self._read(_CRC_L), self._read(_CRC_H)))

    def _transceive(self, data, bits=0):
        """Send to the card and return its answer, or None (no card, timeout or a garbled answer)."""
        self._write(_COMMAND, _IDLE)
        self._write(_COM_IRQ, 0x7F)
        self._write(_FIFO_LEVEL, 0x80)
        for b in data:
            self._write(_FIFO_DATA, b)
        self._write(_BIT_FRAMING, bits)
        self._write(_COMMAND, _TRANSCEIVE)
        self._set(_BIT_FRAMING, 0x80)
        end = time.ticks_add(time.ticks_ms(), _WAIT_MS)
        while True:
            irq = self._read(_COM_IRQ)
            if irq & 0x30:
                break
            if irq & 0x01 or time.ticks_diff(end, time.ticks_ms()) <= 0:
                self._clear(_BIT_FRAMING, 0x80)
                return None
        self._clear(_BIT_FRAMING, 0x80)
        # Buffer overflow, parity, protocol or collision error.
        if self._read(_ERROR) & 0x1B:
            return None
        n = self._read(_FIFO_LEVEL)
        return bytes([self._read(_FIFO_DATA) for _ in range(n)])

    def _select(self, level, part):
        frame = bytes((_SELECT[level], 0x70)) + part
        crc = self._crc(frame)
        if crc is None:
            return None
        sak = self._transceive(frame + crc)
        return sak[0] if sak and len(sak) == 3 else None

    def read_uid(self):
        """UID bytes of a card that was just put on the reader, else None. The card is then
        halted, so a card left on the reader is read once, as with the Arduino library."""
        self._clear(_COLL, 0x80)
        atqa = self._transceive(bytes((_REQA,)), 0x07)
        if not atqa or len(atqa) != 2:
            return None
        uid = b""
        for level in range(3):
            self._write(_BIT_FRAMING, 0x00)
            part = self._transceive(bytes((_SELECT[level], 0x20)))
            if not part or len(part) != 5 or part[0] ^ part[1] ^ part[2] ^ part[3] != part[4]:
                return None
            sak = self._select(level, part)
            if sak is None:
                return None
            if not sak & 0x04:
                uid += part[:4]
                break
            if part[0] != _CASCADE_TAG:
                return None
            uid += part[1:4]
        else:
            return None
        self.halt()
        return uid

    def halt(self):
        frame = bytes((_HALT, 0x00))
        crc = self._crc(frame)
        if crc is not None:
            # A halted card does not answer: the timeout is the expected result.
            self._transceive(frame + crc)
