import ir from './ir.js';
import ldr from './ldr.js';
import flame from './flame.js';
import water from './water.js';
import tsop from './tsop.js';
import irline from './irline.js';
import mpu6050 from './mpu6050.js';
import pir from './pir.js';
import reed from './reed.js';
import lcd from './lcd.js';
import rgb from './rgb.js';
import strip from './strip.js';
import matrix from './matrix.js';
import drv8833 from './drv8833.js';
import bomotor from './bomotor.js';
import stepper from './stepper.js';
import relay from './relay.js';
import relay4 from './relay4.js';
import buzzer from './buzzer.js';
import i2samp from './i2samp.js';
import pump from './pump.js';
import solenoid from './solenoid.js';
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
const MODELS = {
    led, btn, dht, pot, mq2, mic, pulse, soil, ultra, rfid, oled, servo,
    ir, ldr, flame, water, tsop, irline, mpu6050, pir, reed,
    lcd, rgb, strip, matrix, drv8833, bomotor, stepper, relay, relay4, buzzer, i2samp, pump, solenoid
};

export default MODELS;
