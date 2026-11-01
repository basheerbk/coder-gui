#!/bin/bash
# One-time (and safely re-runnable) setup of TinkerBit Cloud on the shared EC2 box.
# Supports Ubuntu (Mosquitto from the mosquitto-dev PPA) and Amazon Linux 2023
# (Mosquitto has no AL2023 package, so it runs from the official container image
# behind a systemd unit that is still called "mosquitto").
# Run as root from the unpacked service directory, e.g.:
#   sudo bash deploy/install-on-ec2.sh --email ops@tinkerbit.io
# Prerequisites (see readme.md): Elastic IP attached, DNS A record api.tinkerbit.io -> that IP,
# security group open for 80, 443 and 8883.
set -euo pipefail

DOMAIN="api.tinkerbit.io"
EMAIL=""
SKIP_DNS_CHECK=0
NODE_VERSION="${NODE_VERSION:-22.15.1}"
# Pinned: the service speaks the Mosquitto 2.0 dynamic-security API; -openssl builds TLS with OpenSSL.
MOSQ_IMAGE="${MOSQ_IMAGE:-eclipse-mosquitto:2.0.22-openssl}"
while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --skip-dns-check) SKIP_DNS_CHECK=1; shift ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE=/opt/tinkerbit-iot
ENV_FILE=/etc/tinkerbit-iot/env
DYNSEC=/var/lib/mosquitto/dynamic-security.json

log() { echo; echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root (sudo)"
[ -n "$EMAIL" ] || die "--email is required (Let's Encrypt expiry notices)"
. /etc/os-release
case "$ID" in
  ubuntu) OS=ubuntu ;;
  amzn) [ "${VERSION_ID%%.*}" = 2023 ] || die "expected Amazon Linux 2023, found $PRETTY_NAME"; OS=amzn ;;
  *) die "expected Ubuntu or Amazon Linux 2023, found $ID" ;;
esac
NOLOGIN="$(command -v nologin || echo /usr/sbin/nologin)"

nginx_reload() {
  nginx -t
  systemctl enable nginx >/dev/null 2>&1 || true
  if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi
}
if [ "$OS" = ubuntu ]; then
  NGINX_SITE=/etc/nginx/sites-available/tinkerbit-iot
  enable_site() { ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/tinkerbit-iot; }
else
  NGINX_SITE=/etc/nginx/conf.d/tinkerbit-iot.conf
  enable_site() { :; }
fi

FREE_MB="$(df -Pm / | awk 'NR==2{print $4}')"
[ "${FREE_MB:-0}" -ge 1024 ] || die "only ${FREE_MB} MB free on /; grow the EBS volume first (need 1 GB+)"

log "Preflight: DNS for $DOMAIN"
PUBLIC_IP="$(curl -fsS -m 3 -H "X-aws-ec2-metadata-token: $(curl -fsS -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)" http://169.254.169.254/latest/meta-data/public-ipv4 || curl -fsS -m 5 https://checkip.amazonaws.com || true)"
RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
echo "public IP: ${PUBLIC_IP:-unknown}  $DOMAIN -> ${RESOLVED:-unresolved}"
if [ "$SKIP_DNS_CHECK" = 0 ] && [ "${PUBLIC_IP:-x}" != "${RESOLVED:-y}" ]; then
  die "$DOMAIN must resolve to this server before certificates can be issued (or pass --skip-dns-check)"
fi

