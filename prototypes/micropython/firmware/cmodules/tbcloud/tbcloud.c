// tbcloud: TinkerBit Cloud for TinkerBit firmware (Stage B), built on ESP-IDF esp-mqtt.
//
// Speaks the same protocol as the Arduino Cloud firmware (src/beginner-studio/domain/
// cloudFirmware.js), so the Cloud service and dashboard need no changes:
//   * topics tb/<id>/telemetry, status (retained; last will "offline"), ack and alert;
//     subscribes to tb/<id>/state/# for dashboard switch1-4 and slider1-2.
//   * telemetry {"seq":n,"boot":"xxxxxxxx","v":{...}} on its interval from this task, so it
//     keeps going while Python sits in a long sleep. With no readings it is the heartbeat.
//   * failsafe: offline for fs seconds, a control falls back to its safe value.
//   * alerts: at most one every 10 s, queued while offline.
//   * reconnect rules: WiFi kick every 30 s, WiFi restart after 3 min down, fresh MQTT client
//     after 2 min stuck, 3 failures before the first connect swap the TLS port and the
//     WebSocket port (remembered in NVS, retested daily), login rejected waits 5 min.
//   * prints the "Cloud: ..." lines the going-live checklist reads (cloudProgress.js).
//     They go through mp_sched_schedule, so Python prints them between bytecodes instead
//     of this task writing into the middle of the REPL stream.
// WiFi is started from Python (network.WLAN). The token is copied into C memory and never printed.
//
//   tbcloud.start(host, port, ws_port, device_id, token, ca, *, ws_path="/mqtt",
//                 interval_ms=10000, min_gap_ms=5000, fw="mpy-1")
//   tbcloud.set(key, value) -> bool  int/float/bool reading, None removes it; at most 24
//   tbcloud.send_now()               telemetry as soon as the minimum gap allows
//   tbcloud.alert(text) -> int       0 queued, 1 skipped (print the note), 2 skipped quietly
//   tbcloud.get(key) -> int          switch1-4 (0/1), slider1-2 (0-100)
//   tbcloud.status() -> (state, reconnects, transport, last_error, wifi_restarts, fresh_starts, seq)
//                       state: 0 stopped, 1 waiting for WiFi, 2 connecting, 3 connected
//   tbcloud.stop()

#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "py/runtime.h"
#include "py/obj.h"
#include "py/mphal.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "esp_event.h"
#include "esp_idf_version.h"
#include "esp_netif.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "mqtt_client.h"
#include "nvs.h"

#define WIFI_KICK_US        (30LL * 1000000)
#define WIFI_RESTART_US     (180LL * 1000000)
#define MQTT_STUCK_US       (120LL * 1000000)
#define AUTH_PAUSE_US       (300LL * 1000000)
#define WSS_RETEST_US       (86400LL * 1000000)
#define ALERT_GAP_US        (10LL * 1000000)
#define NOTE_GAP_US         (10LL * 1000000)
#define NO_MEMORY_RETRY_US  (5LL * 1000000)
#define SWAP_AFTER_FAILURES (3)
#define MAX_READINGS        (24)
#define KEY_MAX             (24)
#define ALERT_MAX           (484)
#define N_LINES             (8)
#define TB_LINE_MAX            (112)
#define N_CONTROLS          (6)

enum { ST_STOPPED = 0, ST_WIFI_WAIT = 1, ST_CONNECTING = 2, ST_CONNECTED = 3 };

typedef struct {
    char key[KEY_MAX];
    float value;
    bool is_int;
} reading_t;

static const char *const control_keys[N_CONTROLS] = {"switch1", "switch2", "switch3", "switch4", "slider1", "slider2"};

// Guards everything Python, the MQTT task and the supervisor share (short copies only).
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

static struct {
    SemaphoreHandle_t lock;
    TaskHandle_t task;
    esp_mqtt_client_handle_t client;
    volatile bool running;
    volatile int state;
    volatile bool connected;
    volatile bool ever_connected;
    volatile bool auth_rejected;
    volatile int failures;
    volatile int reconnects;
    volatile int last_error;
    volatile int64_t down_since;
    int wifi_restarts;
    int fresh_starts;
    bool use_wss;
    bool transport_saved;
    bool retest_scheduled;
    bool auth_paused;
    bool handlers;
    int64_t auth_at;
    int64_t wss_since;
    int64_t wifi_lost_at;
    int64_t wifi_kick;
    int64_t wifi_note;
    int64_t mqtt_kick;
    int64_t no_memory_at;
    int64_t last_send;
    uint32_t seq;
    int interval_ms;
    int min_gap_ms;
    char boot[9];
    char fw[25];
    char host[96];
    int port;
    int ws_port;
    char ws_path[48];
    char device_id[32];
    char token[160];
    char uri[192];
    char will_topic[64];
    char *ca;

