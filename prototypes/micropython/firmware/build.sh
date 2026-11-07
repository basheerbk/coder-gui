#!/usr/bin/env bash
# Build TinkerBit Stage B firmware for the classic ESP32 (WROOM-32, 4 MB, no PSRAM).
#   MicroPython v1.24.1, board ESP32_GENERIC, ESP-IDF v5.2.2 (pinned Docker image)
#   + frozen tinkerbit library, ssd1306, our _boot.py (manifest.py)
#   + C modules tbsys (ADC sampler, safe mode) and tbcloud (esp-mqtt) (cmodules/)
# Output: firmware/build/tinkerbit-stage-b-esp32.bin, written at 0x1000.
# Needs Docker. On Windows run it from WSL or Git Bash with Docker Desktop.
set -euo pipefail

IDF_IMAGE="espressif/idf:v5.2.2"
MPY_TAG="v1.24.1"
BOARD="ESP32_GENERIC"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO="$(dirname "$HERE")"
OUT="$HERE/build"
mkdir -p "$OUT"

docker run --rm \
  -v "$PROTO":/proto:ro \
  -v "$OUT":/out \
  -e MPY_TAG="$MPY_TAG" -e BOARD="$BOARD" \
  "$IDF_IMAGE" \
  bash -c '
set -euo pipefail
git clone --depth 1 --branch "$MPY_TAG" https://github.com/micropython/micropython.git /mp
make -C /mp/mpy-cross -j"$(nproc)"
cd /mp/ports/esp32
make submodules BOARD="$BOARD"
make -j"$(nproc)" BOARD="$BOARD" \
  FROZEN_MANIFEST=/proto/firmware/manifest.py \
  USER_C_MODULES=/proto/firmware/cmodules/micropython.cmake
cp "build-$BOARD/firmware.bin" /out/tinkerbit-stage-b-esp32.bin
idf.py -B "build-$BOARD" size > /out/size.txt 2>&1 || true
'

echo "Firmware: $OUT/tinkerbit-stage-b-esp32.bin (write at 0x1000)"
echo "Sizes:    $OUT/size.txt"