log "Packages"
if [ "$OS" = ubuntu ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q software-properties-common curl ca-certificates nginx certbot sqlite3 xz-utils
  if ! apt-cache policy mosquitto | grep -q mosquitto-dev; then
    add-apt-repository -y ppa:mosquitto-dev/mosquitto-ppa
    apt-get update -q
  fi
  apt-get install -y -q mosquitto mosquitto-clients
  MOSQ_CTRL=(mosquitto_ctrl)
  MOSQ_VERSION="$(mosquitto -h 2>/dev/null | awk '/version/{print $3; exit}' || true)"
else
  dnf install -y -q nginx certbot sqlite tar xz openssl docker
  systemctl enable --now docker
  # The image runs the broker as uid/gid 1883; matching host ids keep file ownership readable.
  getent group mosquitto >/dev/null || groupadd --system --gid 1883 mosquitto
  id mosquitto >/dev/null 2>&1 || useradd --system --uid 1883 --gid mosquitto --home-dir /var/lib/mosquitto --shell "$NOLOGIN" mosquitto
  [ "$(id -u mosquitto)" = 1883 ] && [ "$(getent group mosquitto | cut -d: -f3)" = 1883 ] \
    || die "host user and group 'mosquitto' must both be 1883 to match the container"
  install -d -m 0755 /etc/mosquitto /etc/mosquitto/conf.d
  install -d -m 0750 -o mosquitto -g mosquitto /var/lib/mosquitto
  docker pull -q "$MOSQ_IMAGE"
  MOSQ_CTRL=(docker run --rm --network host --user 1883:1883 --security-opt label=disable
    -v /var/lib/mosquitto:/var/lib/mosquitto "$MOSQ_IMAGE" mosquitto_ctrl)
  MOSQ_VERSION="$(docker run --rm "$MOSQ_IMAGE" mosquitto -h 2>/dev/null | awk '/version/{print $3; exit}' || true)"
fi
echo "mosquitto $MOSQ_VERSION"
case "$MOSQ_VERSION" in 2.*) ;; *) die "Mosquitto 2.x required for dynamic security" ;; esac

log "Node $NODE_VERSION (private copy for this service; system node is untouched)"
if [ ! -x "$BASE/node/bin/node" ] || [ "$("$BASE/node/bin/node" -v)" != "v$NODE_VERSION" ]; then
  ARCH="$(uname -m)"; case "$ARCH" in x86_64) NARCH=x64 ;; aarch64) NARCH=arm64 ;; *) die "unsupported arch $ARCH" ;; esac
  TARBALL="node-v$NODE_VERSION-linux-$NARCH.tar.xz"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/$TARBALL" "https://nodejs.org/dist/v$NODE_VERSION/$TARBALL"
  curl -fsSL -o "$TMP/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  (cd "$TMP" && grep " $TARBALL\$" SHASUMS256.txt | sha256sum -c -) || die "Node tarball checksum mismatch"
  install -d "$BASE"
  rm -rf "$BASE/node.new"
  install -d "$BASE/node.new"
  tar -xJf "$TMP/$TARBALL" -C "$BASE/node.new" --strip-components=1
  rm -rf "$BASE/node"
  mv "$BASE/node.new" "$BASE/node"
  rm -rf "$TMP"
fi
"$BASE/node/bin/node" -e "require('node:sqlite')" || die "node:sqlite unavailable in this Node build"

log "Service user and directories"
id tinkerbit-iot >/dev/null 2>&1 || useradd --system --home /var/lib/tinkerbit-iot --shell "$NOLOGIN" tinkerbit-iot
install -d -m 0755 "$BASE" "$BASE/releases"
install -d -m 0750 -o tinkerbit-iot -g tinkerbit-iot /var/lib/tinkerbit-iot
install -d -m 0700 /var/backups/tinkerbit-iot
install -d -m 0750 -o root -g tinkerbit-iot /etc/tinkerbit-iot
install -d -m 0755 /var/www/letsencrypt

gen() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40; }
if [ ! -f "$ENV_FILE" ]; then
  log "Generating $ENV_FILE (paste AUTH_SECRET and IOT_ALLOWLIST afterwards)"
  sed -e "s|^MQTT_INGEST_PASS=.*|MQTT_INGEST_PASS=$(gen)|" \
      -e "s|^MQTT_ADMIN_PASS=.*|MQTT_ADMIN_PASS=$(gen)|" \
      -e "s|^IOT_PUBLIC_HOST=.*|IOT_PUBLIC_HOST=$DOMAIN|" \
      -e "s|^IOT_LIVE_URL=.*|IOT_LIVE_URL=wss://$DOMAIN/iot/v1/live|" \
      "$SCRIPT_DIR/env.example" > "$ENV_FILE"
