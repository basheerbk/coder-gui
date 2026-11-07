# Default TinkerBit program: short blink, report the board, exit (under 1 s).
import tinkerbit

led = tinkerbit.Led("D13")
led.blink(100, 2)
tinkerbit.info()
