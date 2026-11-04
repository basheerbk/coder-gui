import {useCallback} from 'react';

import {clearOffset, spreadConnections} from '../components/build/ModuleArt.jsx';

import {cloudAddProblem, hasCloud} from '../domain/cloud';
import {buildSensorOptions, buildValueOptions, defaultIfParams, ifParamsFor} from '../domain/condition';
import {uid} from '../domain/ids';
import {moduleById} from '../domain/modules';
import {portById, isPortCompatible, compatibilityHint, fitsWithCloud} from '../domain/ports';
import {SILENT_READS} from '../domain/sensorReads';
import {playConnect, playDisconnect, playTick} from '../domain/sound';
import {templateById} from '../domain/templates';
import {persistTheme} from '../domain/tokens';
import {
    appendBlock,
    createBlock,
    deleteBlockById,
    deleteBlocksByCid,
    updateBlockParams
} from '../domain/tree';

/** First block a freshly plugged part adds: sensors start as an If that checks them. */
const starterBlock = (mod, conn, connections) => {
    const first = mod.actions && mod.actions[0];
    if (!first) {
        return null;
    }
    if (SILENT_READS.indexOf(first.type) !== -1) {
        const option = buildSensorOptions(connections).find(o => o.moduleId === mod.id);
        return option ? createBlock('if_then', {params: ifParamsFor(option)}) : null;
    }
    return createBlock(first.type, {cid: conn.id, params: Object.assign({}, first.params || {})});
};

