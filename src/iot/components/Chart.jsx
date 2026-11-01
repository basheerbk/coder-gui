import React, {useEffect, useMemo, useRef, useState} from 'react';

import {errorText, iotApi} from '../../lib/iot-api';
import {clockTime, formatValue} from '../format';
import {useTheme} from '../ui.jsx';

const RANGES = [
    {id: '1h', label: '1 h', ms: 3600e3},
    {id: '6h', label: '6 h', ms: 6 * 3600e3},
    {id: '24h', label: '24 h', ms: 24 * 3600e3},
    {id: '7d', label: '7 d', ms: 7 * 24 * 3600e3},
    {id: '30d', label: '30 d', ms: 30 * 24 * 3600e3}
];

const DEFAULT_SIZE = {w: 600, h: 180};
const PAD = {l: 44, r: 10, t: 10, b: 22};

/** Gap threshold: a hole longer than this between points draws as a break, not a line. */
const gapMs = (tier, intervalSec) => {
    const step = tier === '1h' ? 3600e3 : (tier === '1m' ? 60e3 : (intervalSec || 10) * 1000);
    return Math.max(step * 3, (intervalSec || 10) * 3000);
};

const Chart = ({deviceId, readingKey, unit, recent, intervalSec}) => {
    const K = useTheme();
    const [range, setRange] = useState('1h');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [hover, setHover] = useState(null);
    const [size, setSize] = useState(DEFAULT_SIZE);
    const svgRef = useRef(null);
    const areaRef = useRef(null);
    const spec = RANGES.find(r => r.id === range);
    const W = size.w;
    const H = size.h;

    // The chart draws at the pixel size of its box, so text never stretches when a tile is resized.
    useEffect(() => {
        const el = areaRef.current;
        if (!el) {
            return undefined;
        }
        const measure = () => {
            const w = Math.round(el.clientWidth);
            const h = Math.round(el.clientHeight);
            if (w > 0 && h > 0) {
                setSize(prev => (prev.w === w && prev.h === h ? prev : {w: Math.max(200, w), h: Math.max(90, h)}));
            }
        };
        measure();
        if (typeof window.ResizeObserver === 'function') {
            const ro = new window.ResizeObserver(measure);
            ro.observe(el);
            return () => ro.disconnect();
        }
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [Boolean(data)]);

    useEffect(() => {
        let cancelled = false;
        setError('');
        const to = Date.now();
        iotApi.history(deviceId, readingKey, {from: to - spec.ms, to, points: 300})
            .then(res => {
                if (!cancelled) {
                    setData({tier: res.tier, points: res.points || [], from: to - spec.ms, to});
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(errorText(err));
                    setData({tier: 'raw', points: [], from: to - spec.ms, to});
                }
            });
        return () => {
            cancelled = true;
        };
    }, [deviceId, readingKey, range]);

    const points = useMemo(() => {
        if (!data) {
            return [];
        }
        const base = data.points.map(p => [p[0], p[1]]);
        const last = base.length ? base[base.length - 1][0] : data.from;
        // Live readings since the history request extend the right edge (only for raw tiers).
        const extra = data.tier === 'raw' ? (recent || []).filter(p => p[0] > last) : [];
        return base.concat(extra).filter(p => Number.isFinite(p[1]));
    }, [data, recent]);

    if (!data) {
        return <div ref={areaRef} style={{flex: 1, minHeight: 90, color: K.dim, fontSize: 12}}>Loading chart…</div>;
    }

    const now = Date.now();
    const x0 = data.from;
    const x1 = Math.max(now, data.to);
    let yMin = Infinity;
    let yMax = -Infinity;
    points.forEach(p => {
        yMin = Math.min(yMin, p[1]);
        yMax = Math.max(yMax, p[1]);
    });
    if (!points.length) {
        yMin = 0;
        yMax = 1;
    } else if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
    } else {
        const pad = (yMax - yMin) * 0.08;
        yMin -= pad;
        yMax += pad;
    }
    const sx = t => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const sy = v => PAD.t + (1 - ((v - yMin) / (yMax - yMin))) * (H - PAD.t - PAD.b);
    const gap = gapMs(data.tier, intervalSec);

    let d = '';
    points.forEach((p, i) => {
        const move = i === 0 || p[0] - points[i - 1][0] > gap;
        d += `${move ? 'M' : 'L'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`;
    });

    const onMove = e => {
        if (!points.length || !svgRef.current) {
            return;
        }
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const t = x0 + ((((clientX - rect.left) / rect.width) * W) - PAD.l) / (W - PAD.l - PAD.r) * (x1 - x0);
        let best = points[0];
        points.forEach(p => {
            if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) {
                best = p;
            }
        });
        setHover(best);
    };

    const longRange = spec.ms > 24 * 3600e3;
    const tickLabel = t => (longRange ? new Date(t).toLocaleDateString([], {month: 'short', day: 'numeric'}) : clockTime(t));

    return (
        <div style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0}}>
                {RANGES.map(r => (
                    <button
                        key={r.id}
                        type="button"
                        onClick={() => setRange(r.id)}
                        aria-pressed={r.id === range}
                        style={{
                            border: 'none',
                            borderRadius: 8,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: r.id === range ? K.accent : K.surface,
                            color: r.id === range ? '#fff' : K.sub
                        }}
                    >
                        {r.label}
                    </button>
                ))}
                <div style={{flex: 1}} />
                <span style={{fontSize: 11, color: K.dim}}>
                    {hover ? `${formatValue(hover[1], unit)} · ${longRange ? new Date(hover[0]).toLocaleString() : clockTime(hover[0])}` : ''}
                </span>
            </div>
            <div ref={areaRef} style={{flex: 1, minHeight: 90, position: 'relative'}}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                width={W}
                height={H}
                role="img"
                aria-label={`${readingKey} over the last ${spec.label}`}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                onTouchStart={onMove}
                onTouchMove={onMove}
                style={{display: 'block', touchAction: 'pan-y', position: 'absolute', left: 0, top: 0}}
            >
                {[0, 0.5, 1].map(f => {
                    const y = PAD.t + f * (H - PAD.t - PAD.b);
                    const v = yMax - f * (yMax - yMin);
                    return (
                        <g key={f}>
                            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={K.border} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            <text x={PAD.l - 6} y={y + 4} fontSize="11" textAnchor="end" fill={K.dim}>
                                {points.length ? formatValue(v) : ''}
                            </text>
                        </g>
                    );
                })}
                <text x={PAD.l} y={H - 6} fontSize="11" fill={K.dim}>{tickLabel(x0)}</text>
                <text x={W - PAD.r} y={H - 6} fontSize="11" textAnchor="end" fill={K.dim}>
                    {longRange ? tickLabel(x1) : 'now'}
                </text>
                {d ? (
                    <path
                        d={d}
                        fill="none"
                        stroke={K.accent}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                ) : null}
                {points.length === 1 ? <circle cx={sx(points[0][0])} cy={sy(points[0][1])} r="3" fill={K.accent} /> : null}
                {hover ? (
                    <circle cx={sx(hover[0])} cy={sy(hover[1])} r="4" fill={K.accent} stroke={K.panel} strokeWidth="2" />
                ) : null}
                {!points.length ? (
                    <text x={W / 2} y={H / 2} fontSize="13" textAnchor="middle" fill={K.dim}>
                        {error || 'No readings in this time range'}
                    </text>
                ) : null}
            </svg>
            </div>
        </div>
    );
};

export default Chart;
