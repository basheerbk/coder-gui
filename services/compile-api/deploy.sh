#!/bin/bash
# Deploy compile API to EC2 (run from repo root on your machine).
# Usage: ./services/compile-api/deploy.sh ubuntu@13.217.19.72 path/to/key.pem

set -e
HOST="${1:?EC2 host required, e.g. ubuntu@13.217.19.72}"
KEY="${2:?SSH key path required}"
REMOTE_DIR="/opt/compile-api"

ssh -i "$KEY" -o BatchMode=yes "$HOST" "sudo mkdir -p $REMOTE_DIR && sudo chown ubuntu:ubuntu $REMOTE_DIR"
scp -i "$KEY" -o BatchMode=yes services/compile-api/server.js services/compile-api/package.json "$HOST:$REMOTE_DIR/"

ssh -i "$KEY" -o BatchMode=yes "$HOST" bash -s << 'REMOTE'
set -e
sudo tee /etc/compile-api/env >/dev/null << 'ENV'
COMPILE_PORT=20113
ARDUINO_CLI=/opt/openblock-link/tools/Arduino/arduino-cli
ARDUINO_CONFIG=/opt/openblock-link/tools/Arduino/arduino-cli.yaml
ENV
sudo cp /opt/compile-api/../compile-api/compile-api.service 2>/dev/null || true
REMOTE

echo "Copy systemd unit manually if needed, then:"
echo "  sudo cp compile-api.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload && sudo systemctl enable --now compile-api"
