/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/**
 * Maker ESP32 RJ11 hardware map — source of truth (connector schematic).
 * Do not change pin numbers without updating the board table.
 *
 * D5 RJ11 is one jack: pin2=IO25 Echo, pin3=IO26 Trig (HC-SR04; Echo = INPUT).
 * MD RJ11: pin2=IO17 pin3=IO5 (Motor A), pin4=IO18 pin5=IO19 (Motor B).
 * RC522 on 3D: SS=32 RST=33 MISO=34; SPI bus SCK=16 MOSI=23 (not D5).
 */
(function (root) {
    const PINS = {
        STEP_IN1: 12,
        STEP_IN2: 13,
        STEP_IN3: 14,
        STEP_IN4: 27,
        MOTOR_A1: 17,
        MOTOR_A2: 5,
        MOTOR_B1: 18,
        MOTOR_B2: 19,
        SDA: 21,
        SCL: 22,
        A1: 4,
        A2: 15,
        A3: 2,
        A4: 0,
        D4: 25,
        D5: 26,
        D13: 33,
        T3D: 32,
        RFID_SS: 32,
        RFID_RST: 33,
        RFID_MISO: 34,
        RFID_SCK: 16,
        RFID_MOSI: 23,
        SPARE1: 15,
        SPARE2: 2
    };

    root.MakerEsp32Hardware = {
        pins: PINS,
        digitalPorts: {
            D4: 'D4_PIN',
            D5: 'D5_PIN',
            D13: 'D13_PIN',
            T3D: 'T3D_PIN',
            '3D': 'T3D_PIN',
            A2: 'A2_PIN',
            A3: 'A3_PIN',
            SPARE1: 'A2_PIN',
            SPARE2: 'A3_PIN'
        },
        analogPorts: {
            A1: 'A1_PIN',
            A2: 'A2_PIN',
            A3: 'A3_PIN',
            A4: 'A4_PIN'
        }
    };
}(typeof globalThis !== 'undefined' ? globalThis : this));
