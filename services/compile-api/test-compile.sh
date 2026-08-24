#!/bin/bash
set -e
mkdir -p /tmp/testsketch
cat > /tmp/testsketch/testsketch.ino << 'EOF'
void setup() {}
void loop() {}
EOF
cd /tmp/testsketch
/opt/openblock-link/tools/Arduino/arduino-cli --config-file /opt/openblock-link/tools/Arduino/arduino-cli.yaml compile -b arduino:avr:uno
find /tmp/testsketch -name '*.hex'
