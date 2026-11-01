import React, {useState} from 'react';

import {errorText, iotApi} from '../../lib/iot-api';
import {KNOWN_UNITS, READING_KEY_RE, prettyKey, timeAgo} from '../format';
import {Banner, Button, Card, Field, inputStyle, useTheme} from '../ui.jsx';

const OPS = [
    {id: '>', label: 'goes above'},
    {id: '>=', label: 'reaches'},
    {id: '<', label: 'drops below'},
    {id: '<=', label: 'is at most'}
];
const COOLDOWNS = [0, 60, 300, 900, 3600];

const cooldownLabel = s => (s === 0 ? 'every time' : (s < 3600 ? `at most every ${s / 60} min` : 'at most every hour'));

const emptyForm = key => ({key: key || '', op: '>', threshold: '', hysteresis: '', cooldownSec: 300, message: ''});

const NotificationButton = () => {
    const supported = typeof Notification !== 'undefined';
    const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
    if (!supported) {
        return <span style={{fontSize: 12}}>This browser cannot show notifications; alerts still appear on this page.</span>;
    }
    if (permission === 'granted') {
        return <span style={{fontSize: 12}}>Phone/computer notifications are on while this page is open in a tab.</span>;
    }
    if (permission === 'denied') {
        return <span style={{fontSize: 12}}>Notifications are blocked for this site in your browser settings.</span>;
    }
    return (
        <Button onClick={() => Notification.requestPermission().then(setPermission)}>
            Turn on notifications
        </Button>
    );
};

const RulesPanel = ({detail, onRules}) => {
    const K = useTheme();
    const readingKeys = (detail.latest || []).map(r => r.key);
    const [form, setForm] = useState(emptyForm(readingKeys[0]));
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const rules = detail.rules || [];
    const id = detail.device.id;

    const run = async (label, fn) => {
        setBusy(label);
        setError('');
        try {
            await fn();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy('');
        }
    };

    const add = e => {
        e.preventDefault();
        const threshold = Number(form.threshold);
        const hysteresis = form.hysteresis === '' ? 0 : Number(form.hysteresis);
        if (!READING_KEY_RE.test(form.key)) {
            setError('Pick which reading to watch.');
            return;
        }
        if (form.threshold === '' || !Number.isFinite(threshold)) {
            setError('Type a number to compare with.');
            return;
        }
        if (!Number.isFinite(hysteresis) || hysteresis < 0) {
            setError('“Settle by” must be zero or more.');
            return;
        }
        run('add', async () => {
            const res = await iotApi.createRule(id, {
                key: form.key,
                op: form.op,
                threshold,
                hysteresis,
                cooldownSec: Number(form.cooldownSec),
                message: form.message.trim() ||
                    `${detail.device.name}: ${prettyKey(form.key)} ${OPS.find(o => o.id === form.op).label} ${threshold}`
            });
            onRules(rules.concat([res.rule]));
            setForm(emptyForm(form.key));
        });
    };

    const toggle = rule => run(rule.id, async () => {
        const res = await iotApi.updateRule(id, rule.id, {enabled: !rule.enabled});
        onRules(rules.map(r => (r.id === rule.id ? res.rule : r)));
    });

    const remove = rule => run(rule.id, async () => {
        try {
            await iotApi.deleteRule(id, rule.id);
        } catch (err) {
            if (err.code !== 'not_found') {
                throw err;
            }
        }
        onRules(rules.filter(r => r.id !== rule.id));
    });

    return (
        <div style={{display: 'grid', gap: 12}}>
            <Banner tone="info" action={<NotificationButton />}>
                Alerts are checked on our server, so they work even when your phone is asleep — you will see them here
                and under Alerts at the top.
            </Banner>
            {error ? <Banner tone="error">{error}</Banner> : null}

            {rules.map(rule => (
                <Card key={rule.id} style={{display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: rule.enabled ? 1 : 0.6}}>
                    <div style={{flex: 1, minWidth: 200}}>
                        <div style={{fontWeight: 700, fontSize: 14}}>
                            When {prettyKey(rule.key)} {OPS.find(o => o.id === rule.op).label} {rule.threshold}
                            {KNOWN_UNITS[rule.key] ? ` ${KNOWN_UNITS[rule.key]}` : ''}
                        </div>
                        <div style={{fontSize: 12, color: K.dim, marginTop: 2}}>
                            “{rule.message}” · {cooldownLabel(rule.cooldownSec)}
                            {rule.active ? ' · happening now' : ''}
                            {rule.lastFired ? ` · last ${timeAgo(rule.lastFired)}` : ''}
                        </div>
                    </div>
                    <Button disabled={busy === rule.id} onClick={() => toggle(rule)}>{rule.enabled ? 'Pause' : 'Resume'}</Button>
                    <Button kind="ghost" style={{color: K.red}} disabled={busy === rule.id} onClick={() => remove(rule)}>Delete</Button>
                </Card>
            ))}

            <Card>
                <form onSubmit={add} style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end'}}>
                    <Field label="When">
                        {readingKeys.length ? (
                            <select value={form.key} onChange={e => setForm(Object.assign({}, form, {key: e.target.value}))} style={inputStyle(K)}>
                                {readingKeys.map(k => <option key={k} value={k}>{prettyKey(k)}</option>)}
                            </select>
                        ) : (
                            <input
                                value={form.key}
                                placeholder="e.g. temperature"
                                onChange={e => setForm(Object.assign({}, form, {key: e.target.value.trim()}))}
                                style={Object.assign(inputStyle(K), {width: 150})}
                            />
                        )}
                    </Field>
                    <Field label=" ">
                        <select value={form.op} onChange={e => setForm(Object.assign({}, form, {op: e.target.value}))} style={inputStyle(K)}>
                            {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Number">
                        <input
                            type="number"
                            inputMode="decimal"
                            value={form.threshold}
                            onChange={e => setForm(Object.assign({}, form, {threshold: e.target.value}))}
                            style={Object.assign(inputStyle(K), {width: 100})}
                        />
                    </Field>
                    <Field label="Settle by" hint="stops flicker alerts">
                        <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            value={form.hysteresis}
                            placeholder="0"
                            onChange={e => setForm(Object.assign({}, form, {hysteresis: e.target.value}))}
                            style={Object.assign(inputStyle(K), {width: 90})}
                        />
                    </Field>
                    <Field label="Repeat">
                        <select value={form.cooldownSec} onChange={e => setForm(Object.assign({}, form, {cooldownSec: Number(e.target.value)}))} style={inputStyle(K)}>
                            {COOLDOWNS.map(s => <option key={s} value={s}>{cooldownLabel(s)}</option>)}
                        </select>
                    </Field>
                    <Field label="Message (optional)">
                        <input
                            value={form.message}
                            maxLength={120}
                            onChange={e => setForm(Object.assign({}, form, {message: e.target.value}))}
                            style={Object.assign(inputStyle(K), {width: 220})}
                        />
                    </Field>
                    <Button kind="primary" type="submit" disabled={busy === 'add'}>Add alert</Button>
                </form>
            </Card>
        </div>
    );
};

export default RulesPanel;
