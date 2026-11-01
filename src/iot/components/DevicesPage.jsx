import React, {useState} from 'react';

import {writeToken} from '../../beginner-studio/domain/cloudSecrets';
import {errorText, iotApi} from '../../lib/iot-api';
import {KNOWN_UNITS, formatValue, prettyKey, rssiBars, timeAgo} from '../format';
import {linkTo, navigate} from '../router';
import {Banner, Button, Card, SignalBars, StatusDot, inputStyle, useTheme} from '../ui.jsx';

const statusText = d => {
    if (d.status === 'disabled') {
        return 'Paused';
    }
    if (d.status === 'online') {
        return 'Online';
    }
    return d.lastSeen ? `Offline · seen ${timeAgo(d.lastSeen)}` : 'Waiting for first connection';
};

const DevicesPage = ({state, actions}) => {
    const K = useTheme();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const devices = state.devices;
    const limit = state.config.limits.maxDevices;
    const email = state.config.user ? state.config.user.email : null;

    const create = async e => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Give the board a name.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const res = await iotApi.createDevice(trimmed);
            // Same origin as Beginner Studio, so Studio can upload with this key straight away.
            writeToken(email, res.device.id, res.token);
            actions.dispatch({type: 'device/upsert', device: Object.assign({latest: []}, res.device)});
            setName('');
            navigate(`/iot/d/${res.device.id}`);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    };

    if (!devices) {
        return state.devicesError ? (
            <Banner tone="error" action={<Button onClick={actions.refreshDevices}>Retry</Button>}>
                {errorText(state.devicesError)}
            </Banner>
        ) : <div style={{color: K.dim}}>Loading your boards…</div>;
    }

    return (
        <div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12}}>
                <h1 style={{fontSize: 22, margin: 0, flex: 1}}>Your boards</h1>
                <span style={{fontSize: 12, color: K.dim}}>{devices.length} of {limit}</span>
            </div>

            {!devices.length ? (
                <Card style={{marginBottom: 14}}>
                    <div style={{fontWeight: 800, fontSize: 16, marginBottom: 8}}>Connect your first board</div>
                    <ol style={{margin: 0, paddingLeft: 20, color: K.sub, fontSize: 14, lineHeight: 1.7}}>
                        <li>Open <a href="/beginner" style={{color: K.accent}}>Beginner Studio</a> and add the <b>TinkerBit Cloud</b> part (Cloud shelf).</li>
                        <li>Pick or make a board, type your WiFi, then press <b>Upload</b>.</li>
                        <li>Come back here — the dot turns green when the board is online.</li>
                    </ol>
                </Card>
            ) : null}

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12}}>
                {devices.map(d => (
                    <a
                        key={d.id}
                        href={`/iot/d/${d.id}`}
                        onClick={linkTo(`/iot/d/${d.id}`)}
                        style={{textDecoration: 'none', color: 'inherit'}}
                    >
                        <Card style={{height: '100%', boxSizing: 'border-box'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                <StatusDot status={d.status} />
                                <span style={{fontWeight: 800, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                    {d.name}
                                </span>
                                {d.status === 'online' && d.rssi !== null ? <SignalBars bars={rssiBars(d.rssi)} /> : null}
                            </div>
                            <div style={{fontSize: 12, color: K.dim, marginTop: 4}}>{statusText(d)}</div>
                            {(d.latest || []).length ? (
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10}}>
                                    {d.latest.slice(0, 4).map(r => (
                                        <div key={r.key}>
                                            <div style={{fontSize: 11, color: K.dim}}>{prettyKey(r.key)}</div>
                                            <div style={{fontSize: 17, fontWeight: 800}}>{formatValue(r.value, KNOWN_UNITS[r.key])}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {d.warning ? (
                                <div style={{fontSize: 12, color: K.orange, marginTop: 8}}>Needs attention — open for details</div>
                            ) : null}
                        </Card>
                    </a>
                ))}
            </div>

            <Card style={{marginTop: 14}}>
                <form onSubmit={create} style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
                    <input
                        value={name}
                        maxLength={40}
                        onChange={e => setName(e.target.value)}
                        placeholder="New board name"
                        aria-label="New board name"
                        style={Object.assign(inputStyle(K), {flex: 1, minWidth: 180})}
                    />
                    <Button kind="primary" type="submit" disabled={busy || devices.length >= limit}>
                        {busy ? 'Adding…' : 'Add board'}
                    </Button>
                </form>
                {devices.length >= limit ? (
                    <div style={{fontSize: 12, color: K.dim, marginTop: 6}}>You have reached {limit} boards. Delete one to add another.</div>
                ) : null}
                {error ? <div role="alert" style={{fontSize: 12, color: K.red, marginTop: 6}}>{error}</div> : null}
            </Card>
        </div>
    );
};

export default DevicesPage;