fi
chown root:tinkerbit-iot "$ENV_FILE"
chmod 0640 "$ENV_FILE"
envget() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }
ADMIN_USER="$(envget MQTT_ADMIN_USER)"; ADMIN_PASS="$(envget MQTT_ADMIN_PASS)"
INGEST_USER="$(envget MQTT_INGEST_USER)"; INGEST_PASS="$(envget MQTT_INGEST_PASS)"
[ -n "$ADMIN_PASS" ] && [ -n "$INGEST_PASS" ] || die "MQTT passwords missing in $ENV_FILE"

log "TLS certificate for $DOMAIN (RSA, so every ESP32 core can verify it)"
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # HTTP-only bootstrap; replaced by the full site below once the certificate exists.
  cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 404; }
}
EOF
  enable_site
  nginx_reload
  certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" \
    --key-type rsa --rsa-key-size 2048 --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring
fi
install -D -m 0755 "$SCRIPT_DIR/certbot-deploy-hook.sh" /etc/letsencrypt/renewal-hooks/deploy/tinkerbit-iot.sh
# Ubuntu's package enables certbot.timer itself; Amazon Linux ships certbot-renew.timer disabled.
if [ "$OS" = amzn ]; then
  systemctl enable --now certbot-renew.timer
fi
install -d -m 0750 -o root -g mosquitto /etc/mosquitto/certs
install -m 0644 -o root -g mosquitto "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/mosquitto/certs/fullchain.pem
install -m 0640 -o root -g mosquitto "/etc/letsencrypt/live/$DOMAIN/privkey.pem" /etc/mosquitto/certs/privkey.pem

log "Mosquitto"
if [ "$OS" = ubuntu ]; then
  PLUGIN="$(find /usr/lib /usr/local/lib -name 'mosquitto_dynamic_security.so' 2>/dev/null | head -n1)"
else
  PLUGIN="$(docker run --rm "$MOSQ_IMAGE" sh -c 'ls /usr/lib/mosquitto_dynamic_security.so /usr/local/lib/mosquitto_dynamic_security.so 2>/dev/null | head -n1' || true)"
fi
[ -n "$PLUGIN" ] || die "mosquitto_dynamic_security.so not found"
if [ ! -f "$DYNSEC" ]; then
  "${MOSQ_CTRL[@]}" dynsec init "$DYNSEC" "$ADMIN_USER" "$ADMIN_PASS"
fi
chown mosquitto:mosquitto "$DYNSEC"
chmod 0600 "$DYNSEC"
if [ "$OS" = ubuntu ]; then
  sed "s|@DYNSEC_PLUGIN@|$PLUGIN|" "$SCRIPT_DIR/mosquitto.conf" > /etc/mosquitto/conf.d/tinkerbit.conf
  install -D -m 0644 "$SCRIPT_DIR/mosquitto-override.conf" /etc/systemd/system/mosquitto.service.d/tinkerbit.conf
else
  # No syslog inside the container: log to stdout, which systemd puts in journalctl -u mosquitto.
  sed -e "s|@DYNSEC_PLUGIN@|$PLUGIN|" -e "s|^log_dest syslog|log_dest stdout|" \
    "$SCRIPT_DIR/mosquitto.conf" > /etc/mosquitto/conf.d/tinkerbit.conf
  printf 'include_dir /etc/mosquitto/conf.d\n' > /etc/mosquitto/mosquitto.conf
  sed "s|@MOSQ_IMAGE@|$MOSQ_IMAGE|" "$SCRIPT_DIR/mosquitto-docker.service" > /etc/systemd/system/mosquitto.service
