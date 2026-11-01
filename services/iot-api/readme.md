# TinkerBit Cloud (IoT API + MQTT broker)

Boards running Studio-generated firmware talk MQTT to Mosquitto on `api.tinkerbit.io`.
This service owns devices, readings, controls, dashboards, rules and alerts, and serves
the `/iot` web app through the Vercel rewrite `/api/iot/*` -> `https://api.tinkerbit.io/iot/v1/*`.

```
board ──mqtts:8883──┐                       ┌── /iot/v1/*  (Vercel rewrite, tb_session cookie)
board ──wss:443/mqtt┤ nginx ─► Mosquitto ◄──┤ tinkerbit-iot (Node 22, SQLite WAL)
                    │         (dynsec)      └── /iot/v1/live (WebSocket, single-use ticket)
```

## Topics (per device `<id>`, ACL-scoped to `tb/<id>/#`)

| Topic | Dir | QoS / retain | Payload |
|---|---|---|---|
| `tb/<id>/telemetry` | board → cloud | 0 | `{"seq":12,"boot":"9f2a","v":{"temp":23.5}}` |
| `tb/<id>/status` | board → cloud | 1, retained | `{"s":"online","fw":"…","rssi":-61,"boot":"9f2a","tr":"mqtts"}` or last will `offline` |
| `tb/<id>/state/<key>` | cloud → board | 1, retained | `{"v":1,"ver":7,"fs":120,"fv":0}` (`switch1..4`, `slider1..2`) |
| `tb/<id>/ack` | board → cloud | 1 | `{"key":"switch1","ver":7}` |
| `tb/<id>/alert` | board → cloud | 1 | text, ≤120 chars |

## Local development

```bash
cd services/iot-api
npm install
npm test
AUTH_SECRET=<same as site .env> IOT_BROKER_MODE=none npm start   # API only, no broker
```

With a local Mosquitto (Docker or native) use `IOT_BROKER_MODE=mosquitto` and the
`MQTT_*` variables from `deploy/env.example`. The webpack dev server (`npm start` in the
repo root, port 8601) proxies `/api/iot` to `http://127.0.0.1:20114/iot/v1`, so Beginner
Studio's Cloud setup and `/iot` work against this service. Outside production the live
socket URL defaults to `ws://127.0.0.1:20114/iot/v1/live` (the dev CSP allows it).
Without the site's auth API running, the browser has no session cookie and the API
answers 401; use the real sign-in locally or `AUTH_DISABLED=1` for UI work.

## Production prerequisites (one time)

1. **Elastic IP** attached to the EC2 instance (boards and DNS must not chase a changing IP).
2. **DNS**: `A api.tinkerbit.io -> <Elastic IP>`.
3. **Security group**: inbound TCP 80, 443, 8883 (keep 22 restricted to your IP).
4. **S3 bucket** for backups (versioning + 90-day lifecycle) and an **instance role**
   allowing `s3:PutObject` on `arn:aws:s3:::<bucket>/tinkerbit-iot/*`.
5. **Vercel**: `AUTH_SECRET` must match `/etc/tinkerbit-iot/env`; the rewrites in
   `vercel.json` must be deployed.

## Install / upgrade

```bash
# first time (installs Node 22 privately, Mosquitto 2.x, certbot cert, nginx, systemd units)
./services/iot-api/deploy/deploy.sh ec2-user@<ip> key.pem --install --email ops@tinkerbit.io
# then on the server: set AUTH_SECRET, IOT_ALLOWLIST, IOT_BACKUP_S3_URI in /etc/tinkerbit-iot/env

# every release (tests run locally first; pre-deploy backup; auto-rollback if /readyz fails)
./services/iot-api/deploy/deploy.sh ec2-user@<ip> key.pem
```

`install-on-ec2.sh` is idempotent: re-running it keeps existing secrets, certificates
and the dynsec database. It needs at least 1 GB free on `/`.

**Ubuntu vs Amazon Linux 2023.** The installer detects the OS. The production box
(`13.127.144.30`) runs Amazon Linux 2023, where it:
- installs nginx, certbot, sqlite and Docker with `dnf`, and puts the site in
  `/etc/nginx/conf.d/tinkerbit-iot.conf` (Ubuntu uses `sites-available`);
