import React, {useState} from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

import {Button, Disclosure, Footer, Spacer, ui} from './wizardUi.jsx';

/**
 * WiFi the board should join. Errors show after the student leaves a field or presses Next;
 * the long list of WiFi limits waits behind "WiFi tips".
 * @param {object} props.w wizard state and actions from CloudWizard
 */
const WifiStep = ({w}) => {
    const {K} = useStudio();
    const s = ui(K);
    const [showPass, setShowPass] = useState(false);
    const {wifi, setWifi, wifiCheck, touched, setTouched, busy} = w;
    const error = text => (text ? <div style={{fontSize: 12, color: K.red, marginTop: 4}}>{text}</div> : null);

    return (
        <form
            onSubmit={e => {
                e.preventDefault();
                w.saveWifi();
            }}
        >
            <h3 style={s.title}>Which WiFi should “{w.boardName}” join?</h3>
            <p style={s.lead}>Type it exactly as your phone shows it. The password goes only into your board.</p>
            <div style={{display: 'grid', gap: 10}}>
                <div>
                    <label style={s.label} htmlFor="tb-cloud-ssid">WiFi name</label>
                    <input
                        id="tb-cloud-ssid"
                        value={wifi.ssid}
                        onChange={e => setWifi(Object.assign({}, wifi, {ssid: e.target.value}))}
                        onBlur={() => setTouched(true)}
                        autoComplete="off"
                        spellCheck={false}
                        autoFocus={!wifi.ssid}
                        style={s.input}
                    />
                    {touched ? error(wifiCheck.errors.ssid) : null}
                </div>
                <div>
                    <label style={s.label} htmlFor="tb-cloud-pass">Password</label>
                    <div style={{display: 'flex', gap: 6}}>
                        <input
                            id="tb-cloud-pass"
                            type={showPass ? 'text' : 'password'}
                            value={wifi.password}
                            onChange={e => setWifi(Object.assign({}, wifi, {password: e.target.value}))}
                            onBlur={() => setTouched(true)}
                            placeholder="Leave empty for open WiFi"
                            autoComplete="new-password"
                            spellCheck={false}
                            autoFocus={Boolean(wifi.ssid)}
                            style={Object.assign({}, s.input, {flex: 1})}
                        />
                        <Button K={K} onClick={() => setShowPass(!showPass)}>{showPass ? 'Hide' : 'Show'}</Button>
                    </div>
                    {touched ? error(wifiCheck.errors.password) : null}
                </div>
                <label style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: K.sub}}>
                    <input
                        type="checkbox"
                        checked={wifi.remember}
                        onChange={e => setWifi(Object.assign({}, wifi, {remember: e.target.checked}))}
                    />
                    Remember on this computer (leave off on shared computers)
                </label>
            </div>
            <Disclosure K={K} label="WiFi tips">
                <ul style={Object.assign({}, s.small, {margin: 0, paddingLeft: 18})}>
                    <li>The board only sees 2.4 GHz WiFi. Many phones can make a 2.4 GHz hotspot.</li>
                    <li>WiFi with a login page or a username (school WiFi, eduroam) will not work. Use a phone hotspot.</li>
                    <li>Capitals and spaces in the name matter.</li>
                </ul>
            </Disclosure>
            <Footer>
                <Button K={K} onClick={w.back}>Back</Button>
                <Spacer />
                <Button K={K} kind="primary" type="submit" disabled={Boolean(busy)}>
                    {busy === 'save' ? 'Saving…' : 'Next'}
                </Button>
            </Footer>
        </form>
    );
};

export default WifiStep;
