import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const StatusBar = () => {
    const {setShowProjectLibrary, K} = useStudio();
    return (
        <footer
            style={{
                height: 26,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                background: K.panel,
                borderTop: `1px solid ${K.border}`,
                fontSize: 11,
                color: K.muted
            }}
        >
            <span>Maker ESP32 · D5=Trig26/Echo25 (HC-SR04 only) · D13=33 · 3D RFID 32/33/34 · SPI 16/23 · ST=12/13/14/27 · MD A=5/17 B=18/19 · I2C 21/22 · BLE · A1=4 A2=15 A3=2 A4=0</span>
            <div style={{flex: 1}} />
            <button
                type="button"
                onClick={() => setShowProjectLibrary(true)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: K.dim,
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0
                }}
            >
                All projects
            </button>
        </footer>
    );
};

export default StatusBar;
