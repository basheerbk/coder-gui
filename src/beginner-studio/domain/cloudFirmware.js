import {ISRG_ROOTS_PEM} from './cloudCerts';
import {
    CLOUD_DEFAULTS,
    CLOUD_SLIDERS,
    CLOUD_SWITCHES,
    DEVICE_ID_RE,
    MASK,
    cEscape,
    clampInterval,
    hasBle,
    lockedPortParts
} from './cloud';
import {moduleById} from './modules';

/** Blocks that store a fresh value in their module's variable(s). */
const READ_BLOCKS = {
    read_value: true,
    print_soil: true,
    print_gas: true,
    read_distance: true,
    read_temp: true,
    read_humidity: true,
    print_climate: true,
    is_pressed: true,
    is_motion: true
};

const walkBlocks = (blocks, visit) => {
    (blocks || []).forEach(block => {
        visit(block);
        walkBlocks(block.children, visit);
        walkBlocks(block.elseChildren, visit);
    });
};

/**
 * Readings the board sends: variables of wired input parts that the program actually reads
 * (a never-read variable would just report 0 forever). Strings are not sent.
 */
const telemetryReadings = (connections, program) => {
    const byConn = {};
    (connections || []).forEach(c => {
        byConn[c.id] = c;
    });
    const readConns = {};
    walkBlocks(program, block => {
        if (block.cid && READ_BLOCKS[block.type] && byConn[block.cid]) {
            readConns[block.cid] = true;
        }
    });
    const out = [];
    const seen = {};
    const add = (key, type, valid) => {
        if (seen[key] || type === 'String') {
            return;
        }
        seen[key] = true;
        out.push({key, type: type === 'float' ? 'float' : 'int', valid});
    };
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod || mod.dir !== 'in' || !readConns[c.id] || !mod.valueName) {
            return;
        }
        // -1 means "no echo" for the ultrasonic sensor.
        add(mod.valueName, mod.valueType, mod.id === 'ultra' ? `${mod.valueName} >= 0` : 'true');
        if (mod.humidityName) {
            add(mod.humidityName, 'float', 'true');
        }
    });
    return out;
};

const pemLines = () => ISRG_ROOTS_PEM.join('')
    .split('\n')
    .filter(Boolean)
    .map(line => `"${line}\\n"`);

const define = (name, value) => `#define ${name} "${cEscape(value)}"`;

/** Problems that must stop compilation (also blocked in the UI, this covers stale saved states). */
const cloudErrors = (connections, cloud) => {
    const errors = [];
    lockedPortParts(connections).forEach(part => {
        errors.push(`Unplug ${part.name} from ${part.port}: A1-A4 are off while Cloud is on`);
    });
    if (hasBle(connections)) {
        errors.push('Remove Bluetooth (BLE): it cannot run together with Cloud');
    }
    if (!cloud || !DEVICE_ID_RE.test(cloud.deviceId || '')) {
        errors.push('Cloud is not set up yet: open Cloud in the Studio top bar');
    }
    return errors;
};

