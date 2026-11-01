/*
 * TinkerBit 3D components, standalone.
 *
 *   import {createViewer, createComponent, COMPONENTS} from './lib/index.js';
 *   const viewer = createViewer(document.getElementById('stage'));
 *   viewer.showComponent('pot');                    // or viewer.add(createComponent('dht'))
 *
 * Needs an import map that resolves "three" (see index.html). All sizes are studio board units.
 */
import {Box3, Group, Mesh} from 'three';

import {CARD, JACK_H, MODULES, PCB_H, THEMES} from './board-data.js';
import buildCable, {TABLE_Z} from './cable.js';
import Kit, {at, disposeTree} from './kit.js';
import {buildModule, placeModule} from './pcb.js';
import TextureBank from './textures.js';
import objectToTopSVG from './top-svg.js';
import {Viewer, createViewer} from './viewer.js';

import board, {PORTS, TRACE_POINTS, buildBoardScene} from '../components/esp32-board.js';
import {CARD_T, makeCard} from '../components/card.js';
import MODELS from '../components/models.js';

TextureBank.assetRoot = new URL('../', import.meta.url).href;

const MOUTH_Z = JACK_H * 0.46;
const OUTWARD = {top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0]};

/** Modules without a 3D model are shown as flat cards only when this is on. */
const SHOW_CARDS = false;

/** Every component: the board, then the modelled modules (and the card-only ones if SHOW_CARDS). */
const COMPONENTS = [board].concat(MODULES.filter(m => MODELS[m.id] || SHOW_CARDS).map(m => (
    MODELS[m.id] ? {...MODELS[m.id], kind: 'module', color: m.color} : makeCard(m)
)));

const getComponent = id => {
    const comp = COMPONENTS.find(c => c.id === id);
    if (!comp) {
        throw new Error(`Unknown component "${id}". Known: ${COMPONENTS.map(c => c.id).join(', ')}`);
    }
    return comp;
};

let sharedKit = null;
/** Kit used by createComponent when none is passed (textures shared across calls). */
const defaultKit = () => {
    if (!sharedKit) {
        sharedKit = new Kit(new TextureBank());
    }
    return sharedKit;
};

/** Subscribe to async texture loads of the default kit (re-render your scene when it fires). */
const onTexturesChanged = fn => defaultKit().tex.onChange(fn);

const buildRaw = (kit, comp, options) => {
    if (comp.kind === 'board') {
        return comp.buildScene(kit, options);
    }
    if (comp.kind === 'card') {
        const g = new Group();
        g.name = comp.id;
        g.add(comp.buildCard(kit, options));
        return g;
    }
    return buildModule(kit, comp, options);
};

/** Move obj so its footprint is centred on the origin and its underside sits at z = 0. */
const recentre = obj => {
    obj.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(obj);
    if (!box.isEmpty()) {
        const cx = (box.min.x + box.max.x) / 2;
        const cy = (box.min.y + box.max.y) / 2;
        obj.position.x -= cx;
        obj.position.y -= cy;
        obj.position.z -= box.min.z;
    }
    return obj;
};

/**
 * One component in board space (x east, y north, z up), centred with its underside at z = 0.
 * options: theme ('dark' | 'light'), and for modules pcb, edge, label, labelSize plus any
 * component-specific options (e.g. led {on}, btn {capColor}, pot {knobColor}).
 */
const buildComponent = (kit, id, options = {}) => recentre(buildRaw(kit, getComponent(id), {theme: 'dark', ...options}));

/**
 * One component as an ordinary three.js Group (Y up), centred on the origin and resting on y = 0.
 * options: everything buildComponent takes, plus kit (defaults to a shared one) and scale.
 */
const createComponent = (id, options = {}) => {
    const kit = options.kit || defaultKit();
    const tilt = new Group();
    tilt.rotation.x = -Math.PI / 2;
    tilt.add(buildComponent(kit, id, options));
    const outer = new Group();
    outer.name = id;
    outer.scale.setScalar(options.scale || 1);
    outer.add(tilt);
    outer.userData.component = id;
    return outer;
};

