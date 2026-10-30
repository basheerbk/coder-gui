/**
 * Studio port id → the RJ11 Hub jack it sits on (jack ids from module-test/components/hub-layout.js).
 * The hub's bottom RJ11 jack has no studio port; ONBOARD is the ESP32 module itself.
 * Kept free of imports so module-test/tools/export-studio-art.mjs can read it in Node.
 */
const HUB_JACK = {
    'A4': 'A4',
    'D5': 'N01',
    'STEPPER': 'STEPPER1',
    'A1': 'A1',
    'D13': 'D13',
    'I2C': 'I2C',
    'I2C1': 'I2C1',
    'MD': 'TOP-R',
    'A3': 'A3',
    'A2': 'A2',
    'UART': 'UART1',
    '3D': 'J0'
};

export {HUB_JACK};