const firmwareCore = String.raw`
static esp_mqtt_client_handle_t cloudClient = NULL;
static Preferences cloudPrefs;
static portMUX_TYPE cloudMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool cloudConnected = false;
static volatile bool cloudEverConnected = false;
static volatile bool cloudAuthRejected = false;
static volatile bool cloudLoopDone = false;
static volatile bool cloudSendNowFlag = false;
static volatile uint8_t cloudFailures = 0;
static volatile uint32_t cloudDownSince = 0;
static bool cloudStarted = false;
static bool cloudUseWss = false;
static bool cloudTransportSaved = false;
static bool cloudRetestScheduled = false;
static bool cloudAuthPaused = false;
static uint32_t cloudAuthAt = 0;
static uint32_t cloudWssSince = 0;
static uint32_t cloudWifiKick = 0;
static uint32_t cloudLastSend = 0;
static uint32_t cloudSeq = 0;
static char cloudBoot[9];
static char cloudUri[96];
static char cloudWillTopic[48];
static char cloudAlertBuf[484];
static volatile bool cloudAlertPending = false;
static uint32_t cloudLastAlert = 0;
static uint32_t cloudLastAlertNote = 0;
static bool cloudAlertEver = false;

volatile int cloudSwitch1 = 0;
volatile int cloudSwitch2 = 0;
volatile int cloudSwitch3 = 0;
volatile int cloudSwitch4 = 0;
volatile int cloudSlider1 = 0;
volatile int cloudSlider2 = 0;
static volatile int *const cloudValues[6] = {&cloudSwitch1, &cloudSwitch2, &cloudSwitch3, &cloudSwitch4, &cloudSlider1, &cloudSlider2};
static const char *const cloudKeys[6] = {"switch1", "switch2", "switch3", "switch4", "slider1", "slider2"};
static volatile uint16_t cloudFailsafeSec[6] = {120, 120, 120, 120, 120, 120};
static volatile int cloudFailsafeValue[6] = {0, 0, 0, 0, 0, 0};
static bool cloudFailsafeOn[6] = {false, false, false, false, false, false};

static bool cloudJsonLong(const char *s, const char *key, long *out) {
  const char *p = strstr(s, key);
  if (!p) return false;
  p += strlen(key);
  char *end = NULL;
  long n = strtol(p, &end, 10);
  if (end == p) return false;
  *out = n;
  return true;
}

static void cloudPublish(esp_mqtt_client_handle_t client, const char *suffix, const char *msg, int qos, int retain) {
  if (!client) return;
  char topic[48];
  snprintf(topic, sizeof(topic), "tb/%s/%s", CLOUD_DEVICE_ID, suffix);
  // enqueue never blocks the caller; the MQTT task sends it.
  esp_mqtt_client_enqueue(client, topic, msg, 0, qos, retain, true);
}

static void cloudOnState(esp_mqtt_event_handle_t e) {
  // Only whole, small messages: state payloads are ~40 bytes. Empty = retained message cleared.
  if (e->current_data_offset != 0 || e->data_len != e->total_data_len) return;
  if (e->topic_len <= 0 || e->topic_len >= 64 || e->data_len <= 0 || e->data_len >= 96) return;
  char topic[64];
  char body[96];
  memcpy(topic, e->topic, e->topic_len);
  topic[e->topic_len] = 0;
  memcpy(body, e->data, e->data_len);
  body[e->data_len] = 0;
  const char *slash = strrchr(topic, '/');
  if (!slash) return;
  int idx = -1;
  for (int i = 0; i < 6; i++) {
    if (strcmp(slash + 1, cloudKeys[i]) == 0) idx = i;
  }
  if (idx < 0) return;
  long v = 0, ver = 0, fs = 120, fv = 0;
  if (!cloudJsonLong(body, "\"v\":", &v) || !cloudJsonLong(body, "\"ver\":", &ver)) return;
  cloudJsonLong(body, "\"fs\":", &fs);
  cloudJsonLong(body, "\"fv\":", &fv);
  long maxV = idx < 4 ? 1 : 100;
  v = constrain(v, 0L, maxV);
  fv = constrain(fv, 0L, maxV);
  fs = constrain(fs, 0L, 3600L);
  portENTER_CRITICAL(&cloudMux);
  *cloudValues[idx] = (int)v;
  cloudFailsafeSec[idx] = (uint16_t)fs;
  cloudFailsafeValue[idx] = (int)fv;
  portEXIT_CRITICAL(&cloudMux);
  cloudFailsafeOn[idx] = false;
  char ack[64];
  snprintf(ack, sizeof(ack), "{\"key\":\"%s\",\"ver\":%ld}", cloudKeys[idx], ver);
  cloudPublish(e->client, "ack", ack, 1, 0);
  Serial.printf("Cloud: %s = %ld\n", cloudKeys[idx], v);
}

static void cloudOnEvent(void *args, esp_event_base_t base, int32_t eventId, void *data) {
  esp_mqtt_event_handle_t e = (esp_mqtt_event_handle_t)data;
  switch ((esp_mqtt_event_id_t)eventId) {
  case MQTT_EVENT_CONNECTED: {
    cloudConnected = true;
    cloudEverConnected = true;
    cloudFailures = 0;
    char msg[160];
    snprintf(msg, sizeof(msg), "{\"s\":\"online\",\"fw\":\"%s\",\"rssi\":%d,\"boot\":\"%s\",\"tr\":\"%s\"}",
             CLOUD_FW, (int)WiFi.RSSI(), cloudBoot, cloudUseWss ? "wss" : "mqtts");
    cloudPublish(e->client, "status", msg, 1, 1);
    char topic[48];
    snprintf(topic, sizeof(topic), "tb/%s/state/#", CLOUD_DEVICE_ID);
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 1, 0)
    esp_mqtt_client_subscribe_single(e->client, topic, 1);
#else
    esp_mqtt_client_subscribe(e->client, topic, 1);
#endif
    Serial.printf("Cloud: connected (%s)\n", cloudUseWss ? "port 443" : "port 8883");
    break;
  }
  case MQTT_EVENT_DISCONNECTED:
    if (cloudConnected) {
      cloudDownSince = millis();
      Serial.println(F("Cloud: disconnected - retrying"));
    }
    cloudConnected = false;
    break;
  case MQTT_EVENT_DATA:
    cloudOnState(e);
    break;
  case MQTT_EVENT_ERROR:
    if (e->error_handle && e->error_handle->error_type == MQTT_ERROR_TYPE_CONNECTION_REFUSED) {
      int rc = (int)e->error_handle->connect_return_code;
      if (rc == MQTT_CONNECTION_REFUSE_BAD_USERNAME || rc == MQTT_CONNECTION_REFUSE_NOT_AUTHORIZED) {
        cloudAuthRejected = true;
      }
    } else if (!cloudConnected && WiFi.status() == WL_CONNECTED && cloudFailures < 255) {
      cloudFailures = cloudFailures + 1;
    }
    break;
  default:
    break;
  }
}

static void cloudStart() {
  if (cloudUseWss) {
    snprintf(cloudUri, sizeof(cloudUri), "wss://%s:443%s", CLOUD_HOST, CLOUD_WSS_PATH);
  } else {
    snprintf(cloudUri, sizeof(cloudUri), "mqtts://%s:%d", CLOUD_HOST, CLOUD_MQTTS_PORT);
  }
  snprintf(cloudWillTopic, sizeof(cloudWillTopic), "tb/%s/status", CLOUD_DEVICE_ID);
  esp_mqtt_client_config_t cfg = {};
#if ESP_IDF_VERSION_MAJOR >= 5
  cfg.broker.address.uri = cloudUri;
  cfg.broker.verification.certificate = CLOUD_CA;
  cfg.credentials.client_id = CLOUD_DEVICE_ID;
  cfg.credentials.username = CLOUD_DEVICE_ID;
  cfg.credentials.authentication.password = CLOUD_TOKEN;
  cfg.session.keepalive = 30;
  cfg.session.disable_clean_session = false;
  cfg.session.last_will.topic = cloudWillTopic;
  cfg.session.last_will.msg = "offline";
  cfg.session.last_will.msg_len = 7;
  cfg.session.last_will.qos = 1;
  cfg.session.last_will.retain = 1;
  cfg.network.reconnect_timeout_ms = 5000;
  cfg.network.timeout_ms = 10000;
  cfg.buffer.size = 1024;
  cfg.buffer.out_size = 1024;
#else
  cfg.uri = cloudUri;
  cfg.cert_pem = CLOUD_CA;
  cfg.client_id = CLOUD_DEVICE_ID;
  cfg.username = CLOUD_DEVICE_ID;
  cfg.password = CLOUD_TOKEN;
  cfg.keepalive = 30;
  cfg.disable_clean_session = false;
  cfg.lwt_topic = cloudWillTopic;
  cfg.lwt_msg = "offline";
  cfg.lwt_msg_len = 7;
  cfg.lwt_qos = 1;
  cfg.lwt_retain = 1;
  cfg.reconnect_timeout_ms = 5000;
  cfg.network_timeout_ms = 10000;
  cfg.buffer_size = 1024;
  cfg.out_buffer_size = 1024;
#endif
  cloudClient = esp_mqtt_client_init(&cfg);
  if (!cloudClient) {
    Serial.println(F("Cloud: not enough memory to start"));
    return;
  }
  esp_mqtt_client_register_event(cloudClient, (esp_mqtt_event_id_t)ESP_EVENT_ANY_ID, cloudOnEvent, NULL);
  cloudEverConnected = false;
  cloudFailures = 0;
  cloudTransportSaved = false;
  esp_mqtt_client_start(cloudClient);
  cloudStarted = true;
  if (cloudUseWss) cloudWssSince = millis();
  Serial.printf("Cloud: connecting to %s\n", cloudUri);
}

static void cloudStop() {
  if (cloudClient) {
    esp_mqtt_client_destroy(cloudClient);
    cloudClient = NULL;
  }
  if (cloudConnected) cloudDownSince = millis();
  cloudConnected = false;
  cloudStarted = false;
}

static int cloudAppend(char *buf, size_t size, int n, bool *first, const char *key, double value, bool isInt, bool valid) {
  if (!valid || n < 0 || (size_t)n >= size || !isfinite(value)) return n;
  int w = isInt
    ? snprintf(buf + n, size - n, "%s\"%s\":%ld", *first ? "" : ",", key, (long)value)
    : snprintf(buf + n, size - n, "%s\"%s\":%.2f", *first ? "" : ",", key, value);
  if (w < 0 || (size_t)w >= size - n) return (int)size;
  *first = false;
  return n + w;
}
`;

