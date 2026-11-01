import btn from './btn.js';
import dht from './dht.js';
import led from './led.js';
import mic from './mic.js';
import mq2 from './mq2.js';
import oled from './oled.js';
import pot from './pot.js';
import pulse from './pulse.js';
import rfid from './rfid.js';
import servo from './servo.js';
import soil from './soil.js';
import ultra from './ultra.js';

/** Modelled modules, keyed by the studio's module id. Add a file in components/ and list it here. */
const MODELS = {led, btn, dht, pot, mq2, mic, pulse, soil, ultra, rfid, oled, servo};

export default MODELS;
