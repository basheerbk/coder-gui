# TinkerBit Stage B manifest. Same content as ports/esp32/boards/manifest.py in
# MicroPython v1.24.1, except that _boot.py is ours (serial safe mode) and the TinkerBit
# library plus the ssd1306 driver are frozen in. Relative paths are relative to this file.

# Port modules, without the stock _boot.py.
freeze("$(PORT_DIR)/modules", ("apa106.py", "espnow.py", "flashbdev.py", "inisetup.py"))
freeze("frozen", "_boot.py")

include("$(MPY_DIR)/extmod/asyncio")

# Useful networking-related packages.
require("bundle-networking")

# Require some micropython-lib modules.
require("aioespnow")
require("dht")
require("ds18x20")
require("neopixel")
require("onewire")
require("umqtt.robust")
require("umqtt.simple")
require("upysh")

# TinkerBit additions.
require("ssd1306")
package("tinkerbit", base_path="../lib")