const firmwareTask = String.raw`
static void cloudTask(void *arg) {
  for (;;) {
    uint32_t now = millis();
    bool wifiUp = WiFi.status() == WL_CONNECTED;

    if (!wifiUp && (uint32_t)(now - cloudWifiKick) >= 30000UL) {
      cloudWifiKick = now;
      WiFi.reconnect();
    }

    if (cloudAuthRejected) {
      cloudAuthRejected = false;
      cloudStop();
      cloudAuthPaused = true;
      cloudAuthAt = now;
      Serial.println(F("Cloud: login rejected - re-upload from Studio (trying again in 5 min)"));
    }
    if (cloudAuthPaused && (uint32_t)(now - cloudAuthAt) >= 300000UL) cloudAuthPaused = false;
    if (wifiUp && !cloudStarted && !cloudAuthPaused) cloudStart();

    // Port 8883 blocked (school networks)? Try MQTT over port 443, and remember what worked.
    if (cloudStarted && !cloudEverConnected && cloudFailures >= 3) {
      cloudStop();
      cloudUseWss = !cloudUseWss;
      Serial.println(cloudUseWss ? F("Cloud: port 8883 blocked? using port 443") : F("Cloud: trying port 8883 again"));
      cloudStart();
    }
    if (cloudConnected && !cloudTransportSaved) {
      cloudTransportSaved = true;
      if (cloudPrefs.getBool("wss", false) != cloudUseWss) cloudPrefs.putBool("wss", cloudUseWss);
    }
    // Once a day on port 443, forget it so the next restart tries 8883 first again.
    if (cloudUseWss && cloudConnected && !cloudRetestScheduled && (uint32_t)(now - cloudWssSince) >= 86400000UL) {
      cloudRetestScheduled = true;
      cloudPrefs.putBool("wss", false);
    }

    if (!cloudConnected) {
      uint32_t down = now - cloudDownSince;
      for (int i = 0; i < 6; i++) {
        uint16_t fs = cloudFailsafeSec[i];
        if (fs > 0 && !cloudFailsafeOn[i] && down >= (uint32_t)fs * 1000UL) {
          cloudFailsafeOn[i] = true;
          portENTER_CRITICAL(&cloudMux);
          *cloudValues[i] = cloudFailsafeValue[i];
          portEXIT_CRITICAL(&cloudMux);
          Serial.printf("Cloud: offline %us - %s set to safe value %d\n", (unsigned)fs, cloudKeys[i], cloudFailsafeValue[i]);
        }
      }
    }

    if (cloudConnected && cloudAlertPending) {
      char text[sizeof(cloudAlertBuf)];
      portENTER_CRITICAL(&cloudMux);
      memcpy(text, cloudAlertBuf, sizeof(text));
      cloudAlertPending = false;
      portEXIT_CRITICAL(&cloudMux);
      cloudPublish(cloudClient, "alert", text, 1, 0);
    }

    // Sent even with nothing to measure (or a loop that never ends): it doubles as the heartbeat.
    if (cloudConnected) {
      uint32_t since = now - cloudLastSend;
      if (since >= CLOUD_INTERVAL_MS || (cloudLoopDone && cloudSendNowFlag && since >= CLOUD_MIN_GAP_MS)) {
        cloudSendNowFlag = false;
        cloudLastSend = now;
        cloudSendTelemetry(cloudLoopDone);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

static void cloudSendNow() {
  cloudSendNowFlag = true;
}

static void cloudAlert(const char *text) {
  uint32_t now = millis();
  if (cloudAlertPending || (cloudAlertEver && (uint32_t)(now - cloudLastAlert) < 10000UL)) {
    if ((uint32_t)(now - cloudLastAlertNote) >= 10000UL) {
      cloudLastAlertNote = now;
      Serial.println(F("Cloud: alert skipped (at most one every 10 s)"));
    }
    return;
  }
  portENTER_CRITICAL(&cloudMux);
  strncpy(cloudAlertBuf, text, sizeof(cloudAlertBuf) - 1);
  cloudAlertBuf[sizeof(cloudAlertBuf) - 1] = 0;
  cloudAlertPending = true;
  portEXIT_CRITICAL(&cloudMux);
  cloudLastAlert = now;
  cloudAlertEver = true;
  Serial.printf("Cloud: alert \"%s\"%s\n", text, cloudConnected ? "" : " (sends when connected)");
}

static void cloudOnWifi(arduino_event_id_t event, arduino_event_info_t info) {
  static uint32_t lastNote = 0;
  if (event == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
    Serial.printf("Cloud: WiFi connected (RSSI %d)\n", (int)WiFi.RSSI());
    return;
  }
  if (event != ARDUINO_EVENT_WIFI_STA_DISCONNECTED) return;
  uint32_t now = millis();
  if ((uint32_t)(now - lastNote) < 10000UL) return;
  lastNote = now;
  uint8_t reason = info.wifi_sta_disconnected.reason;
  if (reason == WIFI_REASON_NO_AP_FOUND) {
    Serial.println(F("Cloud: WiFi name not found - check spelling, 2.4 GHz networks only"));
  } else if (reason == WIFI_REASON_AUTH_FAIL || reason == WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT ||
             reason == WIFI_REASON_HANDSHAKE_TIMEOUT) {
    Serial.println(F("Cloud: wrong WiFi password?"));
  } else {
    Serial.printf("Cloud: WiFi lost (reason %u) - reconnecting\n", (unsigned)reason);
  }
}

static void cloudSetup() {
  snprintf(cloudBoot, sizeof(cloudBoot), "%08lx", (unsigned long)esp_random());
  cloudPrefs.begin("tbcloud", false);
  cloudUseWss = cloudPrefs.getBool("wss", false);
  cloudDownSince = millis();
  WiFi.onEvent(cloudOnWifi);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // modem sleep delays incoming commands and can miss broker pings
  WiFi.setAutoReconnect(true);
  if (strlen(CLOUD_WIFI_PASS) > 0) {
    WiFi.begin(CLOUD_WIFI_SSID, CLOUD_WIFI_PASS);
  } else {
    WiFi.begin(CLOUD_WIFI_SSID);
  }
  cloudWifiKick = millis();
  Serial.println(F("Cloud: joining WiFi \"" CLOUD_WIFI_SSID "\""));
  xTaskCreatePinnedToCore(cloudTask, "tbcloud", 6144, NULL, 1, NULL, 1);
}
`;