- runs Mosquitto from the pinned `eclipse-mosquitto:2.0.22-openssl` image, because AL2023
  has no Mosquitto package. The systemd unit is still `mosquitto.service` (host
  networking, config in `/etc/mosquitto`, state in `/var/lib/mosquitto`, host user
  `mosquitto` = uid 1883 like the image), so the commands below are the same;
- enables `certbot-renew.timer` (Ubuntu's `certbot.timer` is on by default).

On Amazon Linux there is no host `mosquitto_ctrl`; run it from the image:
`sudo docker run --rm --network host eclipse-mosquitto:2.0.22-openssl mosquitto_ctrl …`.
To upgrade the broker, re-run the installer with `MOSQ_IMAGE=eclipse-mosquitto:<tag>`.

## Operations runbook

**Health**: `curl https://api.tinkerbit.io/healthz` (liveness) and
`curl http://127.0.0.1:20114/readyz` on the box (db writable, disk > 15 % free, broker connected).

**Logs**: `journalctl -u tinkerbit-iot -f` (JSON lines; secrets are redacted),
`journalctl -u mosquitto -f`, `journalctl -u tinkerbit-iot-backup`.

**Rollback**: `ls /opt/tinkerbit-iot/releases`, then
`sudo ln -sfn /opt/tinkerbit-iot/releases/<stamp> /opt/tinkerbit-iot/current && sudo systemctl restart tinkerbit-iot`.
Migrations are additive only, so an older release runs on a newer schema (it logs `db.schema_ahead`).

**Restore from backup**:
```bash
sudo systemctl stop tinkerbit-iot
cd /var/backups/tinkerbit-iot/<stamp> && sha256sum -c SHA256SUMS
sudo -u tinkerbit-iot sh -c 'gunzip -c iot.db.gz > /var/lib/tinkerbit-iot/iot.db && rm -f /var/lib/tinkerbit-iot/iot.db-wal /var/lib/tinkerbit-iot/iot.db-shm'
# broker credentials must match the database: restore them from the same set
sudo systemctl stop mosquitto
gunzip -c dynamic-security.json.gz | sudo tee /var/lib/mosquitto/dynamic-security.json >/dev/null
sudo chown mosquitto:mosquitto /var/lib/mosquitto/dynamic-security.json
sudo systemctl start mosquitto tinkerbit-iot
```
From S3: `aws s3 cp --recursive s3://<bucket>/tinkerbit-iot/<stamp>/ .` first.

**Disable one misbehaving board** (keeps its data):
`mosquitto_ctrl -u tb-admin -P <MQTT_ADMIN_PASS> dynsec disableClient <device-id>`;
the owner can also delete it or regenerate its token from `/iot`. The service disables
boards automatically when they flood (120 dropped messages in 10 minutes).

**Rotate secrets**
- Device token: owner presses *Regenerate token* (old token is kicked immediately).
- Ingest/admin MQTT passwords: `mosquitto_ctrl … dynsec setClientPassword tb-ingest <new>`,
  update `/etc/tinkerbit-iot/env`, `systemctl restart tinkerbit-iot`.
- `AUTH_SECRET`: change on Vercel and in the env file together (signs everyone out).

**Pause the whole feature**: set `IOT_ENABLED=0` and restart; the API answers 503 and
boards stay connected to the broker but nothing is stored.

**Certificates** renew automatically (`certbot.timer` on Ubuntu, `certbot-renew.timer` on
Amazon Linux); the deploy hook copies them for
Mosquitto and reloads it. Check with `sudo certbot renew --dry-run`.

## Load test before opening the pilot

```bash
# on the server, temporarily IOT_ALLOWLIST=* (or add sim-00..09@loadtest.tinkerbit.io)
AUTH_SECRET=... node tools/simulate-devices.mjs provision --count 100
node tools/simulate-devices.mjs run --broker mqtts://api.tinkerbit.io:8883 --interval 10 --chaos --duplicates
node tools/simulate-devices.mjs cleanup
```
Watch `top`, `journalctl -u tinkerbit-iot` and `/readyz` while a compile job runs at the same time.

## Data retention

Raw readings 48 h, 1-minute rollups 30 days, 1-hour rollups 366 days, 100 alerts per
device, audit log 180 days. Deleted devices are purged after 7 days. Users can export
(`GET /iot/v1/me/export`) or erase (`DELETE /iot/v1/me/data`) their data.