const cardCablePoint = (cardX, cardY, side) => {
    if (side === 'top') {
        return {x: cardX + (CARD.w / 2), y: cardY + CARD.h};
    }
    if (side === 'bottom') {
        return {x: cardX + (CARD.w / 2), y: cardY};
    }
    if (side === 'left') {
        return {x: cardX + CARD.w, y: cardY + (CARD.h / 2)};
    }
    return {x: cardX, y: cardY + (CARD.h / 2)};
};

/**
 * The ESP32 board with one component plugged into a jack (its default jack unless portId is
 * given), cable and lit copper trace included. Board space, studio world coordinates.
 */
const buildPluggedScene = (kit, id, {theme = 'dark', portId, ...options} = {}) => {
    const scene = buildBoardScene(kit, {theme});
    const comp = getComponent(id);
    if (comp.kind === 'board') {
        return scene;
    }
    const port = PORTS.find(p => p.id === (portId || comp.defaultPort)) || PORTS[0];
    const K = THEMES[theme] || THEMES.dark;
    const color = port.kind === 'analog' ? K.analog : K.digital;
    const dir = OUTWARD[port.side] || OUTWARD.right;
    const pos = port.pos;

    (TRACE_POINTS[port.id] || []).forEach(line => {
        const tint = new Mesh(Kit.ribbon(line, 1.6, 0.06), kit.basic({color, opacity: 0.6, doubleSide: true}));
        tint.renderOrder = 1;
        scene.add(tint);
    });

    let to;
    if (comp.kind === 'card') {
        scene.add(comp.buildCard(kit, {theme, x: pos.cardX, y: pos.cardY, z: TABLE_Z}));
        to = {...cardCablePoint(pos.cardX, pos.cardY, port.side), z: TABLE_Z + (CARD_T / 2)};
    } else {
        const group = buildModule(kit, comp, options);
        const placement = placeModule(group.userData.spec, port);
        const [cx, cy] = at(placement.cx, placement.cy);
        group.position.set(cx, cy, TABLE_Z);
        // SVG rotate() is clockwise with y down; board space has y up
        group.rotation.z = -placement.rotation * (Math.PI / 180);
        scene.add(group);
        to = {...placement.jack, z: TABLE_Z + PCB_H + MOUTH_Z};
    }
    scene.add(buildCable(kit, {from: {x: pos.cableX, y: pos.cableY, z: MOUTH_Z, dir}, to: {...to, dir}, color}));
    scene.userData.port = port;
    return scene;
};

let topKit = null;

/**
 * Vector top view of a component as an SVG string (board units, y down).
 * options: plugged, portId and theme, the SVG options scale, padding, background, shade, title and
 * embedAsset (see top-svg.js), plus any component options (e.g. pot {knobColor}).
 */
const toTopSVG = (id, {plugged = false, portId, scale, padding, background, shade, title, embedAsset, idPrefix, kit, ...options} = {}) => {
    if (!kit) {
        topKit = topKit || new Kit(new TextureBank({headless: true}));
    }
    const k = kit || topKit;
    const root = plugged ?
        buildPluggedScene(k, id, {theme: 'dark', ...options, portId}) :
        buildComponent(k, id, options);
    const svg = objectToTopSVG(root, {scale, padding, background, shade, title: title || getComponent(id).name, embedAsset, idPrefix});
    disposeTree(root);
    return svg;
};

/** Viewer shortcuts: show one component on its own or plugged into the board. */
Viewer.prototype.showComponent = function (id, options = {}) {
    return this.show((kit, {theme}) => buildComponent(kit, id, {...options, theme}));
};
Viewer.prototype.showPlugged = function (id, options = {}) {
    return this.show((kit, {theme}) => buildPluggedScene(kit, id, {...options, theme}));
};

export {
    COMPONENTS,
    MODELS,
    PORTS,
    THEMES,
    getComponent,
    buildComponent,
    createComponent,
    buildPluggedScene,
    toTopSVG,
    objectToTopSVG,
    onTexturesChanged,
    createViewer,
    Viewer,
    Kit,
    TextureBank,
    buildCable,
    buildModule,
    placeModule,
    disposeTree
};
