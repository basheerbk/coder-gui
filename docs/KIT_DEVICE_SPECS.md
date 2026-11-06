# TinkerBit Maker ESP32 kit: device specs

The parts Beginner Studio supports, the jack each one plugs into, what it reads or does, and the limits the Studio enforces. The source of truth is [modules.js](../src/beginner-studio/domain/modules.js) (parts), [ports.js](../src/beginner-studio/domain/ports.js) (jacks and rules) and [codegen.js](../src/beginner-studio/domain/codegen.js) (what the generated sketch does).

**Totals: 29 parts, 16 inputs and 13 outputs.** Three of the outputs also receive data: Bluetooth (BLE), HC-05 Bluetooth and TinkerBit Cloud.

| Group | Count |
|-------|-------|
| Input controls | 2 |
| Sensors | 14 |
| Outputs (incl. 3 two-way parts) | 13 |
| **Total** | **29** |

---

## 1. Board and jacks

Board: Maker ESP32 on the RJ11 hub (FQBN `esp32:esp32:esp32`). Serial runs at 9600 baud.

| Jack | GPIO | Kind | Used by |
|------|------|------|---------|
| A1 | IO4 | Analog / digital | Analog sensors, on/off parts; first choice for the DHT11 |
| A2 | IO15 (strapping) | Analog / digital | Analog sensors, on/off parts |
| A3 | IO2 (strapping) | Analog / digital | Analog sensors, on/off parts |
| A4 | IO0 (BOOT) | Analog / digital | Analog sensors, on/off parts; unplug if Upload acts up |
| D13 | IO33 | Digital | On/off parts (LED, button, relay, servo, ...) |
| D5 | IO25 Echo, IO26 Trig | Ultrasonic | HC-SR04 only |
| ST | IO12, IO13, IO14, IO27 | Stepper | Stepper motor only |
| MD | IO17, IO5 (motor A), IO18, IO19 (motor B) | Motor | L293D motor driver or 4-channel relay |
| I2C, I2C1 | IO21 SDA, IO22 SCL (one shared bus) | I2C | OLED screen, heartbeat sensor, MPU6050 |
| 3D | IO32 SS, IO33 RST, IO34 MISO (+ SCK IO16, MOSI IO23 on board) | SPI | RFID RC522 only |
| UART | IO3 RX, IO1 TX (same as USB serial) | UART | HC-05 only |
| ESP (onboard) | — | Built in | Bluetooth (BLE), TinkerBit Cloud |

Jack rules:

- **D13 and 3D cannot be used together**: both use IO33.
- **D5 is kept for the ultrasonic sensor**: driving its Echo pin as an output heats the module.
- **A1–A4 are off while Cloud is on**: they are on ADC2, which WiFi takes over.
- **I2C is one shared bus**: the OLED, heartbeat sensor and MPU6050 can all be plugged in at once; `Wire.begin` runs once.
- **A2, A3, A4 and ST are strapping pins**: A4 (BOOT) is the one most likely to stop an upload.

### 1.1 More than one of the same part

Parts that use the shared on/off and analog jacks (D13, A1–A4) can be plugged in more than once, up to the five jacks: button, potentiometer, LED, relay, buzzer, pump, solenoid lock, servo, MQ-2, microphone, soil moisture, DHT11, IR obstacle, PIR, reed switch, LDR, flame and water level. Every other part stays one per board: it has a jack of its own (D5, ST, MD, 3D, UART), a fixed I2C address (OLED, heartbeat, MPU6050) or is built in (BLE, Cloud).

- The second copy is called "Push Button 2" on the board, in the palette and in Board messages. The first copy shows as "Push Button 1" while there are two.
- Each copy has its own reading: `buttonState` and `buttonState2`, `temperature`/`humidity` and `temperature2`/`humidity2`. A second DHT11 also gets its own 2-second timer (`lastDhtMs2`).
- Each copy gets its own If option, Cloud reading and Edge AI input. A part block (turn LED on, set servo angle, ...) has a "Which part" dropdown to point it at the other copy.
- Copy numbers never change: unplugging Push Button 1 leaves Push Button 2 and its blocks as they were, and the next button plugged in takes number 1 again.
- With Cloud on, only D13 is left for on/off parts, so two copies are not possible then.

---

## 2. Input devices (16)

### 2.1 Controls (2)

| Part | Jack | Reading (variable) | Range | Notes |
|------|------|--------------------|-------|-------|
| Push Button | D13, A1–A4 | Pressed or not (`buttonState`) | Yes / no | `INPUT_PULLUP`, pressed reads LOW |
| Potentiometer | A1–A4 | Knob position (`knobValue`) | 0–4095 | Average of 12 readings |

### 2.2 Sensors (14)

