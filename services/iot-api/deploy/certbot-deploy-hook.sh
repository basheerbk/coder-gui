#!/bin/bash
# /etc/letsencrypt/renewal-hooks/deploy/tinkerbit-iot.sh
# Mosquitto runs as the "mosquitto" user and cannot read /etc/letsencrypt, so copy
# the renewed certificate where it can, then reload (SIGHUP re-reads certificates).
set -euo pipefail

DOMAIN="api.tinkerbit.io"
case " ${RENEWED_DOMAINS:-$DOMAIN} " in
  *" $DOMAIN "*) ;;
  *) exit 0 ;;
esac

SRC="${RENEWED_LINEAGE:-/etc/letsencrypt/live/$DOMAIN}"
DEST=/etc/mosquitto/certs

install -d -m 0750 -o root -g mosquitto "$DEST"
install -m 0644 -o root -g mosquitto "$SRC/fullchain.pem" "$DEST/fullchain.pem"
install -m 0640 -o root -g mosquitto "$SRC/privkey.pem" "$DEST/privkey.pem"

systemctl reload mosquitto || systemctl restart mosquitto
systemctl reload nginx
logger -t tinkerbit-iot "certificate for $DOMAIN deployed to mosquitto and nginx"