    reading_t readings[MAX_READINGS];
    int n_readings;
    bool send_now;
    int values[N_CONTROLS];
    uint16_t failsafe_sec[N_CONTROLS];
    int failsafe_value[N_CONTROLS];
    bool failsafe_on[N_CONTROLS];
    char alert[ALERT_MAX];
    bool alert_pending;
    bool alert_ever;
    int64_t alert_at;
    int64_t alert_note_at;

    char lines[N_LINES][TB_LINE_MAX];
    int line_head;
    int line_count;
    bool drain_scheduled;
} s;

// ---- printed lines -------------------------------------------------------------------

static mp_obj_t tbcloud_drain(mp_obj_t arg) {
    (void)arg;
    char line[TB_LINE_MAX];
    for (;;) {
        portENTER_CRITICAL(&mux);
        if (!s.line_count) {
            s.drain_scheduled = false;
            portEXIT_CRITICAL(&mux);
            break;
        }
        memcpy(line, s.lines[s.line_head], TB_LINE_MAX);
        s.line_head = (s.line_head + 1) % N_LINES;
        s.line_count--;
        portEXIT_CRITICAL(&mux);
        mp_printf(&mp_plat_print, "%s\n", line);
    }
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_1(tbcloud_drain_obj, tbcloud_drain);

static void note(const char *fmt, ...) {
    char line[TB_LINE_MAX];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(line, sizeof(line), fmt, ap);
    va_end(ap);
    portENTER_CRITICAL(&mux);
    int slot = (s.line_head + s.line_count) % N_LINES;
    if (s.line_count == N_LINES) {
        // Python has not run for a while: drop the oldest line.
        s.line_head = (s.line_head + 1) % N_LINES;
    } else {
        s.line_count++;
    }
    memcpy(s.lines[slot], line, TB_LINE_MAX);
    bool schedule = !s.drain_scheduled;
    s.drain_scheduled = true;
    portEXIT_CRITICAL(&mux);
    if (schedule && !mp_sched_schedule(MP_OBJ_FROM_PTR(&tbcloud_drain_obj), mp_const_none)) {
        s.drain_scheduled = false;
    }
}

// ---- helpers ---------------------------------------------------------------------------

static void copy_str(char *dst, size_t size, mp_obj_t obj) {
    dst[0] = 0;
    if (obj == mp_const_none || obj == MP_OBJ_NULL) {
        return;
    }
    size_t len;
    const char *src = mp_obj_str_get_data(obj, &len);
    if (len >= size) {
        mp_raise_ValueError(MP_ERROR_TEXT("cloud setting too long"));
    }
    memcpy(dst, src, len);
    dst[len] = 0;
}

static int control_index(const char *key) {
    for (int i = 0; i < N_CONTROLS; i++) {
        if (strcmp(key, control_keys[i]) == 0) {
            return i;
        }
    }
    return -1;
}

static bool json_long(const char *str, const char *key, long *out) {
    const char *p = strstr(str, key);
    if (!p) {
        return false;
    }
    p += strlen(key);
    char *end = NULL;
    long n = strtol(p, &end, 10);
    if (end == p) {
        return false;
    }
    *out = n;
    return true;
}

static long clamp(long v, long lo, long hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

static bool wifi_up(void) {
    wifi_ap_record_t ap;
    if (esp_wifi_sta_get_ap_info(&ap) != ESP_OK) {
        return false;
    }
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    esp_netif_ip_info_t ip;
    return netif && esp_netif_get_ip_info(netif, &ip) == ESP_OK && ip.ip.addr != 0;
}

static int wifi_rssi(void) {
    wifi_ap_record_t ap;
    return esp_wifi_sta_get_ap_info(&ap) == ESP_OK ? ap.rssi : 0;
}

static bool nvs_get_wss(void) {
    nvs_handle_t h;
    uint8_t v = 0;
    if (nvs_open("tbcloud", NVS_READONLY, &h) == ESP_OK) {
        nvs_get_u8(h, "wss", &v);
        nvs_close(h);
    }
    return v != 0;
}

static void nvs_put_wss(bool on) {
    nvs_handle_t h;
    if (nvs_open("tbcloud", NVS_READWRITE, &h) != ESP_OK) {
        return;
    }
    uint8_t v = 0;
    if (nvs_get_u8(h, "wss", &v) != ESP_OK || v != (on ? 1 : 0)) {
        nvs_set_u8(h, "wss", on ? 1 : 0);
        nvs_commit(h);
    }
    nvs_close(h);
}

static void publish(esp_mqtt_client_handle_t client, const char *suffix, const char *msg, int qos, int retain) {
    if (!client) {
        return;
    }
    char topic[64];
    snprintf(topic, sizeof(topic), "tb/%s/%s", s.device_id, suffix);
    // enqueue never blocks the caller; the MQTT task sends it.
    esp_mqtt_client_enqueue(client, topic, msg, 0, qos, retain, true);
}

// ---- MQTT and WiFi events --------------------------------------------------------------

static void on_state(esp_mqtt_event_handle_t e) {
    // Only whole, small messages: state payloads are ~40 bytes. Empty = retained message cleared.
    if (e->current_data_offset != 0 || e->data_len != e->total_data_len) {
        return;
    }
    if (e->topic_len <= 0 || e->topic_len >= 64 || e->data_len <= 0 || e->data_len >= 96) {
        return;
    }
    char topic[64];
    char body[96];
    memcpy(topic, e->topic, e->topic_len);
    topic[e->topic_len] = 0;
    memcpy(body, e->data, e->data_len);
    body[e->data_len] = 0;
    const char *slash = strrchr(topic, '/');
    int idx = slash ? control_index(slash + 1) : -1;
    if (idx < 0) {
        return;
    }
    long v = 0, ver = 0, fs = 120, fv = 0;
    if (!json_long(body, "\"v\":", &v) || !json_long(body, "\"ver\":", &ver)) {
        return;
    }
    json_long(body, "\"fs\":", &fs);
    json_long(body, "\"fv\":", &fv);
    long max_v = idx < 4 ? 1 : 100;
    v = clamp(v, 0, max_v);
    fv = clamp(fv, 0, max_v);
    fs = clamp(fs, 0, 3600);
    portENTER_CRITICAL(&mux);
    s.values[idx] = (int)v;
    s.failsafe_sec[idx] = (uint16_t)fs;
    s.failsafe_value[idx] = (int)fv;
    s.failsafe_on[idx] = false;
    portEXIT_CRITICAL(&mux);
    char ack[64];
    snprintf(ack, sizeof(ack), "{\"key\":\"%s\",\"ver\":%ld}", control_keys[idx], ver);
    publish(e->client, "ack", ack, 1, 0);
    note("Cloud: %s = %ld", control_keys[idx], v);
}

static void on_event(void *arg, esp_event_base_t base, int32_t id, void *data) {
    esp_mqtt_event_handle_t e = (esp_mqtt_event_handle_t)data;
    switch ((esp_mqtt_event_id_t)id) {
        case MQTT_EVENT_CONNECTED: {
            s.connected = true;
            s.ever_connected = true;
            s.failures = 0;
            s.state = ST_CONNECTED;
            char msg[160];
            snprintf(msg, sizeof(msg), "{\"s\":\"online\",\"fw\":\"%s\",\"rssi\":%d,\"boot\":\"%s\",\"tr\":\"%s\"}",
                s.fw, wifi_rssi(), s.boot, s.use_wss ? "wss" : "mqtts");
            publish(e->client, "status", msg, 1, 1);
            char topic[64];
            snprintf(topic, sizeof(topic), "tb/%s/state/#", s.device_id);
            #if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 1, 0)
            esp_mqtt_client_subscribe_single(e->client, topic, 1);
            #else
            esp_mqtt_client_subscribe(e->client, topic, 1);
            #endif
            note("Cloud: connected (port %d)", s.use_wss ? s.ws_port : s.port);
            break;
        }
        case MQTT_EVENT_DISCONNECTED:
            if (s.connected) {
                s.reconnects++;
                s.down_since = esp_timer_get_time();
                note("Cloud: disconnected - retrying");
            }
            s.connected = false;
            if (s.state == ST_CONNECTED) {
                s.state = ST_CONNECTING;
            }
            break;
        case MQTT_EVENT_DATA:
            on_state(e);
            break;
        case MQTT_EVENT_ERROR:
            if (e->error_handle && e->error_handle->error_type == MQTT_ERROR_TYPE_CONNECTION_REFUSED) {
                int rc = (int)e->error_handle->connect_return_code;
                s.last_error = rc;
                if (rc == MQTT_CONNECTION_REFUSE_BAD_USERNAME || rc == MQTT_CONNECTION_REFUSE_NOT_AUTHORIZED) {
                    s.auth_rejected = true;
                }
            } else {
                if (e->error_handle && e->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT) {
                    s.last_error = e->error_handle->esp_tls_last_esp_err;
                }
                if (!s.connected && wifi_up() && s.failures < 255) {
                    s.failures++;
                }
            }
            break;
        default:
            break;
    }
}

static void on_wifi(void *arg, esp_event_base_t base, int32_t id, void *data) {
    if (!s.running) {
        return;
    }
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        note("Cloud: WiFi connected (RSSI %d)", wifi_rssi());
        return;
    }
    if (base != WIFI_EVENT || id != WIFI_EVENT_STA_DISCONNECTED) {
        return;
    }
    int64_t now = esp_timer_get_time();
    if (s.wifi_note && now - s.wifi_note < NOTE_GAP_US) {
        return;
    }
    s.wifi_note = now;
    uint8_t reason = ((wifi_event_sta_disconnected_t *)data)->reason;
    if (reason == WIFI_REASON_NO_AP_FOUND) {
        note("Cloud: WiFi name not found - check spelling, 2.4 GHz networks only");
    } else if (reason == WIFI_REASON_AUTH_FAIL || reason == WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT ||
               reason == WIFI_REASON_HANDSHAKE_TIMEOUT) {
        note("Cloud: wrong WiFi password?");
    } else {
        note("Cloud: WiFi lost (reason %u) - reconnecting", (unsigned)reason);
    }
}

// ---- client ------------------------------------------------------------------------------

// Both helpers run with s.lock held.
static void client_stop(void) {
    if (s.client) {
        esp_mqtt_client_destroy(s.client);
        s.client = NULL;
    }
    if (s.connected) {
        s.down_since = esp_timer_get_time();
    }
    s.connected = false;
}

static void client_start(int64_t now) {
    if (s.no_memory_at && now - s.no_memory_at < NO_MEMORY_RETRY_US) {
        return;
    }
    if (s.use_wss) {
        snprintf(s.uri, sizeof(s.uri), "wss://%s:%d%s", s.host, s.ws_port, s.ws_path);
    } else {
        snprintf(s.uri, sizeof(s.uri), "mqtts://%s:%d", s.host, s.port);
    }
    esp_mqtt_client_config_t cfg = {0};
    cfg.broker.address.uri = s.uri;
    cfg.broker.verification.certificate = s.ca;
    cfg.credentials.client_id = s.device_id;
    cfg.credentials.username = s.device_id;
    cfg.credentials.authentication.password = s.token[0] ? s.token : NULL;
    cfg.session.keepalive = 30;
    cfg.session.disable_clean_session = false;
    cfg.session.last_will.topic = s.will_topic;
    cfg.session.last_will.msg = "offline";
    cfg.session.last_will.msg_len = 7;
    cfg.session.last_will.qos = 1;
    cfg.session.last_will.retain = 1;
    cfg.network.reconnect_timeout_ms = 5000;
    cfg.network.timeout_ms = 10000;
    cfg.buffer.size = 1024;
    cfg.buffer.out_size = 1024;
    cfg.task.stack_size = 6144;
    s.client = esp_mqtt_client_init(&cfg);
    if (!s.client) {
        s.last_error = ESP_ERR_NO_MEM;
        s.no_memory_at = now;
        note("Cloud: not enough memory to start");
        return;
    }
    s.no_memory_at = 0;
    esp_mqtt_client_register_event(s.client, (esp_mqtt_event_id_t)ESP_EVENT_ANY_ID, on_event, NULL);
    s.ever_connected = false;
    s.failures = 0;
    s.transport_saved = false;
    s.state = ST_CONNECTING;
    if (s.use_wss) {
        s.wss_since = now;
    }
    esp_mqtt_client_start(s.client);
    note("Cloud: connecting to %s", s.uri);
}

static int append(char *buf, size_t size, int n, bool *first, const reading_t *r) {
    if (n < 0 || (size_t)n >= size || !isfinite(r->value)) {
        return n;
    }
    int w = r->is_int
        ? snprintf(buf + n, size - n, "%s\"%s\":%ld", *first ? "" : ",", r->key, (long)r->value)
        : snprintf(buf + n, size - n, "%s\"%s\":%.2f", *first ? "" : ",", r->key, (double)r->value);
    if (w < 0 || (size_t)w >= size - n) {
        return (int)size;
    }
    *first = false;
    return n + w;
}

// Sent even with no readings: it doubles as the heartbeat.
static void send_telemetry(void) {
    reading_t copy[MAX_READINGS];
    portENTER_CRITICAL(&mux);
    int count = s.n_readings;
    memcpy(copy, s.readings, sizeof(reading_t) * count);
    portEXIT_CRITICAL(&mux);
    char buf[768];
    bool first = true;
    int n = snprintf(buf, sizeof(buf), "{\"seq\":%lu,\"boot\":\"%s\",\"v\":{", (unsigned long)(s.seq + 1), s.boot);
    for (int i = 0; i < count; i++) {
        n = append(buf, sizeof(buf), n, &first, &copy[i]);
    }
    if (n < 0 || (size_t)n + 3 > sizeof(buf)) {
        return;
    }
    buf[n++] = '}';
    buf[n++] = '}';
    buf[n] = 0;
    s.seq++;
    publish(s.client, "telemetry", buf, 0, 0);
}

// ---- supervisor task ---------------------------------------------------------------------

static void supervisor(void *arg) {
    while (s.running) {
        vTaskDelay(pdMS_TO_TICKS(100));
        int64_t now = esp_timer_get_time();
        bool up = wifi_up();

        xSemaphoreTake(s.lock, portMAX_DELAY);
        if (up) {
            s.wifi_lost_at = 0;
        } else {
            if (!s.wifi_lost_at) {
                s.wifi_lost_at = now;
            }
            if (!s.connected) {
                s.state = ST_WIFI_WAIT;
            }
        }
        if (!up && now - s.wifi_kick >= WIFI_KICK_US) {
            s.wifi_kick = now;
            esp_wifi_connect();
        }
        // The WiFi driver can get stuck after a power dip or router hiccup: restart it.
        if (s.wifi_lost_at && now - s.wifi_lost_at >= WIFI_RESTART_US) {
            s.wifi_lost_at = now;
            s.wifi_restarts++;
            note("Cloud: WiFi stuck - restarting WiFi");
            client_stop();
            esp_wifi_disconnect();
            xSemaphoreGive(s.lock);
            vTaskDelay(pdMS_TO_TICKS(500));
            xSemaphoreTake(s.lock, portMAX_DELAY);
            esp_wifi_connect();
            s.wifi_kick = esp_timer_get_time();
        }
        // WiFi is fine but MQTT has not come back for 2 min: start a fresh connection.
        if (up && s.client && s.ever_connected && !s.connected &&
            now - s.down_since >= MQTT_STUCK_US && now - s.mqtt_kick >= MQTT_STUCK_US) {
            s.mqtt_kick = now;
            s.fresh_starts++;
            note("Cloud: reconnect stuck - starting a fresh connection");
            client_stop();
        }
        if (s.auth_rejected) {
            s.auth_rejected = false;
            client_stop();
            s.auth_paused = true;
            s.auth_at = now;
            note("Cloud: login rejected - re-upload from Studio (trying again in 5 min)");
        }
        if (s.auth_paused && now - s.auth_at >= AUTH_PAUSE_US) {
            s.auth_paused = false;
        }
        if (up && !s.client && !s.auth_paused) {
            client_start(now);
        }
        // TLS port blocked (school networks)? Try the WebSocket port, and back again.
        if (s.client && !s.ever_connected && s.failures >= SWAP_AFTER_FAILURES) {
            client_stop();
            s.use_wss = !s.use_wss;
            if (s.use_wss) {
                note("Cloud: port %d blocked? using port %d", s.port, s.ws_port);
            } else {
                note("Cloud: trying port %d again", s.port);
            }
            client_start(now);
        }
        if (s.connected && !s.transport_saved) {
            s.transport_saved = true;
            nvs_put_wss(s.use_wss);
        }
        // Once a day on the WebSocket port, forget it so the next start tries TLS first again.
        if (s.use_wss && s.connected && !s.retest_scheduled && now - s.wss_since >= WSS_RETEST_US) {
            s.retest_scheduled = true;
            nvs_put_wss(false);
        }

        if (!s.connected) {
            int64_t down = now - s.down_since;
            for (int i = 0; i < N_CONTROLS; i++) {
                portENTER_CRITICAL(&mux);
                uint16_t fs = s.failsafe_sec[i];
                bool fire = fs > 0 && !s.failsafe_on[i] && down >= (int64_t)fs * 1000000;
                if (fire) {
                    s.failsafe_on[i] = true;
                    s.values[i] = s.failsafe_value[i];
                }
                int fv = s.failsafe_value[i];
                portEXIT_CRITICAL(&mux);
                if (fire) {
                    note("Cloud: offline %us - %s set to safe value %d", (unsigned)fs, control_keys[i], fv);
                }
            }
        }

        if (s.connected) {
            char text[ALERT_MAX];
            bool pending = false;
            portENTER_CRITICAL(&mux);
            if (s.alert_pending) {
                memcpy(text, s.alert, sizeof(text));
                s.alert_pending = false;
                pending = true;
            }
            portEXIT_CRITICAL(&mux);
            if (pending) {
                publish(s.client, "alert", text, 1, 0);
            }

            int64_t since = now - s.last_send;
            portENTER_CRITICAL(&mux);
            bool due = since >= (int64_t)s.interval_ms * 1000 ||
                (s.send_now && since >= (int64_t)s.min_gap_ms * 1000);
            if (due) {
                s.send_now = false;
            }
            portEXIT_CRITICAL(&mux);
            if (due) {
                s.last_send = now;
                send_telemetry();
            }
        }
        xSemaphoreGive(s.lock);
    }
    xSemaphoreTake(s.lock, portMAX_DELAY);
    if (s.client && s.connected) {
        // A clean disconnect does not fire the last will: say it ourselves.
        char topic[64];
        snprintf(topic, sizeof(topic), "tb/%s/status", s.device_id);
        esp_mqtt_client_publish(s.client, topic, "offline", 7, 1, 1);
        vTaskDelay(pdMS_TO_TICKS(200));
    }
    client_stop();
    s.state = ST_STOPPED;
    s.task = NULL;
    xSemaphoreGive(s.lock);
    vTaskDelete(NULL);
}

static void stop_and_wait(void) {
    if (!s.task) {
        return;
    }
    s.running = false;
    for (int i = 0; i < 60 && s.task; i++) {
        MP_THREAD_GIL_EXIT();
        vTaskDelay(pdMS_TO_TICKS(50));
        MP_THREAD_GIL_ENTER();
    }
}

// ---- Python API --------------------------------------------------------------------------

static mp_obj_t tbcloud_start(size_t n_args, const mp_obj_t *pos_args, mp_map_t *kw_args) {
    enum { ARG_host, ARG_port, ARG_ws_port, ARG_device_id, ARG_token, ARG_ca, ARG_ws_path, ARG_interval_ms, ARG_min_gap_ms, ARG_fw };
    static const mp_arg_t allowed[] = {
        { MP_QSTR_host, MP_ARG_REQUIRED | MP_ARG_OBJ, {.u_obj = MP_OBJ_NULL} },
        { MP_QSTR_port, MP_ARG_REQUIRED | MP_ARG_INT, {.u_int = 8883} },
        { MP_QSTR_ws_port, MP_ARG_REQUIRED | MP_ARG_INT, {.u_int = 443} },
        { MP_QSTR_device_id, MP_ARG_REQUIRED | MP_ARG_OBJ, {.u_obj = MP_OBJ_NULL} },
        { MP_QSTR_token, MP_ARG_REQUIRED | MP_ARG_OBJ, {.u_obj = mp_const_none} },
        { MP_QSTR_ca, MP_ARG_REQUIRED | MP_ARG_OBJ, {.u_obj = MP_OBJ_NULL} },
        { MP_QSTR_ws_path, MP_ARG_KW_ONLY | MP_ARG_OBJ, {.u_obj = mp_const_none} },
        { MP_QSTR_interval_ms, MP_ARG_KW_ONLY | MP_ARG_INT, {.u_int = 10000} },
        { MP_QSTR_min_gap_ms, MP_ARG_KW_ONLY | MP_ARG_INT, {.u_int = 5000} },
        { MP_QSTR_fw, MP_ARG_KW_ONLY | MP_ARG_OBJ, {.u_obj = mp_const_none} },
    };
    mp_arg_val_t args[MP_ARRAY_SIZE(allowed)];
    mp_arg_parse_all(n_args, pos_args, kw_args, MP_ARRAY_SIZE(allowed), allowed, args);

    if (!s.lock) {
        s.lock = xSemaphoreCreateMutex();
    }
    stop_and_wait();

    copy_str(s.host, sizeof(s.host), args[ARG_host].u_obj);
    copy_str(s.device_id, sizeof(s.device_id), args[ARG_device_id].u_obj);
    copy_str(s.token, sizeof(s.token), args[ARG_token].u_obj);
    copy_str(s.ws_path, sizeof(s.ws_path), args[ARG_ws_path].u_obj);
    copy_str(s.fw, sizeof(s.fw), args[ARG_fw].u_obj);
    if (!s.ws_path[0]) {
        strcpy(s.ws_path, "/mqtt");
    }
    if (!s.fw[0]) {
        strcpy(s.fw, "mpy-1");
    }
    s.port = args[ARG_port].u_int;
    s.ws_port = args[ARG_ws_port].u_int;
    s.interval_ms = args[ARG_interval_ms].u_int;
    s.min_gap_ms = args[ARG_min_gap_ms].u_int;
    snprintf(s.will_topic, sizeof(s.will_topic), "tb/%s/status", s.device_id);

    size_t ca_len;
    const char *ca = mp_obj_str_get_data(args[ARG_ca].u_obj, &ca_len);
    free(s.ca);
    // esp-mqtt keeps a pointer to the PEM, so it lives outside the GC heap.
    s.ca = malloc(ca_len + 1);
    if (!s.ca) {
        mp_raise_msg(&mp_type_MemoryError, MP_ERROR_TEXT("no memory for the CA"));
    }
    memcpy(s.ca, ca, ca_len);
    s.ca[ca_len] = 0;

    int64_t now = esp_timer_get_time();
    snprintf(s.boot, sizeof(s.boot), "%08lx", (unsigned long)esp_random());
    s.state = ST_WIFI_WAIT;
    s.connected = false;
    s.ever_connected = false;
    s.auth_rejected = false;
    s.auth_paused = false;
    s.failures = 0;
    s.reconnects = 0;
    s.last_error = 0;
    s.wifi_restarts = 0;
    s.fresh_starts = 0;
    s.use_wss = nvs_get_wss();
    s.transport_saved = false;
    s.retest_scheduled = false;
    s.wifi_lost_at = 0;
    s.wifi_kick = now;
    s.wifi_note = 0;
    s.down_since = now;
    s.mqtt_kick = 0;
    s.no_memory_at = 0;
    s.last_send = 0;
    s.seq = 0;
    portENTER_CRITICAL(&mux);
    s.n_readings = 0;
    s.send_now = false;
    for (int i = 0; i < N_CONTROLS; i++) {
        s.values[i] = 0;
        s.failsafe_sec[i] = 120;
        s.failsafe_value[i] = 0;
        s.failsafe_on[i] = false;
    }
    s.alert_pending = false;
    s.alert_ever = false;
    s.alert_note_at = 0;
    s.line_head = 0;
    s.line_count = 0;
    s.drain_scheduled = false;
    portEXIT_CRITICAL(&mux);

    // Needs the default event loop, which network.WLAN().active(True) creates.
    if (!s.handlers &&
        esp_event_handler_instance_register(WIFI_EVENT, WIFI_EVENT_STA_DISCONNECTED, on_wifi, NULL, NULL) == ESP_OK &&
        esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_wifi, NULL, NULL) == ESP_OK) {
        s.handlers = true;
    }

    s.running = true;
    if (xTaskCreatePinnedToCore(supervisor, "tbcloud", 6144, NULL, 4, &s.task, 0) != pdPASS) {
        s.running = false;
        s.task = NULL;
        mp_raise_msg(&mp_type_MemoryError, MP_ERROR_TEXT("no memory for the cloud task"));
    }
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_KW(tbcloud_start_obj, 6, tbcloud_start);

static mp_obj_t tbcloud_set(mp_obj_t key_in, mp_obj_t value_in) {
    size_t len;
    const char *key = mp_obj_str_get_data(key_in, &len);
    bool ok = len > 0 && len < KEY_MAX;
    for (size_t i = 0; ok && i < len; i++) {
        char c = key[i];
        ok = c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (i > 0 && c >= '0' && c <= '9');
    }
    if (!ok) {
        mp_raise_ValueError(MP_ERROR_TEXT("reading names use letters, digits and _ (up to 23)"));
    }
    bool remove = value_in == mp_const_none;
    float value = 0;
    bool is_int = false;
    if (!remove) {
        if (mp_obj_is_bool(value_in) || mp_obj_is_int(value_in)) {
            is_int = true;
            value = (float)mp_obj_get_int(value_in);
        } else if (mp_obj_is_float(value_in)) {
            value = mp_obj_get_float(value_in);
        } else {
            mp_raise_TypeError(MP_ERROR_TEXT("readings are numbers"));
        }
    }
    bool stored = false;
    portENTER_CRITICAL(&mux);
    int found = -1;
    for (int i = 0; i < s.n_readings; i++) {
        if (strncmp(s.readings[i].key, key, KEY_MAX) == 0) {
            found = i;
            break;
        }
    }
    if (remove) {
        if (found >= 0) {
            memmove(&s.readings[found], &s.readings[found + 1], sizeof(reading_t) * (s.n_readings - found - 1));
            s.n_readings--;
        }
        stored = true;
    } else {
        if (found < 0 && s.n_readings < MAX_READINGS) {
            // The Cloud service drops a message with more than 24 readings: skip the rest.
            found = s.n_readings++;
            memcpy(s.readings[found].key, key, len);
            s.readings[found].key[len] = 0;
        }
        if (found >= 0) {
            s.readings[found].value = value;
            s.readings[found].is_int = is_int;
            stored = true;
        }
    }
    portEXIT_CRITICAL(&mux);
    return mp_obj_new_bool(stored);
}
static MP_DEFINE_CONST_FUN_OBJ_2(tbcloud_set_obj, tbcloud_set);

static mp_obj_t tbcloud_send_now(void) {
    portENTER_CRITICAL(&mux);
    s.send_now = true;
    portEXIT_CRITICAL(&mux);
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_0(tbcloud_send_now_obj, tbcloud_send_now);

static mp_obj_t tbcloud_alert(mp_obj_t text_in) {
    size_t len;
    const char *text = mp_obj_str_get_data(text_in, &len);
    int64_t now = esp_timer_get_time();
    int result;
    portENTER_CRITICAL(&mux);
    if (s.alert_pending || (s.alert_ever && now - s.alert_at < ALERT_GAP_US)) {
        if (!s.alert_note_at || now - s.alert_note_at >= NOTE_GAP_US) {
            s.alert_note_at = now;
            result = 1;
        } else {
            result = 2;
        }
    } else {
        size_t n = len < ALERT_MAX - 1 ? len : ALERT_MAX - 1;
        memcpy(s.alert, text, n);
        s.alert[n] = 0;
        s.alert_pending = true;
        s.alert_ever = true;
        s.alert_at = now;
        result = 0;
    }
    portEXIT_CRITICAL(&mux);
    return mp_obj_new_int(result);
}
static MP_DEFINE_CONST_FUN_OBJ_1(tbcloud_alert_obj, tbcloud_alert);

static mp_obj_t tbcloud_get(mp_obj_t key_in) {
    int idx = control_index(mp_obj_str_get_str(key_in));
    if (idx < 0) {
        mp_raise_ValueError(MP_ERROR_TEXT("dashboard controls are switch1-4 and slider1-2"));
    }
    portENTER_CRITICAL(&mux);
    int v = s.values[idx];
    portEXIT_CRITICAL(&mux);
    return mp_obj_new_int(v);
}
static MP_DEFINE_CONST_FUN_OBJ_1(tbcloud_get_obj, tbcloud_get);

static mp_obj_t tbcloud_status(void) {
    mp_obj_t t[7] = {
        mp_obj_new_int(s.task ? s.state : ST_STOPPED),
        mp_obj_new_int(s.reconnects),
        mp_obj_new_str(s.use_wss ? "wss" : "mqtts", s.use_wss ? 3 : 5),
        mp_obj_new_int(s.last_error),
        mp_obj_new_int(s.wifi_restarts),
        mp_obj_new_int(s.fresh_starts),
        mp_obj_new_int_from_uint(s.seq),
    };
    return mp_obj_new_tuple(7, t);
}
static MP_DEFINE_CONST_FUN_OBJ_0(tbcloud_status_obj, tbcloud_status);

static mp_obj_t tbcloud_stop(void) {
    stop_and_wait();
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_0(tbcloud_stop_obj, tbcloud_stop);

static const mp_rom_map_elem_t tbcloud_globals_table[] = {
    { MP_ROM_QSTR(MP_QSTR___name__), MP_ROM_QSTR(MP_QSTR_tbcloud) },
    { MP_ROM_QSTR(MP_QSTR_start), MP_ROM_PTR(&tbcloud_start_obj) },
    { MP_ROM_QSTR(MP_QSTR_set), MP_ROM_PTR(&tbcloud_set_obj) },
    { MP_ROM_QSTR(MP_QSTR_send_now), MP_ROM_PTR(&tbcloud_send_now_obj) },
    { MP_ROM_QSTR(MP_QSTR_alert), MP_ROM_PTR(&tbcloud_alert_obj) },
    { MP_ROM_QSTR(MP_QSTR_get), MP_ROM_PTR(&tbcloud_get_obj) },
    { MP_ROM_QSTR(MP_QSTR_status), MP_ROM_PTR(&tbcloud_status_obj) },
    { MP_ROM_QSTR(MP_QSTR_stop), MP_ROM_PTR(&tbcloud_stop_obj) },
};
static MP_DEFINE_CONST_DICT(tbcloud_globals, tbcloud_globals_table);

const mp_obj_module_t tbcloud_module = {
    .base = { &mp_type_module },
    .globals = (mp_obj_dict_t *)&tbcloud_globals,
};

MP_REGISTER_MODULE(MP_QSTR_tbcloud, tbcloud_module);
