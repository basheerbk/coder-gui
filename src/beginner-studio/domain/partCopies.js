import {moduleById} from './modules';
import {neededKind} from './ports';

/**
 * A student can plug in more than one of a part when it uses the shared one-wire or analog jacks
 * (D13, A1–A4). Each copy keeps a number for life: the first copy keeps the plain names
 * (`buttonState`), the second is "Button 2" with `buttonState2`, so unplugging Button 1 never
 * renames Button 2 or breaks its blocks.
 */

/** Parts there can be more than one of (the others have a jack, bus address or radio of their own). */
const canRepeat = mod => Boolean(mod) && !mod.onboard && ['digital', 'analog'].indexOf(neededKind(mod)) !== -1;

const copyNo = conn => (conn && Number.isInteger(conn.n) && conn.n > 1 ? conn.n : 1);

/** The lowest number no copy of this part uses. */
const nextCopyNo = (connections, moduleId) => {
    const taken = {};
    (connections || []).filter(c => c.moduleId === moduleId).forEach(c => {
        taken[copyNo(c)] = true;
    });
    let n = 1;
    while (taken[n]) {
        n++;
    }
    return n;
};

/** A sketch name for this copy: `temperature`, `temperature2`, ... */
const copyVar = (name, conn) => (copyNo(conn) > 1 ? `${name}${copyNo(conn)}` : name);

/** " 2" after a part's name when the board has more than one of it (or this is a later copy), else "". */
const copyTag = (conn, connections) => {
    const n = copyNo(conn);
    const repeated = n > 1 || (connections || []).some(c => c.id !== conn.id && c.moduleId === conn.moduleId);
    return repeated ? ` ${n}` : '';
};

/** "LED", or "LED 2" when there are several. */
const partName = (conn, connections) => {
    const mod = conn ? moduleById(conn.moduleId) : null;
    return mod ? `${mod.name}${copyTag(conn, connections)}` : '';
};

/**
 * Every reading this copy of a part stores.
 * @param {object} conn wired part
 * @returns {Array<{name, base, kind, type, label}>} kind is value, humidity or extra; base is
 *   the part's plain variable name; label is the part's own word for it
 */
const partValues = conn => {
    const mod = conn ? moduleById(conn.moduleId) : null;
    if (!mod) {
        return [];
    }
    const out = [];
    if (mod.valueName) {
        out.push({name: copyVar(mod.valueName, conn), base: mod.valueName, kind: 'value', type: mod.valueType || 'int', label: mod.name});
    }
    if (mod.humidityName) {
        out.push({name: copyVar(mod.humidityName, conn), base: mod.humidityName, kind: 'humidity', type: 'float', label: `${mod.name} humidity`});
    }
    (mod.extraValues || []).forEach(extra => {
        out.push({name: copyVar(extra.name, conn), base: extra.name, kind: 'extra', type: extra.type || 'int', label: extra.label || mod.name});
    });
    return out;
};

export {canRepeat, copyNo, copyTag, copyVar, nextCopyNo, partName, partValues};
