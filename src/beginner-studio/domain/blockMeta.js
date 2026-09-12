import {CONTROL_BLOCKS, MODULES, moduleById} from './modules';

const CONTROL_BY_TYPE = CONTROL_BLOCKS.reduce((acc, block) => {
    acc[block.type] = block;
    return acc;
}, {});

const actionLabelForType = (moduleDef, type) => {
    if (!moduleDef || !moduleDef.actions) {
        return null;
    }
    const action = moduleDef.actions.find(a => a.type === type);
    return action ? action.label : null;
};

/** Friendly title + accent color for canvas nodes and palette chips. */
const blockMeta = (block, connections, K) => {
    const control = CONTROL_BY_TYPE[block.type];
    if (control) {
        return {
            color: K.orange,
            soft: `${K.orange}22`,
            iconId: block.type,
            label: control.label,
            kind: 'control'
        };
    }

    const conn = connections.find(c => c.id === block.cid);
    const mod = conn ? moduleById(conn.moduleId) : null;
    if (mod) {
        const color = mod.dir === 'in' ? K.cyan : (mod.color || K.purple);
        let actionLabel = actionLabelForType(mod, block.type) || block.type.replace(/_/g, ' ');
        if (block.type === 'set_on') {
            actionLabel = block.params && block.params.on === false ? 'Off' : 'On';
        }
        return {
            color,
            soft: `${color}22`,
            iconId: mod.id,
            label: `${actionLabel} · ${mod.name}`,
            kind: mod.dir === 'in' ? 'sensor' : 'action',
            moduleName: mod.name
        };
    }

    // Orphaned hardware block (module unplugged)
    let orphanMod = null;
    MODULES.some(m => {
        const hit = (m.actions || []).some(a => a.type === block.type);
        if (hit) {
            orphanMod = m;
        }
        return hit;
    });
    if (orphanMod) {
        const actionLabel = actionLabelForType(orphanMod, block.type) || block.type;
        return {
            color: K.surface,
            soft: K.surface,
            iconId: orphanMod.id,
            label: `${actionLabel} · ${orphanMod.name}`,
            kind: 'orphan'
        };
    }

    return {
        color: K.surface,
        soft: K.surface,
        iconId: null,
        label: block.type.replace(/_/g, ' '),
        kind: 'unknown'
    };
};

const paletteChipMeta = (type, options, K) => {
    const {cid, moduleId, color: overrideColor, label: overrideLabel} = options || {};
    const control = CONTROL_BY_TYPE[type];
    if (control) {
        return {
            color: K.orange,
            soft: `${K.orange}18`,
            iconId: type,
            label: overrideLabel || control.label
        };
    }
    const mod = moduleId ? moduleById(moduleId) : null;
    const actionLabel = mod ? actionLabelForType(mod, type) : null;
    const color = overrideColor || (mod && mod.color) || K.purple;
    return {
        color,
        soft: `${color}18`,
        iconId: moduleId || type,
        label: overrideLabel || (actionLabel && mod ? `${actionLabel} · ${mod.name}` : type)
    };
};

export {blockMeta, paletteChipMeta, CONTROL_BY_TYPE};
