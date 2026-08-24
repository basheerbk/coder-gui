#!/bin/bash
# Run on EC2 from directory containing server.js (e.g. after scp to /tmp/compile-api/)
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/compile-api /etc/compile-api
sudo cp "$SCRIPT_DIR/server.js" /opt/compile-api/server.js
sudo chown -R openblock:openblock /opt/compile-api

sudo mkdir -p /var/lib/compile-api/Arduino/libraries
sudo chown -R openblock:openblock /var/lib/compile-api

sudo tee /etc/compile-api/env >/dev/null <<'EOF'
COMPILE_PORT=20113
ARDUINO_CLI=/opt/openblock-link/tools/Arduino/arduino-cli
ARDUINO_CONFIG=/opt/openblock-link/tools/Arduino/arduino-cli.yaml
ARDUINO_DATA=/opt/openblock-link/tools/Arduino
ARDUINO_HOME=/var/lib/compile-api
HOME=/var/lib/compile-api
EOF

sudo tee /etc/systemd/system/compile-api.service >/dev/null <<'EOF'
[Unit]
Description=Tingaroo Arduino Compile API
After=network.target

[Service]
Type=simple
User=openblock
Group=openblock
WorkingDirectory=/opt/compile-api
EnvironmentFile=/etc/compile-api/env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=compile-api

[Install]
WantedBy=multi-user.target
EOF

sudo cp "$SCRIPT_DIR/nginx-openblock-link.conf" /etc/nginx/sites-available/openblock-link
sudo ln -sf /etc/nginx/sites-available/openblock-link /etc/nginx/sites-enabled/openblock-link
sudo nginx -t
sudo systemctl reload nginx

sudo systemctl daemon-reload
sudo systemctl enable compile-api
sudo systemctl restart compile-api

# ESP32 core (needed for browser ESP32 upload)
if [ -x "$ARDUINO_CLI" ] || [ -x /opt/openblock-link/tools/Arduino/arduino-cli ]; then
  CLI="${ARDUINO_CLI:-/opt/openblock-link/tools/Arduino/arduino-cli}"
  CFG="${ARDUINO_CONFIG:-/opt/openblock-link/tools/Arduino/arduino-cli.yaml}"
  sudo -u openblock env HOME=/var/lib/compile-api \
    ARDUINO_DIRECTORIES_DATA=/opt/openblock-link/tools/Arduino \
    ARDUINO_DIRECTORIES_DOWNLOADS=/opt/openblock-link/tools/Arduino/staging \
    ARDUINO_DIRECTORIES_USER=/var/lib/compile-api/Arduino \
    "$CLI" --config-file "$CFG" config add board_manager.additional_urls \
      https://espressif.github.io/arduino-esp32/package_esp32_index.json || true
  sudo -u openblock env HOME=/var/lib/compile-api \
    ARDUINO_DIRECTORIES_DATA=/opt/openblock-link/tools/Arduino \
    ARDUINO_DIRECTORIES_DOWNLOADS=/opt/openblock-link/tools/Arduino/staging \
    ARDUINO_DIRECTORIES_USER=/var/lib/compile-api/Arduino \
    "$CLI" --config-file "$CFG" core update-index
  sudo -u openblock env HOME=/var/lib/compile-api \
    ARDUINO_DIRECTORIES_DATA=/opt/openblock-link/tools/Arduino \
    ARDUINO_DIRECTORIES_DOWNLOADS=/opt/openblock-link/tools/Arduino/staging \
    ARDUINO_DIRECTORIES_USER=/var/lib/compile-api/Arduino \
    "$CLI" --config-file "$CFG" core install esp32:esp32
  sudo -u openblock env HOME=/var/lib/compile-api \
    ARDUINO_DIRECTORIES_DATA=/opt/openblock-link/tools/Arduino \
    ARDUINO_DIRECTORIES_DOWNLOADS=/opt/openblock-link/tools/Arduino/staging \
    ARDUINO_DIRECTORIES_USER=/var/lib/compile-api/Arduino \
    "$CLI" --config-file "$CFG" lib install "Blynk"
fi

echo "Health:"
curl -s http://127.0.0.1/api/compile/health
echo
