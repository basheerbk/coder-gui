import React, {useCallback, useEffect, useState} from 'react';

import {useStudio} from '../../../context/StudioContext.jsx';

import Board3D from './Board3D.jsx';
import {forcedRenderer, hasWebGL2, warn} from './webgl';

/** Loaded WebGL stage, kept across Edit/3D switches. */
let GLStage = null;
/** Once WebGL has failed in this tab, stay on the CSS view instead of retrying on every switch. */
let glFailed = false;

const initialMode = () => {
    const forced = forcedRenderer();
    if (forced === 'css' || glFailed) {
        return 'css';
    }
    if (forced !== 'gl' && !hasWebGL2()) {
        return 'css';
    }
    return GLStage ? 'gl' : 'loading';
};

/** Catches render errors from the WebGL stage so the CSS view can take over. */
class GLBoundary extends React.Component {
    constructor (props) {
        super(props);
        this.state = {failed: false};
    }

    static getDerivedStateFromError () {
        return {failed: true};
    }

    componentDidCatch (err) {
        this.props.onError(err);
    }

    render () {
        return this.state.failed ? null : this.props.children;
    }
}

const Loading = () => {
    const {K} = useStudio();
    return (
        <div
            className="tb3d-stage"
            role="status"
            style={{
                background: `radial-gradient(120% 90% at 50% 38%, ${K.canvasGlow} 0%, ${K.canvas} 72%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: K.dim,
                fontSize: 12,
                fontWeight: 600
            }}
        >
            {'Loading the 3D view…'}
        </div>
    );
};

/** 3D build view: WebGL when the device supports it, otherwise the CSS 3D board. */
const Board3DView = () => {
    const [mode, setMode] = useState(initialMode);

    const fallBack = useCallback(err => {
        warn('WebGL view failed, using the CSS view', err);
        glFailed = true;
        setMode('css');
    }, []);

    useEffect(() => {
        if (mode !== 'loading') {
            return undefined;
        }
        let live = true;
        import(/* webpackChunkName: "board3d-gl" */ './gl/Board3DGL.jsx')
            .then(mod => {
                GLStage = mod.default;
                if (live) {
                    setMode('gl');
                }
            })
            .catch(err => {
                if (live) {
                    fallBack(err);
                }
            });
        return () => {
            live = false;
        };
    }, [mode, fallBack]);

    if (mode === 'gl' && GLStage) {
        return (
            <GLBoundary onError={fallBack}>
                <GLStage onFatal={fallBack} />
            </GLBoundary>
        );
    }
    if (mode === 'loading') {
        return <Loading />;
    }
    return <Board3D />;
};

export default Board3DView;
