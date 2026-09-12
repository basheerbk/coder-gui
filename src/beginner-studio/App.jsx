import React from 'react';

import BuildView from './components/build/BuildView.jsx';
import CodeView from './components/code/CodeView.jsx';
import QuickStartBar from './components/layout/QuickStartBar.jsx';
import StatusBar from './components/layout/StatusBar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import ProjectLibraryModal from './components/projects/ProjectLibraryModal.jsx';
import Keyframes from './components/shared/Keyframes.jsx';
import {StudioProvider, useStudio} from './context/StudioContext.jsx';
import {baseApp} from './domain/tokens';

class ErrorBoundary extends React.Component {
    constructor (props) {
        super(props);
        this.state = {error: null};
    }

    componentDidCatch (error) {
        this.setState({error});
    }

    render () {
        if (this.state.error) {
            return (
                <div style={{padding: 24, fontFamily: 'system-ui', color: '#111'}}>
                    <h2>Beginner Studio hit an error</h2>
                    <pre style={{whiteSpace: 'pre-wrap', color: '#b91c1c'}}>
                        {String(this.state.error && this.state.error.stack ?
                            this.state.error.stack :
                            this.state.error)}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const AppShell = () => {
    const {view, K} = useStudio();
    return (
        <div style={baseApp(K)}>
            <Keyframes />
            <TopBar />
            <QuickStartBar />
            {view === 'build' ? <BuildView /> : <CodeView />}
            <StatusBar />
            <ProjectLibraryModal />
        </div>
    );
};

const App = () => (
    <ErrorBoundary>
        <StudioProvider>
            <AppShell />
        </StudioProvider>
    </ErrorBoundary>
);

export default App;