| Part | Jack | Reading (variable) | Range / unit | Notes |
|------|------|--------------------|--------------|-------|
| MQ-2 Gas Sensor | A1–A4 | Gas level (`gasLevel`) | 0–4095 (raw) | Average of 16 readings. Heater needs about a minute. Not ppm |
| Microphone | A1–A4 | Sound level (`soundLevel`) | 0–4095 (raw) | Average of 12 readings |
| Heartbeat HW-605 (MAX30102) | I2C | Heartbeat (`heartRate`) | bpm; 0 with no finger | I2C at 100 kHz |
| Capacitive Soil Moisture | A1–A4 | Soil moisture (`soilMoisture`) | 0–100 % | Raw ≈3200 in air = 0 %, ≈1200 in water = 100 % |
| DHT11 Temp & Humid | A1 (then A2, A3, D13) | Temperature (`temperature`), humidity (`humidity`) | °C, % | Read at most every 2 s; IO33 (D13) is unreliable for it |
| HC-SR04 Ultrasonic | D5 only | Distance (`distance`) | 2–400 cm; −1 = no echo | Echo stays an input; use the kit cable |
| IR Obstacle Sensor | D13, A1–A4 | Something in front (`obstacleNear`) | Yes / no | Active-low; screw sets the distance |
| PIR Motion Sensor | D13, A1–A4 | Movement (`motionSeen`) | Yes / no | Needs about a minute to settle after power-up |
| Reed Switch | D13, A1–A4 | Magnet near (`magnetNear`) | Yes / no | Active-low; for doors and windows |
| LDR Light Sensor | D13, A1–A4 | Dark or not (`isDark`) | Yes / no | Screw sets how dark |
| Flame Sensor | D13, A1–A4 | Flame seen (`flameSeen`) | Yes / no | Active-low |
| Water Level Sensor | A1–A4 | Water level (`waterLevel`) | 0–4095 (raw) | Only the striped part goes in water |
| MPU6050 Motion | I2C | Tilt (`tiltAngle`), shake (`shakeLevel`) | −90 to 90°; 0–100 (−1 = sensor missing) | Address 0x68 or 0x69, retried every 5 s. Edge AI learns moves from it |
| RFID RC522 | 3D only | Card ID (`rfidUid`) | Hex text | SPI; blocks D13 |

Yes / no sensors are used as "If ... sees something" blocks; number sensors are compared with <, >, ≤, ≥, = or ≠.

---

## 3. Output devices (13)

### 3.1 Outputs (10)

| Part | Jack | Blocks | Limits | Notes |
|------|------|--------|--------|-------|
| LED | D13, A1–A4 | On / off, brightness, blink | Brightness 0–255; blink 20–60000 ms | Brightness is PWM on the same pin |
| Relay Module | D13, A1–A4 | On / off | — | Switches a bigger gadget |
| Buzzer | D13, A1–A4 | Beep, on / off | Beep 20–10000 ms | Kept off while the board starts |
| Water Pump | D13, A1–A4 | On / off | — | Needs its own power adapter; kept off while the board starts |
| Solenoid Lock | D13, A1–A4 | Open / close | — | Needs its 12 V adapter; open a few seconds at a time; kept closed while the board starts |
| Servo Motor | D13, A1–A4 | Set angle | 0–180° | ESP32Servo, 500–2400 µs pulses |
| L293D Motor Driver | MD only | Set speed (motor A or B, forward or backward), stop | Speed 0–255 | Motor A = IO17/IO5, motor B = IO18/IO19 |
| 4-Ch Relay (MD) | MD only | Channel 1–4 on / off, all channels | 4 channels | Active-low; all channels set off at start |
| Stepper Motor | ST only | Move steps | −10000 to 10000 steps; 1–60 RPM | 200 steps per turn |
| OLED Screen | I2C | Show text, show number | 128 × 64 pixels | SSD1306 at address 0x3C |

### 3.2 Two-way devices (3)

| Part | Jack | Sends | Receives | Notes |
|------|------|-------|----------|-------|
| Bluetooth (BLE) | Built in | Turn on with a name, send text | — | Cannot be used with Cloud |
| HC-05 Bluetooth | UART only | Send a line of text | Read a line (`hc05Line`) | 9600 baud on the USB serial pins; unplug it if Upload fails |
| TinkerBit Cloud | Built in (WiFi) | Readings (automatic, at most every 5 s), alerts, "send now" | Up to 4 switches and 2 sliders from the phone dashboard | Turns A1–A4 off; cannot be used with BLE; 2.4 GHz WiFi only |

---

## 4. Program blocks that need no part

| Block | Limits |
|-------|--------|
| Wait | 0–3600 s |
| Repeat | 0–1000 times |
| If … then / otherwise | Compares any reading above, a Cloud switch or slider, or the Edge AI answer |
| Print text, print variable | To Board messages (USB serial, 9600 baud) |

## 5. Edge AI (uses the parts above)

| Kind | Learns from | Example |
|------|-------------|---------|
| Motion | MPU6050 (6 axes, 100 readings a second, 24 features per move) | Wave, circle, knock |
| Sensors | The number and yes / no sensors wired in (not button, RFID, heartbeat or HC-05) | Empty room, someone here |

Limits: 2–4 things, 10–40 examples each, names up to 16 letters. The model runs on the board; no internet needed.

## 6. Libraries the sketches use

ESP32Servo (servo), SparkFun MAX3010x (heartbeat), Adafruit SSD1306 and GFX (OLED), MFRC522 (RFID), Stepper (stepper), ESP32 BLE (Bluetooth). The DHT11, ultrasonic and MPU6050 are read without extra libraries.