fi
chmod 0644 /etc/mosquitto/conf.d/tinkerbit.conf
systemctl daemon-reload
systemctl enable mosquitto
systemctl restart mosquitto
for _ in $(seq 1 20); do
  "${MOSQ_CTRL[@]}" -h 127.0.0.1 -p 1883 -u "$ADMIN_USER" -P "$ADMIN_PASS" dynsec getDefaultACLAccess >/dev/null 2>&1 && break
  sleep 1
done

ctrl() {
  local out
  out="$("${MOSQ_CTRL[@]}" -h 127.0.0.1 -p 1883 -u "$ADMIN_USER" -P "$ADMIN_PASS" dynsec "$@" 2>&1)" || true
  case "$out" in
    *"already exists"*|*"already has"*|"") ;;
    *rror*) echo "$out"; die "mosquitto_ctrl dynsec $1 failed" ;;
  esac
}
# Devices only receive what their role explicitly allows (tb/<id>/state/#).
ctrl setDefaultACLAccess publishClientReceive deny
ctrl createRole tb-ingest
for t in telemetry status ack alert; do
  ctrl addRoleACL tb-ingest subscribePattern "tb/+/$t" allow 0
  ctrl addRoleACL tb-ingest publishClientReceive "tb/+/$t" allow 0
done
ctrl addRoleACL tb-ingest publishClientSend "tb/+/state/+" allow 0
ctrl addRoleACL tb-ingest publishClientSend "tb/+/status" allow 0
ctrl createClient "$INGEST_USER" -p "$INGEST_PASS"
ctrl setClientPassword "$INGEST_USER" "$INGEST_PASS"
ctrl addClientRole "$INGEST_USER" tb-ingest 0

log "nginx"
install -m 0644 "$SCRIPT_DIR/nginx-iot.conf" "$NGINX_SITE"
sed -i "s/api\.tinkerbit\.io/$DOMAIN/g" "$NGINX_SITE"
enable_site
nginx_reload

log "Firewall"
if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 8883/tcp
else
  echo "ufw inactive; make sure the EC2 security group allows TCP 80, 443 and 8883"
fi

log "systemd units"
install -m 0644 "$SCRIPT_DIR/tinkerbit-iot.service" /etc/systemd/system/tinkerbit-iot.service
install -m 0644 "$SCRIPT_DIR/tinkerbit-iot-backup.service" /etc/systemd/system/tinkerbit-iot-backup.service
install -m 0644 "$SCRIPT_DIR/tinkerbit-iot-backup.timer" /etc/systemd/system/tinkerbit-iot-backup.timer
if systemctl list-unit-files compile-api.service >/dev/null 2>&1; then
  install -D -m 0644 "$SCRIPT_DIR/compile-api-override.conf" /etc/systemd/system/compile-api.service.d/tinkerbit-iot.conf
fi
systemctl daemon-reload
systemctl enable tinkerbit-iot tinkerbit-iot-backup.timer
systemctl start tinkerbit-iot-backup.timer
systemctl try-restart compile-api || true

if [ -z "$(envget AUTH_SECRET)" ]; then
  echo
  echo "AUTH_SECRET is empty in $ENV_FILE. Paste the Vercel AUTH_SECRET (and IOT_ALLOWLIST), then run:"
  echo "  sudo bash $SCRIPT_DIR/release.sh $SRC"
  exit 0
fi

log "Release"
bash "$SCRIPT_DIR/release.sh" "$SRC"

log "Smoke checks"
curl -fsS "https://$DOMAIN/healthz" && echo
timeout 5 openssl s_client -connect "$DOMAIN:8883" -servername "$DOMAIN" </dev/null 2>/dev/null | grep -E "Verify return code" || echo "WARNING: TLS check on 8883 failed"
echo "Done. Next: Vercel env/rewrites, then follow the pilot checklist in readme.md."
