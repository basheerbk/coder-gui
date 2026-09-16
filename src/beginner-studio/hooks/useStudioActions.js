import {useCallback} from 'react';

import {defaultIfParams} from '../domain/condition';
import {uid} from '../domain/ids';
import {moduleById} from '../domain/modules';
import {portById, isPortCompatible, compatibilityHint} from '../domain/ports';
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

const useStudioActions = (state, setState) => {
    const patch = useCallback(partial => {
        setState(prev => Object.assign({}, prev, partial));
    }, [setState]);

    const selectModule = useCallback(moduleId => {
        setState(prev => {
            const next = prev.selectedModule === moduleId ? null : moduleId;
            if (next) {
                playTick();
            }
            return Object.assign({}, prev, {selectedModule: next, wireHint: null});
        });
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
            if (!isPortCompatible(port, mod)) {
                return Object.assign({}, prev, {
                    wireHint: compatibilityHint(port, mod)
                });
            }
            const occupied = prev.connections.some(c => c.portId === portId);
            if (occupied) {
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
            const conn = {
                id: uid('conn'),
                moduleId: mod.id,
                portId: port.id,
                pin: port.pin,
                offsetX: 0,
                offsetY: 0,
                bendX: null,
                bendY: null
            };
            const first = mod.actions && mod.actions[0];
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
                flashPortId: portId,
                wireHint: port.boot
                    ? 'A4 is IO0 (BOOT). Unplug it if the board will not start.'
                    : (port.strapping && mod.dir === 'out'
                        ? `${port.label} is a boot strap pin — keep it HIGH/floating at reset.`
                        : null),
                activeTemplateId: null
            });
        });
        setTimeout(() => {
            setState(prev => (prev.flashPortId ? Object.assign({}, prev, {flashPortId: null}) : prev));
        }, 450);
        setTimeout(() => {
            setState(prev => (prev.wireHint ? Object.assign({}, prev, {wireHint: null}) : prev));
        }, 2600);
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
            connections: tpl.connections.map(c => Object.assign({}, c)),
            program: JSON.parse(JSON.stringify(tpl.program)),
            projectName: tpl.name,
            activeTemplateId: tpl.id,
            selectedModule: null,
            addTarget: null,
            showProjectLibrary: false,
            view: 'code'
        }));
    }, [setState]);

    const setView = useCallback(view => patch({view}), [patch]);
    const setProjectName = useCallback(projectName => patch({projectName}), [patch]);
    const setCategoryFilter = useCallback(categoryFilter => patch({categoryFilter}), [patch]);
    const setBlockPaletteCategory = useCallback(blockPaletteCategory => patch({blockPaletteCategory}), [patch]);
    const setShowCodePanel = useCallback(showCodePanel => patch({showCodePanel}), [patch]);
    const setShowProjectLibrary = useCallback(showProjectLibrary => patch({showProjectLibrary}), [patch]);
    const setTheme = useCallback(theme => {
        const next = theme === 'light' ? 'light' : 'dark';
        persistTheme(next);
        patch({theme: next});
    }, [patch]);

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
        setShowProjectLibrary,
        setTheme
    };
};

export default useStudioActions;
