# TinkerBit Maker ESP32 RJ11 hub: the only file that knows GPIO numbers.
# Source of truth: ARCHITECTURE.md section 3 (jack map and rules).

BOARD = "TinkerBit Maker ESP32"
REV = "rj11-1"
MCU = "ESP32-WROOM-32"

# I2C runs at 100 kHz: the MAX30102 heartbeat sensor fails at 400 kHz.
I2C_FREQ = 100000

# kind: what the jack can carry.
#   io      one signal wire: on/off parts, PWM, DHT (D13 and A1-A4)
#   ultra   HC-SR04 only (trig + echo)
#   i2c     shared I2C bus
#   spi     RFID RC522
#   motor   L293D or 4-ch relay (active-low)
#   stepper 4-wire stepper
#   uart    HC-05, shares UART0 with USB serial and the REPL
#   onboard BLE / WiFi, no wire
# adc2: the jack reads through ADC2, which stops working while WiFi is on.
# strap: a strapping pin, its level at reset changes how the chip boots.
# boot: GPIO 0, holding it LOW at reset enters download mode.
JACKS = {
    "D13": {"kind": "io", "pins": {"sig": 33}, "shares": ("3D",)},
    "3D": {"kind": "spi", "pins": {"ss": 32, "rst": 33, "miso": 34, "sck": 16, "mosi": 23}, "shares": ("D13",)},
    "D5": {"kind": "ultra", "pins": {"trig": 26, "echo": 25}},
    "ST": {"kind": "stepper", "pins": {"in1": 12, "in2": 13, "in3": 14, "in4": 27}, "strap": True},
    "MD": {"kind": "motor", "pins": {"a1": 17, "a2": 5, "b1": 18, "b2": 19}, "active_low": True},
    "I2C": {"kind": "i2c", "pins": {"sda": 21, "scl": 22}, "bus": "I2C"},
    "I2C1": {"kind": "i2c", "pins": {"sda": 21, "scl": 22}, "bus": "I2C"},
    "A1": {"kind": "io", "pins": {"sig": 4}, "adc2": True},
    "A2": {"kind": "io", "pins": {"sig": 15}, "adc2": True, "strap": True},
    "A3": {"kind": "io", "pins": {"sig": 2}, "adc2": True, "strap": True},
    "A4": {"kind": "io", "pins": {"sig": 0}, "adc2": True, "strap": True, "boot": True},
    "UART": {"kind": "uart", "pins": {"rx": 3, "tx": 1}, "uart": 0},
    "ESP": {"kind": "onboard", "pins": {}},
}

# Pins driven HIGH at begin() and stop_all(): the 4-ch relay is active-low, and HIGH on
# both L293D inputs brakes the motors.
SAFE_HIGH = ("MD",)

JACK_NAMES = tuple(JACKS)


def jack(name):
    return JACKS.get(name)


def pin(name, role="sig"):
    return JACKS[name]["pins"][role]
