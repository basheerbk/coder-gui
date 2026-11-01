# Compile API (Arduino Uno + ESP32)

HTTP service that compiles sketch source using the OpenBlock Link `arduino-cli` install.

## Endpoints

- `GET /api/compile/health` → `{ ok: true }`
- `POST /api/compile` → body `{ "fqbn": "...", "source": "..." }`

Supported FQBNs:

- `arduino:avr:uno` → `{ "hex": "...", "log": "..." }`
- `esp32:esp32:esp32` → `{ "format": "esptool", "images": [{ "address", "data" }], "log": "..." }`
- `esp32:esp32:esp32s3` → same esptool image list

## Install on EC2

From your machine:

```bash
scp -i tinkerbit-key.pem -r services/compile-api ec2-user@13.127.144.30:/tmp/compile-api
ssh -i tinkerbit-key.pem ec2-user@13.127.144.30 "bash /tmp/compile-api/install-on-ec2.sh"
```

The install script also installs the `esp32:esp32` Arduino core (first run can take several minutes).

Verify:

```bash
curl http://13.127.144.30/api/compile/health
```

## GUI

The Vercel site proxies `/api/compile` to the EC2 host (`vercel.json`). Local dev proxies via webpack (`COMPILE_PROXY_TARGET`, default `http://13.127.144.30`).

- Arduino Uno: Web Serial + STK500 in the browser
- ESP32 / ESP32-S3: Web Serial + esptool-js in the browser