const useStudioActions = (state, setState) => {
    const patch = useCallback(partial => {
        setState(prev => Object.assign({}, prev, partial));
    }, [setState]);

    const selectModule = useCallback(moduleId => {
        setState(prev => {
            const mod = moduleById(moduleId);
            const cloudOn = hasCloud(prev.connections);
            // BLE and Cloud are onboard — snap them in without picking a jack.
            if (mod && mod.onboard) {
                if (prev.connections.some(c => c.moduleId === mod.id)) {
                    return Object.assign({}, prev, {
                        selectedModule: null,
                        wireHint: `${mod.name} is already on the board`
                    });
                }
                const refusal = mod.id === 'cloud' ?
                    cloudAddProblem(prev.connections) :
                    (cloudOn ? `${mod.name} can't be used with Cloud. Remove Cloud first.` : null);
                if (refusal) {
                    return Object.assign({}, prev, {selectedModule: null, wireHint: refusal});
                }
                const port = portById('ONBOARD');
                const plug = {id: uid('conn'), moduleId: mod.id, portId: 'ONBOARD', pin: port ? port.pin : '-'};
                const conn = Object.assign(plug, clearOffset(plug, prev.connections), {bendX: null, bendY: null});
                const first = mod.autoBlock === false ? null : (mod.actions && mod.actions[0]);
                let program = prev.program;
                if (first) {
                    program = appendBlock(program, createBlock(first.type, {
                        cid: conn.id,
                        params: Object.assign({}, first.params || {})
                    }), null);
                }
                playConnect();
                return Object.assign({}, prev, {
                    connections: prev.connections.concat([conn]),
                    program,
                    selectedModule: null,
                    flashPortId: 'ONBOARD',
                    wireHint: mod.id === 'cloud' ?
                        'Cloud added! Click Cloud in the top bar to set it up. A1–A4 are now off.' :
                        `${mod.name} is built into the board, no cable needed`,
                    showCloudSetup: prev.showCloudSetup || (mod.id === 'cloud' && !prev.cloud),
                    activeTemplateId: null
                });
            }
            if (mod && cloudOn && !fitsWithCloud(mod)) {
                return Object.assign({}, prev, {
                    selectedModule: null,
                    wireHint: `${mod.name} needs A1–A4, which are off while Cloud is on`
                });
            }
            const next = prev.selectedModule === moduleId ? null : moduleId;
            if (next) {
                playTick();
            }
            return Object.assign({}, prev, {selectedModule: next, wireHint: null});
        });
        setTimeout(() => {
            setState(prev => (prev.flashPortId ? Object.assign({}, prev, {flashPortId: null}) : prev));
        }, 450);
        setTimeout(() => {
            setState(prev => (prev.wireHint ? Object.assign({}, prev, {wireHint: null}) : prev));
        }, 4000);
    }, [setState]);

    const clearSelection = useCallback(() => {
        setState(prev => (
            prev.selectedModule || prev.wireHint
                ? Object.assign({}, prev, {selectedModule: null, wireHint: null})
                : prev
        ));
    }, [setState]);

    const connectToPort = useCallback(portId => {
        setState(prev => {
            if (!prev.selectedModule) {
                return Object.assign({}, prev, {
                    wireHint: 'Pick a part from the list first'
                });
            }
            const mod = moduleById(prev.selectedModule);
            const port = portById(portId);
            if (!mod || !port) {
                return prev;
            }
            const usedIds = {};
            prev.connections.forEach(c => {
                usedIds[c.portId] = true;
            });
            const cloudOn = hasCloud(prev.connections);
            if (!isPortCompatible(port, mod, usedIds, cloudOn)) {
                return Object.assign({}, prev, {
                    wireHint: compatibilityHint(port, mod, cloudOn)
                });
            }
            const samePort = prev.connections.filter(c => c.portId === portId);
            const shareI2c = port.kind === 'i2c' && (mod.i2c || mod.id === 'oled' || mod.id === 'pulse');
            if (samePort.length && !shareI2c) {
                return Object.assign({}, prev, {
                    wireHint: `${port.label} already has a part plugged in`
                });
            }
            const already = prev.connections.some(c => c.moduleId === mod.id);
            if (already) {
                return Object.assign({}, prev, {
                    wireHint: `${mod.name} is already on the board`
                });
            }
            const plug = {id: uid('conn'), moduleId: mod.id, portId: port.id, pin: port.pin};
            const conn = Object.assign(plug, clearOffset(plug, prev.connections), {bendX: null, bendY: null});
            const starter = starterBlock(mod, conn, prev.connections.concat([conn]));
            const program = starter ? appendBlock(prev.program, starter, null) : prev.program;
            playConnect();
            return Object.assign({}, prev, {
                connections: prev.connections.concat([conn]),
                program,
                selectedModule: null,
                flashPortId: portId,
                wireHint: port.boot || (port.strapping && mod.dir === 'out')
                    ? `Plugged in! If the board won't start or upload, unplug the part from ${port.label} for a moment.`
                    : null,
                activeTemplateId: null
            });
        });
        setTimeout(() => {
            setState(prev => (prev.flashPortId ? Object.assign({}, prev, {flashPortId: null}) : prev));
        }, 450);
        setTimeout(() => {
            setState(prev => (prev.wireHint ? Object.assign({}, prev, {wireHint: null}) : prev));
        }, 4000);
    }, [setState]);

    const disconnect = useCallback(connectionId => {
        setState(prev => {
            playDisconnect();
            return Object.assign({}, prev, {
                connections: prev.connections.filter(c => c.id !== connectionId),
                program: deleteBlocksByCid(prev.program, connectionId),
                activeTemplateId: null
            });
        });
    }, [setState]);

    const addBlock = useCallback((type, extras) => {
        setState(prev => {
            playTick();
            let nextExtras = extras || {};
            if (type === 'if_then') {
                const seeded = defaultIfParams(prev.connections);
                nextExtras = Object.assign({}, nextExtras, {
                    params: Object.assign({}, seeded, (nextExtras.params || {}))
                });
            }
            if (type === 'show_number' || type === 'serial_var') {
                const values = buildValueOptions(prev.connections);
                const wanted = nextExtras.params && nextExtras.params.varName;
                if (!values.some(v => v.id === wanted)) {
                    nextExtras = Object.assign({}, nextExtras, {
                        params: Object.assign({}, nextExtras.params, {varName: values.length ? values[0].id : ''})
                    });
                }
            }
            const block = createBlock(type, nextExtras);
            return Object.assign({}, prev, {
                program: appendBlock(prev.program, block, prev.addTarget),
                addTarget: null
            });
        });
    }, [setState]);

    const deleteBlock = useCallback(blockId => {
        setState(prev => Object.assign({}, prev, {
            program: deleteBlockById(prev.program, blockId),
            addTarget: prev.addTarget && prev.addTarget.parentId === blockId ? null : prev.addTarget
        }));
    }, [setState]);

    const updateParam = useCallback((blockId, params) => {
        setState(prev => Object.assign({}, prev, {
            program: updateBlockParams(prev.program, blockId, params)
        }));
    }, [setState]);

    const setAddTarget = useCallback(target => {
        patch({addTarget: target});
        playTick();
    }, [patch]);

    const clearProgram = useCallback(() => {
        patch({program: [], addTarget: null});
    }, [patch]);

    const moveConnection = useCallback((connectionId, offsetX, offsetY) => {
        setState(prev => Object.assign({}, prev, {
            connections: prev.connections.map(c => (
                c.id === connectionId
                    ? Object.assign({}, c, {offsetX, offsetY})
                    : c
            ))
        }));
    }, [setState]);

    const bendConnection = useCallback((connectionId, bendX, bendY) => {
        setState(prev => Object.assign({}, prev, {
            connections: prev.connections.map(c => (
                c.id === connectionId
                    ? Object.assign({}, c, {bendX, bendY})
                    : c
            ))
        }));
    }, [setState]);

    const loadTemplate = useCallback(templateId => {
        const tpl = templateById(templateId);
        if (!tpl) {
            return;
        }
        playConnect();
        setState(prev => Object.assign({}, prev, {
            connections: spreadConnections(tpl.connections),
            program: JSON.parse(JSON.stringify(tpl.program)),
            projectName: tpl.name,
            activeTemplateId: tpl.id,
            selectedModule: null,
            addTarget: null,
            showProjectLibrary: false,
            showCloudSetup: !prev.cloud && tpl.connections.some(c => c.moduleId === 'cloud'),
            view: 'build'
        }));
    }, [setState]);

    const setView = useCallback(view => patch({view}), [patch]);
    const setProjectName = useCallback(projectName => patch({projectName}), [patch]);
    const setCategoryFilter = useCallback(categoryFilter => patch({categoryFilter}), [patch]);
    const setBlockPaletteCategory = useCallback(blockPaletteCategory => patch({blockPaletteCategory}), [patch]);
    const setShowCodePanel = useCallback(showCodePanel => patch({showCodePanel}), [patch]);
    const setShowSerial = useCallback(showSerial => patch({showSerial}), [patch]);
    const setShowProjectLibrary = useCallback(showProjectLibrary => patch({showProjectLibrary}), [patch]);
    const setTheme = useCallback(theme => {
        const next = theme === 'light' ? 'light' : 'dark';
        persistTheme(next);
        patch({theme: next});
    }, [patch]);
    const setCloud = useCallback(cloud => patch({cloud: cloud || null}), [patch]);
    const setShowCloudSetup = useCallback(showCloudSetup => patch({showCloudSetup: Boolean(showCloudSetup)}), [patch]);

    return {
        selectModule,
        clearSelection,
        connectToPort,
        disconnect,
        addBlock,
        deleteBlock,
        updateParam,
        setAddTarget,
        clearProgram,
        loadTemplate,
        moveConnection,
        bendConnection,
        setView,
        setProjectName,
        setCategoryFilter,
        setBlockPaletteCategory,
        setShowCodePanel,
        setShowSerial,
        setShowProjectLibrary,
        setTheme,
        setCloud,
        setShowCloudSetup
    };
};

export default useStudioActions;
