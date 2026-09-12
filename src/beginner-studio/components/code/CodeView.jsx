import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

import BlockPalette from './BlockPalette.jsx';
import LiveCodePanel from './LiveCodePanel.jsx';
import ProgramCanvas from './ProgramCanvas.jsx';

const CodeView = () => {
    const {K} = useStudio();
    return (
        <div style={{flex: 1, display: 'flex', minHeight: 0, background: K.canvas, position: 'relative'}}>
            <BlockPalette />
            <ProgramCanvas />
            <LiveCodePanel />
        </div>
    );
};

export default CodeView;
