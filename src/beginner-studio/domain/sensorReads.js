import {moduleById} from './modules';

/** Blocks that store a fresh value in their module's variable(s). */
const READ_BLOCKS = {
    read_value: true,
    print_soil: true,
    print_gas: true,
    read_distance: true,
    read_temp: true,
    read_humidity: true,
    print_climate: true,
    is_pressed: true,
    is_motion: true,
    rfid_read: true,
    hc05_read: true
};

/** Reads that only refresh a variable. Beginners never place these: codegen adds them where needed. */
const SILENT_READS = ['is_pressed', 'is_motion', 'read_value', 'read_distance', 'read_temp', 'read_humidity'];

const READER_ORDER = SILENT_READS.concat(['rfid_read', 'hc05_read']);

const moduleVars = mod => [mod.valueName, mod.humidityName].filter(Boolean);

/**
 * Which block refreshes each sensor variable of the wired parts.
 * @param {Array} connections wired parts
 * @returns {object} variable name -> {cid, type, vars}
 */
const sensorReaders = connections => {
    const readers = {};
    (connections || []).forEach(c => {
        const mod = moduleById(c.moduleId);
        if (!mod || mod.dir !== 'in') {
            return;
        }
        const types = (mod.actions || []).map(a => a.type);
        const vars = moduleVars(mod);
        vars.forEach(v => {
            const preferred = v === mod.humidityName ? 'read_humidity' : null;
            const type = preferred && types.indexOf(preferred) !== -1 ?
                preferred :
                READER_ORDER.find(t => types.indexOf(t) !== -1);
            if (type && !readers[v]) {
                readers[v] = {cid: c.id, type, vars};
            }
        });
    });
    return readers;
};

/**
 * Sensor variables a block looks at (conditions, numbers shown, values that drive outputs).
 * @param {object} block program block
 * @returns {Array<string>} variable names
 */
const varsUsedBy = block => {
    const p = block.params || {};
    const used = [];
    if (block.type === 'if_then' && p.sensor) {
        used.push(p.sensor);
    }
    if ((block.type === 'show_number' || block.type === 'serial_var') && p.varName) {
        used.push(p.varName);
    }
    if (p.brightnessVar) {
        used.push(p.brightnessVar);
    }
    if (p.speedVar) {
        used.push(p.speedVar);
    }
    return used;
};

/** Variables refreshed by a block the user placed themselves. */
const varsReadBy = (block, connections) => {
    if (!block.cid || !READ_BLOCKS[block.type]) {
        return [];
    }
    const conn = (connections || []).find(c => c.id === block.cid);
    const mod = conn ? moduleById(conn.moduleId) : null;
    return mod ? moduleVars(mod) : [];
};

const walkBlocks = (blocks, visit) => {
    (blocks || []).forEach(block => {
        visit(block);
        walkBlocks(block.children, visit);
        walkBlocks(block.elseChildren, visit);
    });
};

/**
 * Connections whose sensor the program reads, either with a read block or by using its value.
 * @param {Array} connections wired parts
 * @param {Array} program block tree
 * @returns {object} connection id -> true
 */
const readConnectionIds = (connections, program) => {
    const readers = sensorReaders(connections);
    const ids = {};
    walkBlocks(program, block => {
        if (block.cid && READ_BLOCKS[block.type]) {
            ids[block.cid] = true;
        }
        varsUsedBy(block).forEach(v => {
            if (readers[v]) {
                ids[readers[v].cid] = true;
            }
        });
    });
    return ids;
};

/** Drop silent read blocks from a program tree (codegen re-adds them where they are needed). */
const stripSilentReads = blocks => (blocks || [])
    .filter(b => SILENT_READS.indexOf(b.type) === -1)
    .map(b => {
        if (!b.children && !b.elseChildren) {
            return b;
        }
        return Object.assign({}, b, {
            children: b.children ? stripSilentReads(b.children) : b.children,
            elseChildren: b.elseChildren ? stripSilentReads(b.elseChildren) : b.elseChildren
        });
    });

export {
    READ_BLOCKS,
    SILENT_READS,
    readConnectionIds,
    sensorReaders,
    stripSilentReads,
    varsReadBy,
    varsUsedBy,
    walkBlocks
};