/**
 * C++ pieces for the Cloud part. `secrets` is only passed by the upload handler; without it
 * the WiFi password and device token are shown as ******** in the code panel.
 */
const cloudFirmware = ({connections, program, cloud, secrets}) => {
    const errors = cloudErrors(connections, cloud);
    const cfg = Object.assign({}, CLOUD_DEFAULTS, cloud || {});
    const intervalSec = clampInterval(cfg.intervalSec, cfg.minIntervalSec);
    const minGapSec = Math.max(1, Number(cfg.minIntervalSec) || CLOUD_DEFAULTS.minIntervalSec);
    const deviceId = DEVICE_ID_RE.test(cfg.deviceId || '') ? cfg.deviceId : 'd_notsetup0';
    const real = Boolean(secrets);
    const readings = telemetryReadings(connections, program);

    const head = [
        '// ---- TinkerBit Cloud (MQTT over TLS; needs arduino-esp32 2.x or 3.x) ----',
        '#include <WiFi.h>',
        '#include <Preferences.h>',
        '#include <math.h>',
        '#include "esp_idf_version.h"',
        '#include "mqtt_client.h"',
        '#if ESP_IDF_VERSION_MAJOR >= 5',
        '#include "esp_random.h"',
        '#endif',
        ''
    ];
    errors.forEach(msg => head.push(`#error "${cEscape(msg)}"`));
    if (errors.length) {
        head.push('');
    }
    if (!real) {
        head.push('// The WiFi password and device key are hidden here; Studio fills them in when you press Upload.');
    }
    head.push(define('CLOUD_WIFI_SSID', (secrets && secrets.ssid) || cfg.ssid || 'YOUR_WIFI'));
    head.push(define('CLOUD_WIFI_PASS', real ? (secrets.password || '') : MASK));
    head.push(define('CLOUD_DEVICE_ID', deviceId));
    head.push(define('CLOUD_TOKEN', real ? secrets.token : MASK));
    head.push(define('CLOUD_HOST', cfg.host));
    head.push(`#define CLOUD_MQTTS_PORT ${Number(cfg.mqttsPort) || CLOUD_DEFAULTS.mqttsPort}`);
    head.push(define('CLOUD_WSS_PATH', cfg.wssPath));
    head.push(`#define CLOUD_INTERVAL_MS ${intervalSec * 1000}UL`);
    head.push(`#define CLOUD_MIN_GAP_MS ${minGapSec * 1000}UL`);
    head.push(define('CLOUD_FW', 'studio-2'));
    head.push('');
    head.push('// Let\'s Encrypt ISRG Root X1 + X2: certificate renewals never need a re-flash.');
    head.push('static const char CLOUD_CA[] =');
    const pem = pemLines();
    pem.forEach((line, i) => head.push(`${line}${i === pem.length - 1 ? ';' : ''}`));

    const telemetry = [
        '// With no readings this still sends {"v":{}} so the dashboard knows the board is online.',
        'static void cloudSendTelemetry(bool withReadings) {',
        '  char buf[768];',
        '  bool first = true;',
        '  int n = snprintf(buf, sizeof(buf), "{\\"seq\\":%lu,\\"boot\\":\\"%s\\",\\"v\\":{", (unsigned long)(cloudSeq + 1), cloudBoot);'
    ];
    if (readings.length) {
        telemetry.push('  if (withReadings) {');
        readings.forEach(r => {
            telemetry.push(`    n = cloudAppend(buf, sizeof(buf), n, &first, "${r.key}", (double)${r.key}, ${r.type === 'int' ? 'true' : 'false'}, ${r.valid});`);
        });
        telemetry.push('  }');
    } else {
        telemetry.push('  (void)withReadings;');
    }
    telemetry.push('  if (n < 0 || (size_t)n + 3 > sizeof(buf)) return;');
    telemetry.push('  buf[n++] = \'}\';');
    telemetry.push('  buf[n++] = \'}\';');
    telemetry.push('  buf[n] = 0;');
    telemetry.push('  cloudSeq++;');
    telemetry.push('  cloudPublish(cloudClient, "telemetry", buf, 0, 0);');
    telemetry.push('}');

    return {
        head,
        body: [firmwareCore.trim(), '', telemetry.join('\n'), firmwareTask.replace(/^\n/, '')],
        setup: ['cloudSetup();'],
        loopEnd: ['cloudLoopDone = true;'],
        readings,
        errors
    };
};

const CLOUD_CONTROL_VARS = CLOUD_SWITCHES.concat(CLOUD_SLIDERS).map(c => c.id);

/** Dashboard control keys (switch1, slider2, …) that the program's If blocks listen to. */
const usedCloudControls = program => {
    const byVar = {};
    CLOUD_SWITCHES.concat(CLOUD_SLIDERS).forEach(c => {
        byVar[c.id] = c.key;
    });
    const used = [];
    walkBlocks(program, block => {
        const key = block.params && byVar[block.params.sensor];
        if (key && used.indexOf(key) < 0) {
            used.push(key);
        }
    });
    return used.sort();
};

export {CLOUD_CONTROL_VARS, cloudFirmware, telemetryReadings, usedCloudControls};
