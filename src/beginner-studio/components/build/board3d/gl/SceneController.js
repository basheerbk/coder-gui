import {
    AdditiveBlending,
    DirectionalLight,
    Group,
    HemisphereLight,
    Mesh,
    MeshBasicMaterial,
    NeutralToneMapping,
    PCFShadowMap,
    PMREMGenerator,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    Scene,
    ShadowMaterial,
    Vector2,
    Vector3,
    WebGLRenderer
} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

import {SCENE, TRACE_POINTS} from '../../../../domain/boardLayout';
import {PORTS, portUiState} from '../../../../domain/ports';
import {portTitle} from '../../Port.jsx';
import {
    CENTER,
    IDLE_MS,
    MAX_TILT,
    PERSPECTIVE,
    VIEWS,
    ZMAX,
    ZMIN,
    clamp,
    prefersReducedMotion,
    unitScale
} from '../view';

import {Kit, TextureBank, buildCable, disposeTree, glowTexture} from './hubKit';
import {TABLE_Z, buildBoard, buildConnection, buildPorts, buildSpareJacks} from './hubModel';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const PULSE_S = 1.6;
const ANIM_FRAME_MS = 33;
/** Pixel-ratio steps tried in order when frames run slow. */
const QUALITY = [2, 1.5, 1, 0.75];
const SLOW_FRAME_MS = 42;
const MAX_CONTEXT_LOSSES = 3;

const luminance = hex => {
    const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
    if (Number.isNaN(n)) {
        return 0.5;
    }
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) / 255;
};

/** Board space (x east, y north, z up) to three's world (y up). */
const toWorld = (x, y, z, out = new Vector3()) => out.set(x, z, -y);

const connKey = c => [c.id, c.moduleId, c.portId, c.offsetX || 0, c.offsetY || 0, c.bendX, c.bendY].join('|');

/**
 * Owns the WebGL renderer, the scene and the stage's pointer handling. React feeds it studio
 * state through sync(); it reports taps, hovers, view changes and context problems through
 * callbacks and positions the DOM overlays (unplug badges, tooltip) itself each frame.
 */
class SceneController {
    constructor (host, callbacks) {
        this.host = host;
        this.cb = callbacks;
        this.reduced = prefersReducedMotion();
        this.quality = 0;
        this.dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

        const renderer = new WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
        this.renderer = renderer;
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = NeutralToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.setPixelRatio(this.pixelRatio());
        const canvas = renderer.domElement;
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.setAttribute('aria-hidden', 'true');
        host.insertBefore(canvas, host.firstChild);

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(20, 1, 200, PERSPECTIVE * 3);
        this.root = new Group();
        this.root.rotation.x = -Math.PI / 2;
        this.scene.add(this.root);

        this.buildEnvironment();
        this.scene.environmentIntensity = 0.5;
        this.addLights();

        const caps = renderer.capabilities;
        this.textures = new TextureBank({
            maxSize: caps.maxTextureSize,
            anisotropy: Math.min(8, caps.getMaxAnisotropy()),
            onChange: () => this.invalidate(true)
        });
        this.kit = new Kit(this.textures);

        this.shadowCatcher = new Mesh(
            new PlaneGeometry(SCENE.w * 2, SCENE.h * 2),
            new ShadowMaterial({opacity: 0.25, depthWrite: false})
        );
        this.shadowCatcher.position.set(CENTER.x, -CENTER.y, TABLE_Z);
        this.shadowCatcher.receiveShadow = true;
        this.root.add(this.shadowCatcher);

        this.board = buildBoard(this.kit);
        this.root.add(this.board.group);
        this.portsGroup = new Group();
        this.tracesGroup = new Group();
        this.connGroup = new Group();
        this.root.add(this.portsGroup, this.tracesGroup, this.connGroup);
        this.ports = [];
        this.conns = new Map();
        this.pulses = [];
        this.portStates = {};
        this.flashAt = {};
        this.focusPort = null;
        this.anyLinked = false;
        this.K = null;
        this.linkSig = '';

        this.v = {
            rx: VIEWS.v3d.rx,
            rz: VIEWS.v3d.rz,
            trx: VIEWS.v3d.rx,
            trz: VIEWS.v3d.rz,
            sway: 0,
            zoom: 1,
            panX: 0,
            panY: 0,
            lastUser: -1e9,
            dragging: false,
            viewKey: 'v3d'
        };
        this.size = {w: 0, h: 0};
        this.camKey = '';
        this.pointers = new Map();
        this.down = null;
        this.pinch = null;
        this.hover = null;
        this.hoverDirty = false;
        this.ray = new Raycaster();
        this.ndc = new Vector2();
        this.tmp = new Vector3();
        this.badgeEls = new Map();
        this.tooltipEl = null;
        this.dirty = true;
        this.lastRender = 0;
        this.slow = {sum: 0, n: 0, last: 0, changedAt: 0};
        this.lost = false;
        this.losses = 0;
        this.disposed = false;

        this.bind();
        this.resize();
        this.raf = requestAnimationFrame(this.frame);
    }

