#!/bin/bash
# Install one release of the IoT service on the server and switch to it, rolling back
# automatically if the new release does not become ready.
# Usage (as root): release.sh /path/to/unpacked/iot-api
set -euo pipefail

SRC="${1:?unpacked service directory required}"
BASE=/opt/tinkerbit-iot
NODE="$BASE/node/bin/node"
NPM="$BASE/node/bin/npm"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BASE/releases/$STAMP"
KEEP=5
PORT="$(grep -E '^IOT_PORT=' /etc/tinkerbit-iot/env | cut -d= -f2 || true)"
PORT="${PORT:-20114}"

log() { echo "[release] $*"; }

[ -x "$NODE" ] || { echo "Node not installed at $NODE (run install-on-ec2.sh)"; exit 1; }

log "installing $STAMP"
install -d -m 0755 "$DEST"
cp -r "$SRC/src" "$SRC/tools" "$SRC/deploy" "$SRC/package.json" "$SRC/package-lock.json" "$DEST/"
(cd "$DEST" && PATH="$BASE/node/bin:$PATH" "$NPM" ci --omit=dev --no-audit --no-fund --loglevel=error)
chown -R root:root "$DEST"
chmod -R go-w "$DEST"

log "checking configuration"
sudo -u tinkerbit-iot bash -c 'set -a; . /etc/tinkerbit-iot/env; set +a; exec "$0" --disable-warning=ExperimentalWarning "$1" --check-config' \
  "$NODE" "$DEST/src/main.js"

PREV=""
if [ -L "$BASE/current" ]; then
  PREV="$(readlink -f "$BASE/current")"
  if [ -f /var/lib/tinkerbit-iot/iot.db ]; then
    log "pre-deploy backup"
    systemctl start tinkerbit-iot-backup.service || log "WARNING: pre-deploy backup failed (continuing)"
  fi
fi

ln -sfn "$DEST" "$BASE/current.new"
mv -T "$BASE/current.new" "$BASE/current"
systemctl restart tinkerbit-iot

ready() {
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/readyz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ready; then
  log "release $STAMP is live"
else
  log "release $STAMP did not become ready"
  journalctl -u tinkerbit-iot -n 40 --no-pager || true
  if [ -n "$PREV" ]; then
    log "rolling back to $(basename "$PREV")"
    ln -sfn "$PREV" "$BASE/current.new"
    mv -T "$BASE/current.new" "$BASE/current"
    systemctl restart tinkerbit-iot
    ready && log "rollback ready" || log "ROLLBACK ALSO FAILED - investigate now"
  fi
  exit 1
fi

# Keep the newest $KEEP releases (never the one that is live).
LIVE="$(readlink -f "$BASE/current")"
ls -1d "$BASE"/releases/*/ 2>/dev/null | sed 's:/$::' | sort | head -n -"$KEEP" | while read -r old; do
  [ "$old" = "$LIVE" ] || rm -rf "$old"
done
