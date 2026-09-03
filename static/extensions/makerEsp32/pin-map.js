/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/**
 * Maker ESP32 RJ11 hardware map — source of truth.
 * Do not change pin numbers without updating the board table.
 */
(function (root) {
    const PINS = {
        STEP_IN1: 12,
        STEP_IN2: 13,
        STEP_IN3: 14,
        STEP_IN4: 27,
        MOTOR_A1: 5,
        MOTOR_A2: 17,
        MOTOR_B1: 18,
        MOTOR_B2: 19,
        SDA: 21,
        SCL: 22,
        A1: 32,
        A2: 34,
        A3: 35,
        D4: 25,
        D5: 26,
        D13: 33,
        SPARE1: 15,
        SPARE2: 2
    };

    root.MakerEsp32Hardware = {
        pins: PINS,
        digitalPorts: {
            D4: 'D4_PIN',
            D5: 'D5_PIN',
            D13: 'D13_PIN',
            SPARE1: 'SPARE1_PIN',
            SPARE2: 'SPARE2_PIN'
        },
        analogPorts: {
            A1: 'A1_PIN',
            A2: 'A2_PIN',
            A3: 'A3_PIN'
        }
    };
}(typeof globalThis !== 'undefined' ? globalThis : this));
