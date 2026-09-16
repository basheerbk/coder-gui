/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/**
 * Maker ESP32 RJ11 hardware map — source of truth (connector schematic).
 * Do not change pin numbers without updating the board table.
 *
 * Analog jacks are ADC2 (IO0/2/4/15). SPARE1/SPARE2 kept as aliases of A2/A3.
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
        A1: 4,
        A2: 15,
        A3: 2,
        A4: 0,
        D4: 25,
        D5: 26,
        D13: 33,
        T3D: 32,
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
