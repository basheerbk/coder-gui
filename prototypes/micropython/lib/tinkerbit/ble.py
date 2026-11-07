# Bluetooth LE peripheral with the same service as Beginner Studio's Arduino code, so phone
# apps that worked with it keep working: one characteristic (read, write, notify), at most
# 20 bytes a value, starting at "ready".
import bluetooth

SERVICE = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
CHARACTERISTIC = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
VALUE_MAX = 20
NAME_MAX = 29

_FLAG_READ = 0x0002
_FLAG_WRITE = 0x0008
_FLAG_NOTIFY = 0x0010

_IRQ_CENTRAL_CONNECT = 1
_IRQ_CENTRAL_DISCONNECT = 2

_ADV_INTERVAL_US = 100000


def _field(kind, value):
    return bytes((len(value) + 1, kind)) + value


def clip_utf8(text, limit):
    """text as UTF-8, at most limit bytes, never cut inside a character."""
    data = str(text).encode()
    if len(data) <= limit:
        return data
    end = limit
    while end > 0 and data[end] & 0xC0 == 0x80:
        end -= 1
    return data[:end]


class Peripheral:
    def __init__(self):
        self._ble = bluetooth.BLE()
        self._ble.active(True)
        self._ble.irq(self._irq)
        ((self._handle,),) = self._ble.gatts_register_services((
            (bluetooth.UUID(SERVICE), ((bluetooth.UUID(CHARACTERISTIC), _FLAG_READ | _FLAG_WRITE | _FLAG_NOTIFY),)),
        ))
        self._ble.gatts_write(self._handle, b"ready")
        self._conns = set()
        self._name = None
        self._advertising = False

    def _irq(self, event, data):
        if event == _IRQ_CENTRAL_CONNECT:
            self._conns.add(data[0])
            self._advertising = False
        elif event == _IRQ_CENTRAL_DISCONNECT:
            self._conns.discard(data[0])
            if self._name is not None:
                self._advertise()

    def _advertise(self):
        name = clip_utf8(self._name, NAME_MAX)
        self._ble.config(gap_name=name)
        adv = _field(0x01, b"\x06") + _field(0x07, bytes(bluetooth.UUID(SERVICE)))
        # The name goes in the scan response: next to the 128-bit service UUID it would only fit 8 bytes.
        self._ble.gap_advertise(_ADV_INTERVAL_US, adv_data=adv, resp_data=_field(0x09, name))
        self._advertising = True

    def advertise(self, name):
        """Show up on phones as name. A connected phone stays connected; a new name
        shows after it disconnects."""
        name = str(name)
        if name == self._name and (self._advertising or self._conns):
            return
        self._name = name
        if not self._conns:
            self._advertise()

    def send(self, text):
        """Set the value (first 20 bytes) and notify connected phones."""
        data = clip_utf8(text, VALUE_MAX)
        self._ble.gatts_write(self._handle, data)
        for conn in list(self._conns):
            try:
                self._ble.gatts_notify(conn, self._handle, data)
            except OSError:
                self._conns.discard(conn)
        return data

    def connected(self):
        return bool(self._conns)

    def close(self):
        try:
            self._ble.gap_advertise(None)
        except OSError:
            pass
        self._ble.active(False)
        self._conns = set()
        self._advertising = False
