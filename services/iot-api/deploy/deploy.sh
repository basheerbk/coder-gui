#!/bin/bash
# Ship the IoT service to EC2 and switch to it (auto-rollback if it is not ready).
# Run from the repo root (Git Bash / WSL / macOS / Linux):
#   ./services/iot-api/deploy/deploy.sh ec2-user@13.127.144.30 path/to/key.pem            # release
#   ./services/iot-api/deploy/deploy.sh ec2-user@13.127.144.30 path/to/key.pem --install --email ops@tinkerbit.io
# (Amazon Linux logs in as ec2-user, Ubuntu as ubuntu.)
set -euo pipefail

HOST="${1:?EC2 host required, e.g. ec2-user@13.127.144.30}"
KEY="${2:?SSH key path required}"
shift 2
MODE=release
INSTALL_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --install) MODE=install; shift ;;
    *) INSTALL_ARGS+=("$1"); shift ;;
  esac
done

DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PKG="tinkerbit-iot-$STAMP.tar.gz"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
SCP=(scp -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

echo "Running tests before shipping..."
(cd "$DIR" && npm test --silent)

tar -czf "/tmp/$PKG" -C "$DIR" src tools deploy package.json package-lock.json
"${SCP[@]}" "/tmp/$PKG" "$HOST:/tmp/$PKG"
rm -f "/tmp/$PKG"

"${SSH[@]}" "$HOST" bash -s -- "$PKG" "$MODE" "${INSTALL_ARGS[@]}" <<'REMOTE'
set -euo pipefail
PKG="$1"; MODE="$2"; shift 2
WORK="/tmp/${PKG%.tar.gz}"
mkdir -p "$WORK"
tar -xzf "/tmp/$PKG" -C "$WORK"
if [ "$MODE" = install ]; then
  sudo bash "$WORK/deploy/install-on-ec2.sh" "$@"
else
  sudo bash "$WORK/deploy/release.sh" "$WORK"
fi
rm -rf "$WORK" "/tmp/$PKG"
REMOTE
