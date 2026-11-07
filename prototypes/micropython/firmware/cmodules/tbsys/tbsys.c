// tbsys: small native helpers for TinkerBit firmware (Stage B).
//
//   tbsys.skip_main()
//       Called from frozen _boot.py when TB_SAFE arrives. Switches pyexec to raw-REPL mode;
//       ports/esp32/main.c only runs main.py in friendly-REPL mode, so main.py is skipped
//       and the host lands in the raw REPL.
//
//   tbsys.sample(adc, buf, rate_hz) -> (rate_hz, max_jitter_pct, mean_jitter_pct, overruns)
//       Fills array('h') `buf` with 12-bit readings (adc.read_u16() >> 4) paced by
//       esp_timer at `rate_hz`. Calling the ADC object's own read_u16 keeps pin and driver
//       handling in MicroPython (no GPIO numbers here, no clash between ADC drivers).
//       Jitter is the deviation of each sample interval from the ideal period.

#include <stdlib.h>

#include "py/runtime.h"
#include "py/obj.h"
#include "shared/runtime/pyexec.h"
#include "esp_timer.h"

static mp_obj_t tbsys_skip_main(void) {
    pyexec_mode_kind = PYEXEC_MODE_RAW_REPL;
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_0(tbsys_skip_main_obj, tbsys_skip_main);

static mp_obj_t tbsys_sample(mp_obj_t adc_in, mp_obj_t buf_in, mp_obj_t rate_in) {
    mp_buffer_info_t bufinfo;
    mp_get_buffer_raise(buf_in, &bufinfo, MP_BUFFER_WRITE);
    if (bufinfo.typecode != 'h') {
        mp_raise_ValueError(MP_ERROR_TEXT("buf must be array('h')"));
    }
    size_t n = bufinfo.len / sizeof(int16_t);
    mp_int_t rate = mp_obj_get_int(rate_in);
    if (n < 2 || rate < 100 || rate > 50000) {
        mp_raise_ValueError(MP_ERROR_TEXT("need 2+ samples and 100..50000 Hz"));
    }
    int16_t *out = (int16_t *)bufinfo.buf;

    mp_obj_t read[2];
    mp_load_method(adc_in, MP_QSTR_read_u16, read);

    const int64_t period = 1000000 / rate;
    int64_t next = esp_timer_get_time();
    int64_t first = 0;
    int64_t prev = 0;
    int64_t max_dev = 0;
    int64_t sum_dev = 0;
    mp_int_t overruns = 0;

    for (size_t i = 0; i < n; i++) {
        int64_t t;
        while ((t = esp_timer_get_time()) < next) {
        }
        out[i] = (int16_t)(mp_obj_get_int(mp_call_method_n_kw(0, 0, read)) >> 4);
        if (i == 0) {
            first = t;
        } else {
            int64_t dev = llabs((t - prev) - period);
            sum_dev += dev;
            if (dev > max_dev) {
                max_dev = dev;
            }
        }
        prev = t;
        next += period;
        if (t >= next) {
            // A whole period was lost (interrupt or slow read): restart the schedule.
            overruns++;
            next = t + period;
        }
    }

    int64_t span = prev - first;
    mp_obj_t result[4] = {
        mp_obj_new_int(span > 0 ? (mp_int_t)((int64_t)(n - 1) * 1000000 / span) : 0),
        mp_obj_new_float((mp_float_t)max_dev * 100 / (mp_float_t)period),
        mp_obj_new_float((mp_float_t)sum_dev * 100 / (mp_float_t)period / (mp_float_t)(n - 1)),
        mp_obj_new_int(overruns),
    };
    return mp_obj_new_tuple(4, result);
}
static MP_DEFINE_CONST_FUN_OBJ_3(tbsys_sample_obj, tbsys_sample);

static const mp_rom_map_elem_t tbsys_globals_table[] = {
    { MP_ROM_QSTR(MP_QSTR___name__), MP_ROM_QSTR(MP_QSTR_tbsys) },
    { MP_ROM_QSTR(MP_QSTR_skip_main), MP_ROM_PTR(&tbsys_skip_main_obj) },
    { MP_ROM_QSTR(MP_QSTR_sample), MP_ROM_PTR(&tbsys_sample_obj) },
};
static MP_DEFINE_CONST_DICT(tbsys_globals, tbsys_globals_table);

const mp_obj_module_t tbsys_module = {
    .base = { &mp_type_module },
    .globals = (mp_obj_dict_t *)&tbsys_globals,
};

MP_REGISTER_MODULE(MP_QSTR_tbsys, tbsys_module);
