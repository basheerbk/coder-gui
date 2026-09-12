let audioCtx = null;

const getCtx = () => {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            return null;
        }
        if (!audioCtx) {
            audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    } catch (err) {
        return null;
    }
};

const tone = (startHz, endHz, durationMs, gainPeak = 0.12) => {
    try {
        const ctx = getCtx();
        if (!ctx) {
            return;
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startHz, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            Math.max(endHz, 1),
            ctx.currentTime + durationMs / 1000
        );
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    } catch (err) {
        // Fail silently when AudioContext is blocked.
    }
};

const playConnect = () => tone(1200, 400, 80, 0.14);
const playDisconnect = () => tone(400, 200, 120, 0.1);
const playTick = () => tone(800, 800, 60, 0.08);

export {playConnect, playDisconnect, playTick};