    pixelRatio () {
        return Math.min(this.dpr, QUALITY[this.quality]);
    }

    // The PMREM result lives only on the GPU, so it must be rebuilt after a context restore.
    buildEnvironment () {
        if (this.envTex) {
            this.envTex.dispose();
        }
        const pmrem = new PMREMGenerator(this.renderer);
        const room = new RoomEnvironment();
        this.envTex = pmrem.fromScene(room, 0.04).texture;
        room.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                obj.material.dispose();
            }
        });
        pmrem.dispose();
        this.scene.environment = this.envTex;
    }

    addLights () {
        const hemi = new HemisphereLight('#ffffff', '#c9c2b4', 1.1);
        this.scene.add(hemi);
        const sun = new DirectionalLight('#fffaf0', 2.3);
        const target = toWorld(CENTER.x, -CENTER.y, 0);
        sun.position.copy(target).add(new Vector3(-380, 900, 520));
        sun.target.position.copy(target);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const cam = sun.shadow.camera;
        cam.left = -640;
        cam.right = 640;
        cam.top = 640;
        cam.bottom = -640;
        cam.near = 100;
        cam.far = 2600;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.6;
        sun.shadow.radius = 3;
        this.scene.add(sun, sun.target);
        this.sun = sun;
    }

    bind () {
        const host = this.host;
        const canvas = this.renderer.domElement;
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onPointerLeave = () => {
            this.setHover(null);
        };
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = e => e.preventDefault();
        this.onLost = e => {
            e.preventDefault();
            this.lost = true;
            this.losses += 1;
            this.cb.onContext('lost');
            if (this.losses >= MAX_CONTEXT_LOSSES) {
                this.cb.onFatal(new Error('WebGL context keeps getting lost'));
            }
        };
        this.onRestored = () => {
            this.lost = false;
            try {
                this.buildEnvironment();
            } catch (err) {
                this.cb.onFatal(err);
                return;
            }
            this.renderer.shadowMap.needsUpdate = true;
            this.cb.onContext('ok');
            this.invalidate(true);
        };
        this.onMotion = e => {
            this.reduced = e.matches;
            this.invalidate(true);
        };
        this.frame = this.frame.bind(this);

        host.addEventListener('pointerdown', this.onPointerDown);
        host.addEventListener('pointermove', this.onPointerMove);
        host.addEventListener('pointerup', this.onPointerUp);
        host.addEventListener('pointercancel', this.onPointerUp);
        host.addEventListener('pointerleave', this.onPointerLeave);
        host.addEventListener('wheel', this.onWheel, {passive: false});
        host.addEventListener('contextmenu', this.onContextMenu);
        canvas.addEventListener('webglcontextlost', this.onLost, false);
        canvas.addEventListener('webglcontextrestored', this.onRestored, false);
        if (window.matchMedia) {
            this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (this.motionQuery.addEventListener) {
                this.motionQuery.addEventListener('change', this.onMotion);
            } else if (this.motionQuery.addListener) {
                this.motionQuery.addListener(this.onMotion);
            }
        }
        if (typeof ResizeObserver === 'undefined') {
            this.onWindowResize = () => this.resize();
            window.addEventListener('resize', this.onWindowResize);
        } else {
            this.ro = new ResizeObserver(() => this.resize());
            this.ro.observe(host);
        }
    }

    // ---- State from React -------------------------------------------------

    /** Apply studio state; cheap when nothing relevant changed. */
    sync ({connections, usedPorts, liveLinks, selectedDef, flashPortId, K}) {
        if (this.disposed) {
            return;
        }
        let geometryChanged = false;
        if (K !== this.K) {
            this.applyTheme(K);
            geometryChanged = true;
        }

        const seen = new Set();
        connections.forEach(conn => {
            seen.add(conn.id);
            const key = connKey(conn);
            const prev = this.conns.get(conn.id);
            if (prev && prev.key === key) {
                return;
            }
            if (prev) {
                this.removeConn(conn.id);
            }
            this.addConn(conn, key);
            geometryChanged = true;
        });
        Array.from(this.conns.keys()).forEach(id => {
            if (!seen.has(id)) {
                this.removeConn(id);
                geometryChanged = true;
            }
        });

        const links = liveLinks || {};
        const sig = Object.keys(links).sort()
            .map(id => `${id}:${links[id].dir}:${links[id].color}`)
            .join(',');
        if (sig !== this.linkSig) {
            this.linkSig = sig;
            this.buildTraces(links);
        }
        this.anyLinked = Object.keys(links).length > 0;

        const states = {};
        PORTS.forEach(port => {
            states[port.id] = portUiState(port, usedPorts, selectedDef);
        });
        this.portStates = states;
        if (flashPortId && flashPortId !== this.lastFlash) {
            this.flashAt[flashPortId] = performance.now();
        }
        this.lastFlash = flashPortId;

        if (geometryChanged) {
            this.renderer.shadowMap.needsUpdate = true;
        }
        this.hoverDirty = true;
        this.invalidate(true);
    }

    applyTheme (K) {
        this.K = K;
        disposeTree(this.portsGroup);
        this.portsGroup.clear();
        Array.from(this.conns.keys()).forEach(id => this.removeConn(id));
        const gone = new Set(['label:', 'card:', 'jack-top:']
            .reduce((all, prefix) => all.concat(this.textures.evict(prefix)), []));
        this.kit.dropMaterials(m => gone.has(m.map));
        this.ports = buildPorts(this.kit, K);
        this.ports.forEach(p => this.portsGroup.add(p.jack, p.label));
        this.portsGroup.add(buildSpareJacks(this.kit));
        this.shadowCatcher.material.opacity = luminance(K.canvas) < 0.35 ? 0.5 : 0.24;
        this.buildTraces({}, true);
    }

    addConn (conn, key) {
        const built = buildConnection(this.kit, conn, this.K);
        if (!built) {
            return;
        }
        const group = new Group();
        if (built.group) {
            group.add(built.group);
        }
        if (built.from) {
            const color = built.port.signal === 'analog' ? this.K.analog : this.K.digital;
            const handle = conn.bendX == null ? null : {x: conn.bendX, y: conn.bendY};
            group.add(buildCable(this.kit, {from: built.from, to: built.to, handle, color}));
        }
        this.connGroup.add(group);
        this.conns.set(conn.id, {key, group, badge: built.badge, name: built.name, pickable: built.group});
    }

    removeConn (id) {
        const entry = this.conns.get(id);
        if (!entry) {
            return;
        }
        this.connGroup.remove(entry.group);
        disposeTree(entry.group);
        this.conns.delete(id);
    }

    /** Tinted copper under each live jack plus a travelling pulse (unless motion is reduced). */
    buildTraces (links, force) {
        if (force) {
            this.linkSig = '';
        }
        disposeTree(this.tracesGroup);
        this.tracesGroup.clear();
        this.pulses = [];
        Object.keys(links).forEach(portId => (TRACE_POINTS[portId] || []).forEach(pts => {
            const link = links[portId];
            const tint = new Mesh(Kit.ribbon(pts, 1.6, 0.06), this.kit.basic({color: link.color, opacity: 0.55, doubleSide: true}));
            tint.renderOrder = 1;
            this.tracesGroup.add(tint);

            const path = link.dir === 'in' ? pts : pts.slice().reverse();
            const lengths = [0];
            for (let i = 1; i < path.length; i++) {
                lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
            }
            const dots = [1, 0.55, 0.25].map((alpha, k) => {
                const m = new Mesh(
                    this.kit.geo('pulse-dot', () => new PlaneGeometry(1, 1)),
                    new MeshBasicMaterial({
                        color: link.color,
                        map: glowTexture(this.kit),
                        transparent: true,
                        opacity: alpha,
                        depthWrite: false,
                        blending: AdditiveBlending,
                        toneMapped: false
                    })
                );
                const s = 8 - (k * 1.5);
                m.scale.set(s, s, 1);
                m.renderOrder = 3;
                m.visible = false;
                this.tracesGroup.add(m);
                return m;
            });
            this.pulses.push({path, lengths, total: lengths[lengths.length - 1], dots});
        }));
    }

    // ---- DOM overlays -----------------------------------------------------

    setBadgeEl (id, el) {
        if (el) {
            this.badgeEls.set(id, el);
        } else {
            this.badgeEls.delete(id);
        }
        this.invalidate(true);
    }

    setTooltipEl (el) {
        this.tooltipEl = el;
    }

    /** Ring a jack while its keyboard button has focus. */
    setFocusPort (portId) {
        this.focusPort = portId;
        this.invalidate(true);
    }

    // ---- View ----------------------------------------------------------------

    chooseView (key) {
        const v = this.v;
        v.viewKey = key;
        if (key) {
            v.trx = VIEWS[key].rx;
            v.trz = VIEWS[key].rz;
            v.lastUser = performance.now();
            if (this.reduced) {
                v.rx = v.trx;
                v.rz = v.trz;
            }
        }
        this.cb.onView({viewKey: key, zoomPct: Math.round(v.zoom * 100)});
        this.invalidate(true);
    }

    clampPan () {
        const v = this.v;
        const lim = Math.max(0, v.zoom - 0.6);
        v.panX = clamp(v.panX, -this.size.w * lim, this.size.w * lim);
        v.panY = clamp(v.panY, -this.size.h * lim, this.size.h * lim);
    }

    zoomBy (factor, mx, my) {
        const v = this.v;
        const next = clamp(v.zoom * factor, ZMIN, ZMAX);
        const ratio = next / v.zoom;
        if (ratio === 1) {
            return;
        }
        const {w, h} = this.size;
        const cx = typeof mx === 'number' ? mx : w / 2;
        const cy = typeof my === 'number' ? my : h / 2;
        const px = (w / 2) + v.panX;
        const py = (h / 2) + v.panY;
        v.panX = cx - ((cx - px) * ratio) - (w / 2);
        v.panY = cy - ((cy - py) * ratio) - (h / 2);
        v.zoom = next;
        v.lastUser = performance.now();
        this.clampPan();
        this.cb.onView({viewKey: v.viewKey, zoomPct: Math.round(next * 100)});
        this.invalidate(true);
    }

    resetZoom () {
        const v = this.v;
        v.zoom = 1;
        v.panX = 0;
        v.panY = 0;
        this.cb.onView({viewKey: v.viewKey, zoomPct: 100});
        this.invalidate(true);
    }

    resize () {
        const w = this.host.clientWidth;
        const h = this.host.clientHeight;
        this.dpr = window.devicePixelRatio || 1;
        if (w < 8 || h < 8) {
            this.size = {w: 0, h: 0};
            return;
        }
        this.size = {w, h};
        this.renderer.setPixelRatio(this.pixelRatio());
        this.renderer.setSize(w, h, false);
        this.camKey = '';
        this.invalidate(true);
    }

    /** Orbit the board centre like the CSS view's rotateX/rotateZ; returns true if the camera moved. */
    updateCamera () {
        const {w, h} = this.size;
        const v = this.v;
        const theta = (v.rz + v.sway) * DEG;
        const tilt = v.rx * DEG;
        const key = [w, h, v.zoom, v.panX, v.panY, theta.toFixed(5), tilt.toFixed(5)].join('|');
        if (key === this.camKey) {
            return false;
        }
        this.camKey = key;
        const cam = this.camera;
        const u = unitScale(w, h, v.zoom);
        cam.fov = 2 * Math.atan(h / (2 * u * PERSPECTIVE)) / DEG;
        cam.aspect = w / h;
        cam.setViewOffset(w, h, -v.panX, -v.panY, w, h);
        cam.updateProjectionMatrix();

        const c = toWorld(CENTER.x, -CENTER.y, 0);
        const st = Math.sin(tilt);
        cam.position.set(
            c.x + (PERSPECTIVE * st * Math.sin(theta)),
            c.y + (PERSPECTIVE * Math.cos(tilt)),
            c.z + (PERSPECTIVE * st * Math.cos(theta))
        );
        const right = new Vector3(Math.cos(theta), 0, -Math.sin(theta));
        const fwd = c.clone().sub(cam.position)
            .normalize();
        cam.up.copy(right.cross(fwd).normalize());
        cam.lookAt(c);
        cam.updateMatrixWorld();
        return true;
    }

    // ---- Pointer -------------------------------------------------------------

    localPoint (event) {
        const rect = this.host.getBoundingClientRect();
        return {x: event.clientX - rect.left, y: event.clientY - rect.top};
    }

    /** What's under a stage point: {portId} | {connId, name} | null. */
    pick (x, y) {
        const {w, h} = this.size;
        if (!w) {
            return null;
        }
        this.ndc.set(((x / w) * 2) - 1, -((y / h) * 2) + 1);
        this.ray.setFromCamera(this.ndc, this.camera);
        const targets = this.ports.map(p => p.jack);
        this.conns.forEach(entry => {
            if (entry.pickable) {
                targets.push(entry.pickable);
            }
        });
        const hits = this.ray.intersectObjects(targets, true);
        for (let i = 0; i < hits.length; i++) {
            const data = hits[i].object.userData;
            if (data.portId) {
                return {portId: data.portId};
            }
            if (data.connId) {
                return {connId: data.connId, name: data.moduleName};
            }
        }
        return null;
    }

    onPointerDown (event) {
        if (event.target.closest && event.target.closest('[data-tb3d-ui]')) {
            return;
        }
        const pts = this.pointers;
        pts.set(event.pointerId, {x: event.clientX, y: event.clientY});
        if (this.host.setPointerCapture) {
            try {
                this.host.setPointerCapture(event.pointerId);
            } catch (e) {
                // Synthetic or already-released pointers can't be captured
            }
        }
        if (pts.size === 2) {
            const [a, b] = Array.from(pts.values());
            this.pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
            if (this.down) {
                this.down.moved = true;
            }
            return;
        }
        const v = this.v;
        this.down = {
            x: event.clientX,
            y: event.clientY,
            rx: v.trx,
            rz: v.trz,
            px: v.panX,
            py: v.panY,
            pan: event.shiftKey || event.button === 1 || event.button === 2,
            moved: false
        };
    }

    onPointerMove (event) {
        const pts = this.pointers;
        if (!pts.has(event.pointerId)) {
            if (event.pointerType !== 'touch') {
                this.hoverAt = this.localPoint(event);
                this.hoverDirty = true;
                this.invalidate();
            }
            return;
        }
        pts.set(event.pointerId, {x: event.clientX, y: event.clientY});
        const v = this.v;
        if (this.pinch && pts.size >= 2) {
            const [a, b] = Array.from(pts.values());
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const rect = this.host.getBoundingClientRect();
            v.panX += mx - this.pinch.mx;
            v.panY += my - this.pinch.my;
            if (this.pinch.d > 0) {
                this.zoomBy(d / this.pinch.d, mx - rect.left, my - rect.top);
            }
            this.pinch = {d, mx, my};
            return;
        }
        const down = this.down;
        if (!down) {
            return;
        }
        const dx = event.clientX - down.x;
        const dy = event.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5) {
            down.moved = true;
            v.dragging = true;
            this.cb.onDragging(true);
            this.setHover(null);
            if (!down.pan) {
                this.chooseView(null);
            }
        }
        if (down.moved) {
            if (down.pan) {
                v.panX = down.px + dx;
                v.panY = down.py + dy;
                this.clampPan();
            } else {
                v.trz = down.rz + (dx * 0.35);
                v.trx = clamp(down.rx - (dy * 0.3), 0, MAX_TILT);
                v.rx = v.trx;
                v.rz = v.trz;
            }
            v.lastUser = performance.now();
            this.invalidate(true);
        }
    }

    onPointerUp (event) {
        const pts = this.pointers;
        if (!pts.has(event.pointerId)) {
            return;
        }
        pts.delete(event.pointerId);
        if (pts.size < 2) {
            this.pinch = null;
        }
        if (pts.size > 0) {
            return;
        }
        const down = this.down;
        this.down = null;
        const v = this.v;
        if (v.dragging) {
            v.dragging = false;
            this.cb.onDragging(false);
        }
        v.lastUser = performance.now();
        if (down && !down.moved && event.type === 'pointerup') {
            const p = this.localPoint(event);
            const hit = this.pick(p.x, p.y);
            if (hit && hit.portId) {
                this.cb.onPort(hit.portId);
            } else {
                this.cb.onEmpty();
            }
        }
        this.hoverDirty = true;
    }

    onWheel (event) {
        event.preventDefault();
        const p = this.localPoint(event);
        const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        this.zoomBy(Math.exp(-dy * 0.0015), p.x, p.y);
    }

    setHover (hit) {
        const id = hit ? (hit.portId || hit.connId) : null;
        const prevId = this.hover ? (this.hover.portId || this.hover.connId) : null;
        this.hover = hit;
        const tip = this.tooltipEl;
        if (!tip) {
            return;
        }
        if (!hit) {
            tip.style.visibility = 'hidden';
            this.host.style.cursor = '';
            return;
        }
        let text = hit.name || '';
        let cursor = 'pointer';
        if (hit.portId) {
            const port = PORTS.find(p => p.id === hit.portId);
            const st = this.portStates[hit.portId] || {};
            text = port ? portTitle(port, st) : '';
            cursor = st.dimmed ? 'not-allowed' : 'pointer';
        }
        if (id !== prevId || tip.textContent !== text) {
            tip.textContent = text;
        }
        this.host.style.cursor = cursor;
        if (this.hoverAt) {
            tip.style.transform = `translate(${Math.round(this.hoverAt.x + 14)}px, ${Math.round(this.hoverAt.y + 16)}px)`;
        }
        tip.style.visibility = text ? 'visible' : 'hidden';
    }

    // ---- Frame -------------------------------------------------------------

    invalidate (now) {
        this.dirty = true;
        if (now) {
            this.lastRender = 0;
        }
    }

    /** Jack rings, glows and dimming; returns true while something is animating. */
    updatePorts (now) {
        let animating = false;
        const t = now / 1000;
        this.ports.forEach(p => {
            const st = this.portStates[p.port.id] || {};
            const flashT = this.flashAt[p.port.id] ? (now - this.flashAt[p.port.id]) / 450 : 2;
            let ring = 0;
            let glow = 0;
            if (flashT < 1) {
                ring = 1 - flashT;
                glow = 0.8 * (1 - flashT);
                animating = true;
            } else if (st.compatible) {
                const beat = this.reduced ? 1 : 0.5 + (0.5 * Math.sin(t * TAU));
                ring = 0.35 + (0.65 * beat);
                glow = 0.2 + (0.4 * beat);
                animating = animating || !this.reduced;
            } else if (st.occupied) {
                ring = 0.85;
            }
            if (this.focusPort === p.port.id) {
                ring = Math.max(ring, 1);
                glow = Math.max(glow, 0.35);
            }
            p.ring.material.opacity = ring;
            p.ring.visible = ring > 0.01;
            p.glow.material.opacity = glow;
            p.glow.visible = glow > 0.01;
            const dim = st.dimmed ? 0.3 : 1;
            if (p.dim !== dim) {
                p.dim = dim;
                p.jack.traverse(obj => {
                    if (obj.isMesh && obj !== p.ring && obj !== p.glow && !obj.userData.hitOnly) {
                        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
                            m.transparent = dim < 1;
                            m.opacity = dim;
                            m.needsUpdate = true;
                        });
                    }
                });
                p.label.material.opacity = dim;
            }
        });
        return animating;
    }

    updateLeds (now) {
        const t = now / 1000;
        this.board.leds.forEach(({mode, glow}) => {
            let o = 0.9;
            if (mode === 'heartbeat' && !this.reduced) {
                const k = (t % 1.4) / 1.4;
                o = 0.2 + (0.75 * Math.pow(Math.max(0, Math.sin(k * Math.PI * 2)), 6)) +
                    (0.45 * Math.pow(Math.max(0, Math.sin((k - 0.18) * Math.PI * 2)), 10));
            } else if (mode === 'activity') {
                if (!this.anyLinked) {
                    o = 0.15;
                } else if (!this.reduced) {
                    o = 0.15 + (0.85 * (0.5 + (0.5 * Math.cos((t / 0.9) * TAU))));
                }
            }
            glow.material.opacity = Math.min(1, o);
        });
        return !this.reduced;
    }

    updatePulses (now) {
        if (!this.pulses.length) {
            return false;
        }
        const show = !this.reduced;
        const phase = (now / 1000 / PULSE_S) % 1;
        this.pulses.forEach(p => {
            p.dots.forEach((dot, k) => {
                dot.visible = show;
                if (!show) {
                    return;
                }
                const s = (((phase - (k * 0.035)) % 1) + 1) % 1 * p.total;
                let i = 1;
                while (i < p.lengths.length - 1 && p.lengths[i] < s) {
                    i++;
                }
                const seg = (p.lengths[i] - p.lengths[i - 1]) || 1;
                const f = (s - p.lengths[i - 1]) / seg;
                const [ax, ay] = p.path[i - 1];
                const [bx, by] = p.path[i];
                dot.position.set(ax + ((bx - ax) * f), -(ay + ((by - ay) * f)), 0.3 + (k * 0.01));
            });
        });
        return show;
    }

    placeOverlays () {
        const {w, h} = this.size;
        const p = this.tmp;
        this.badgeEls.forEach((el, id) => {
            const entry = this.conns.get(id);
            if (!entry || !w) {
                el.style.visibility = 'hidden';
                return;
            }
            const b = entry.badge;
            toWorld(b.x, -b.y, b.z, p).project(this.camera);
            const x = ((p.x + 1) / 2) * w;
            const y = ((1 - p.y) / 2) * h;
            const visible = p.z < 1 && x > -20 && y > -20 && x < w + 20 && y < h + 20;
            el.style.visibility = visible ? 'visible' : 'hidden';
            el.style.transform = `translate(${Math.round(x - 11)}px, ${Math.round(y - 11)}px)`;
        });
    }

    trackSpeed (now) {
        const s = this.slow;
        if (s.last) {
            s.sum += now - s.last;
            s.n += 1;
        }
        s.last = now;
        if (s.n < 90) {
            return;
        }
        const avg = s.sum / s.n;
        s.sum = 0;
        s.n = 0;
        if (avg > SLOW_FRAME_MS && this.quality < QUALITY.length - 1 && now - s.changedAt > 3000) {
            this.quality += 1;
            s.changedAt = now;
            this.renderer.setPixelRatio(this.pixelRatio());
            this.renderer.setSize(this.size.w, this.size.h, false);
        }
    }

    frame (now) {
        if (this.disposed) {
            return;
        }
        this.raf = requestAnimationFrame(this.frame);
        if (this.lost || !this.size.w) {
            return;
        }
        const v = this.v;
        const dt = Math.min(0.05, (now - (this.prevNow || now)) / 1000);
        this.prevNow = now;
        if (!v.dragging) {
            const k = this.reduced ? 1 : 1 - Math.pow(0.0025, dt);
            v.rx += (v.trx - v.rx) * k;
            v.rz += (v.trz - v.rz) * k;
            if (Math.abs(v.trx - v.rx) < 0.01) {
                v.rx = v.trx;
            }
            if (Math.abs(v.trz - v.rz) < 0.01) {
                v.rz = v.trz;
            }
        }
        const idle = !this.reduced && !v.dragging && now - v.lastUser > IDLE_MS && v.viewKey !== 'vtop';
        this.swayT = (this.swayT || 0) + dt;
        const swayTarget = idle ? Math.sin(this.swayT * 0.35) * 9 : 0;
        v.sway += (swayTarget - v.sway) * Math.min(1, dt * 1.5);
        if (!idle && Math.abs(v.sway) < 0.005) {
            v.sway = 0;
        }

        const moved = this.updateCamera();
        const animating = [
            this.updatePorts(now),
            this.updateLeds(now),
            this.updatePulses(now)
        ].some(Boolean);

        if (this.hoverDirty && this.hoverAt && !v.dragging && this.pointers.size === 0) {
            this.hoverDirty = false;
            this.setHover(this.pick(this.hoverAt.x, this.hoverAt.y));
        }

        const due = moved || this.dirty || (animating && now - this.lastRender >= ANIM_FRAME_MS);
        if (!due) {
            this.slow.last = 0;
            return;
        }
        if (moved) {
            this.hoverDirty = true;
            this.trackSpeed(now);
        } else {
            this.slow.last = 0;
        }
        this.dirty = false;
        this.lastRender = now;
        try {
            this.renderer.render(this.scene, this.camera);
            this.failures = 0;
        } catch (err) {
            // A render that throws every frame (driver or shader trouble) means WebGL isn't usable here
            this.failures = (this.failures || 0) + 1;
            if (this.failures >= 3) {
                this.cb.onFatal(err);
            }
            return;
        }
        this.placeOverlays();
    }

    dispose () {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        const host = this.host;
        const canvas = this.renderer.domElement;
        host.removeEventListener('pointerdown', this.onPointerDown);
        host.removeEventListener('pointermove', this.onPointerMove);
        host.removeEventListener('pointerup', this.onPointerUp);
        host.removeEventListener('pointercancel', this.onPointerUp);
        host.removeEventListener('pointerleave', this.onPointerLeave);
        host.removeEventListener('wheel', this.onWheel);
        host.removeEventListener('contextmenu', this.onContextMenu);
        canvas.removeEventListener('webglcontextlost', this.onLost);
        canvas.removeEventListener('webglcontextrestored', this.onRestored);
        if (this.motionQuery) {
            if (this.motionQuery.removeEventListener) {
                this.motionQuery.removeEventListener('change', this.onMotion);
            } else if (this.motionQuery.removeListener) {
                this.motionQuery.removeListener(this.onMotion);
            }
        }
        if (this.ro) {
            this.ro.disconnect();
        }
        if (this.onWindowResize) {
            window.removeEventListener('resize', this.onWindowResize);
        }
        disposeTree(this.root);
        this.kit.dispose();
        this.textures.dispose();
        this.envTex.dispose();
        this.sun.shadow.dispose();
        this.renderer.dispose();
        // Browsers cap live WebGL contexts; give this one back now instead of at GC
        this.renderer.forceContextLoss();
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        host.style.cursor = '';
    }
}

export default SceneController;
