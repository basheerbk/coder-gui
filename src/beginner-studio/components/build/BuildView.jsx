import React, {useEffect} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

import BoardCanvas from './BoardCanvas.jsx';
import ComponentShelf from './ComponentShelf.jsx';

const BuildView = () => {
    const {clearSelection, K} = useStudio();

    useEffect(() => {
        const onKey = event => {
            if (event.key === 'Escape') {
                clearSelection();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [clearSelection]);

    return (
        <div style={{flex: 1, display: 'flex', minHeight: 0, background: K.canvas}}>
            <ComponentShelf />
            <div style={{flex: 1, minWidth: 0, display: 'flex', position: 'relative'}}>
                <BoardCanvas />
            </div>
        </div>
    );
};

export default BuildView;
