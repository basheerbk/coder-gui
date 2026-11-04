import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';
import {hasBle, lockedPortParts} from '../../domain/cloud';
import {moduleById} from '../../domain/modules';

import {Button, Footer, Note, Spacer, ui} from './wizardUi.jsx';

/**
 * First stop when the project has no Cloud part yet. Parts that stop Cloud from going in are
 * listed with a Remove button instead of a hint that disappears.
 */
const PartStep = ({onClose}) => {
    const {K, connections, selectModule, disconnect} = useStudio();
    const s = ui(K);
    const blockers = lockedPortParts(connections).map(p => ({id: p.connection.id, name: p.name, where: `on ${p.port}`}));
    if (hasBle(connections)) {
        const ble = connections.find(c => {
            const mod = moduleById(c.moduleId);
            return mod && mod.id === 'ble';
        });
        blockers.unshift({id: ble.id, name: 'Bluetooth (BLE)', where: 'cannot run with Cloud'});
    }

    return (
        <div>
            <h3 style={s.title}>Add Cloud to this project</h3>
            <p style={s.lead}>
                Cloud lets your board send readings to your phone and take orders from it, over WiFi.
            </p>
            {blockers.length ? (
                <Note
                    K={K}
                    title={blockers.length === 1 ? 'One part is in the way' : `${blockers.length} parts are in the way`}
                >
                    WiFi switches off the A1–A4 sockets, and Cloud and Bluetooth cannot run together.
                    Removing a part also removes its blocks (Undo brings them back).
                    <ul style={{listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6}}>
                        {blockers.map(b => (
                            <li key={b.id} style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                <span style={{flex: 1, color: K.text}}>
                                    <b>{b.name}</b> <span style={{color: K.dim}}>{b.where}</span>
                                </span>
                                <Button K={K} onClick={() => disconnect(b.id)}>Remove</Button>
                            </li>
                        ))}
                    </ul>
                </Note>
            ) : null}
            <Footer>
                <Button K={K} onClick={onClose}>Not now</Button>
                <Spacer />
                <Button K={K} kind="primary" disabled={blockers.length > 0} onClick={() => selectModule('cloud')}>
                    Add Cloud
                </Button>
            </Footer>
        </div>
    );
};

export default PartStep;
