import React from 'react';

import AiView from './components/ai/AiView.jsx';
import BuildView from './components/build/BuildView.jsx';
import CloudAddDialog from './components/cloud/CloudAddDialog.jsx';
import CloudView from './components/cloud/CloudView.jsx';
import CodeView from './components/code/CodeView.jsx';
import QuickStartBar from './components/layout/QuickStartBar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import ProjectLibraryModal from './components/projects/ProjectLibraryModal.jsx';
import Keyframes from './components/shared/Keyframes.jsx';
import {StudioProvider, useStudio} from './context/StudioContext.jsx';
import {UploadProvider} from './context/UploadContext.jsx';
import {hasCloud} from './domain/cloud';
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
                <div style={{padding: 32, fontFamily: 'system-ui', color: '#111', maxWidth: 560}}>
                    <h2 style={{margin: '0 0 8px'}}>Oops, something went wrong</h2>
                    <p style={{margin: '0 0 16px', color: '#444'}}>
                        Reload the page to keep going.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            border: 'none',
                            background: '#3b82f6',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Reload
                    </button>
                    <details style={{marginTop: 20, color: '#666', fontSize: 12}}>
                        <summary style={{cursor: 'pointer'}}>Details</summary>
                        <pre style={{whiteSpace: 'pre-wrap', color: '#b91c1c'}}>
                            {String(this.state.error && this.state.error.stack ?
                                this.state.error.stack :
                                this.state.error)}
                        </pre>
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

const AppShell = () => {
    const {view, connections, K} = useStudio();
    const cloudPart = hasCloud(connections);
    return (
        <div style={baseApp(K)}>
            <Keyframes />
            <TopBar />
            <QuickStartBar />
            {view === 'build' || (view === 'cloud' && !cloudPart) ? <BuildView /> : null}
            {view === 'code' ? <CodeView /> : null}
            {cloudPart ? <CloudView /> : null}
            <AiView />
            <ProjectLibraryModal />
            <CloudAddDialog />
        </div>
    );
};

const App = ({user}) => (
    <ErrorBoundary>
        <StudioProvider user={user || null}>
            <UploadProvider>
                <AppShell />
            </UploadProvider>
        </StudioProvider>
    </ErrorBoundary>
);

export default App;
