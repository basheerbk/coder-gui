import {
    Box3,
    DirectionalLight,
    Group,
    HemisphereLight,
    Mesh,
    NeutralToneMapping,
    PCFShadowMap,
    PerspectiveCamera,
    PlaneGeometry,
    PMREMGenerator,
    Scene,
    ShadowMaterial,
    Sphere,
    Vector3,
    WebGLRenderer
} from 'three';
import {OrbitControls} from '../vendor/three/OrbitControls.js';
import {RoomEnvironment} from '../vendor/three/RoomEnvironment.js';

import {THEMES} from './board-data.js';
import Kit, {disposeTree} from './kit.js';
import TextureBank from './textures.js';

const MAX_DPR = 2;
const VIEW_DIR = new Vector3(0.55, 0.85, 1).normalize();

/**
 * A self-contained three.js stage for the components: renderer, studio lighting, a soft shadow
 * catcher, orbit controls and on-demand rendering. Board-space content (x east, y north, z up)
 * goes in through show(); ordinary Y-up objects through add().
 */
class Viewer {
    constructor (container, {theme = 'dark', background, autoRotate = false, shadows = true, fov = 30} = {}) {
        if (!container) {
            throw new Error('createViewer needs a container element');
        }
        this.container = container;
        this.theme = theme;
        this.backgroundOverride = background;
        this.disposed = false;
        this.dirty = true;
        this.wireframe = false;
        this.lastShow = null;

        const renderer = new WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: false});
        this.renderer = renderer;
        renderer.toneMapping = NeutralToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = shadows;
        renderer.shadowMap.type = PCFShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
        const canvas = renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.touchAction = 'none';
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(canvas);

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(fov, 1, 1, 20000);
        this.camera.position.set(400, 500, 600);

        // Board space: the studio builds with z up; turn it so z becomes three's +y.
        this.root = new Group();
        this.root.rotation.x = -Math.PI / 2;
        this.scene.add(this.root);
        this.extra = new Group();
        this.scene.add(this.extra);

        const caps = renderer.capabilities;
        this.textures = new TextureBank({
            maxSize: caps.maxTextureSize,
            anisotropy: Math.min(8, caps.getMaxAnisotropy()),
            onChange: () => this.invalidate()
        });
        this.kit = new Kit(this.textures);

        this.buildEnvironment();
        this.scene.environmentIntensity = 0.5;
        this.addLights();
        this.catcher = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({opacity: 0.25, depthWrite: false}));
        this.catcher.rotation.x = -Math.PI / 2;
        this.catcher.receiveShadow = true;
        this.catcher.visible = false;
        this.scene.add(this.catcher);

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.autoRotate = autoRotate;
        this.controls.autoRotateSpeed = 1.2;
        this.controls.maxPolarAngle = Math.PI * 0.495;
        this.controls.addEventListener('change', () => this.invalidate());

        this.applyBackground();
        this.bind();
        this.resize();
        this.frame = this.frame.bind(this);
        this.raf = requestAnimationFrame(this.frame);
    }

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
        this.scene.add(new HemisphereLight('#ffffff', '#c9c2b4', 1.1));
        const sun = new DirectionalLight('#fffaf0', 2.3);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.6;
        sun.shadow.radius = 3;
        this.scene.add(sun, sun.target);
        this.sun = sun;
    }

    bind () {
        const canvas = this.renderer.domElement;
        this.onLost = e => {
            e.preventDefault();
            this.lost = true;
        };
        this.onRestored = () => {
            this.lost = false;
            this.buildEnvironment();
            this.invalidate();
        };
        canvas.addEventListener('webglcontextlost', this.onLost, false);
        canvas.addEventListener('webglcontextrestored', this.onRestored, false);
        if (typeof ResizeObserver !== 'undefined') {
            this.ro = new ResizeObserver(() => this.resize());
            this.ro.observe(this.container);
        } else {
            this.onWindowResize = () => this.resize();
            window.addEventListener('resize', this.onWindowResize);
        }
    }

    invalidate () {
        this.dirty = true;
    }

    resize () {
        const w = Math.max(1, this.container.clientWidth);
        const h = Math.max(1, this.container.clientHeight);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.invalidate();
    }

    applyBackground () {
        const bg = this.backgroundOverride === undefined ? (THEMES[this.theme] || THEMES.dark).canvas : this.backgroundOverride;
        if (bg === null || bg === 'transparent') {
            this.renderer.setClearColor(0x000000, 0);
        } else {
            this.renderer.setClearColor(bg, 1);
        }
        this.catcher.material.opacity = this.theme === 'light' ? 0.24 : 0.5;
        this.invalidate();
    }

    // ---- Content ------------------------------------------------------------

    /**
     * Replace the stage contents. `target` is a board-space Object3D or a builder function
     * (kit, {theme}) => Object3D that is re-run when the theme changes.
     */
    show (target, {frame = true} = {}) {
        this.clear();
        this.lastShow = target;
        const obj = typeof target === 'function' ? target(this.kit, {theme: this.theme}) : target;
        if (obj) {
            this.root.add(obj);
        }
        this.afterChange(frame);
        return obj;
    }

    /** Add an ordinary Y-up object (for example the result of createComponent). */
    add (obj, {frame = true} = {}) {
        this.extra.add(obj);
        this.afterChange(frame);
        return obj;
    }

    clear () {
        [this.root, this.extra].forEach(group => {
            disposeTree(group);
            group.clear();
        });
        this.lastShow = null;
        this.catcher.visible = false;
        this.invalidate();
    }

    afterChange (frame) {
        this.applyWireframe();
        this.fitShadows();
        if (frame) {
            this.frameContent();
        }
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    }

    bounds () {
        const box = new Box3();
        box.expandByObject(this.root);
        box.expandByObject(this.extra);
        return box;
    }

    /** Fit the shadow camera and the catcher plane to the content. */
    fitShadows () {
        const box = this.bounds();
        if (box.isEmpty()) {
            return;
        }
        const sphere = box.getBoundingSphere(new Sphere());
        const r = Math.max(10, sphere.radius);
        const c = sphere.center;
        this.sun.target.position.copy(c);
        this.sun.position.copy(c).add(new Vector3(-0.38, 0.9, 0.52).multiplyScalar(r * 3));
        const cam = this.sun.shadow.camera;
        cam.left = -r * 1.3;
        cam.right = r * 1.3;
        cam.top = r * 1.3;
        cam.bottom = -r * 1.3;
        cam.near = r * 0.5;
        cam.far = r * 6;
        cam.updateProjectionMatrix();
        this.catcher.position.set(c.x, box.min.y - 0.05, c.z);
        this.catcher.scale.set(r * 6, r * 6, 1);
        this.catcher.visible = true;
    }

    /** Point the camera at the content from the default three-quarter angle. */
    frameContent (dir = VIEW_DIR) {
        const box = this.bounds();
        if (box.isEmpty()) {
            return;
        }
        const sphere = box.getBoundingSphere(new Sphere());
        const r = Math.max(10, sphere.radius);
        const fov = this.camera.fov * (Math.PI / 180);
        const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect));
        const unit = dir.clone().normalize();
        const center = box.getCenter(new Vector3());
        const corners = [];
        [box.min.x, box.max.x].forEach(x => [box.min.y, box.max.y].forEach(y => [box.min.z, box.max.z].forEach(z => {
            corners.push(new Vector3(x, y, z));
        })));
        // Start from the sphere fit, then tighten so the projected box fills ~88% of the view
        let dist = r / Math.sin(fit / 2);
        this.controls.target.copy(center);
        for (let i = 0; i < 4; i++) {
            this.camera.position.copy(center).add(unit.clone().multiplyScalar(dist));
            this.camera.near = Math.max(0.5, dist / 100);
            this.camera.far = dist * 20;
            this.camera.lookAt(center);
            this.camera.updateMatrixWorld(true);
            this.camera.updateProjectionMatrix();
            const extent = corners.reduce((m, p) => {
                const q = p.clone().project(this.camera);
                return Math.max(m, Math.abs(q.x), Math.abs(q.y));
            }, 0);
            dist *= Math.max(0.5, Math.min(2, extent / 0.88));
        }
        this.camera.position.copy(center).add(unit.multiplyScalar(dist));
        this.camera.near = Math.max(0.5, dist / 100);
        this.camera.far = dist * 20;
        this.camera.updateProjectionMatrix();
        this.controls.minDistance = Math.min(r * 0.4, dist * 0.5);
        this.controls.maxDistance = dist * 4;
        this.controls.update();
        this.invalidate();
    }

    // ---- Settings -----------------------------------------------------------

    setTheme (theme) {
        if (theme === this.theme) {
            return;
        }
        this.theme = theme;
        this.applyBackground();
        if (typeof this.lastShow === 'function') {
            const target = this.lastShow;
            const camPos = this.camera.position.clone();
            const camTarget = this.controls.target.clone();
            this.show(target, {frame: false});
            this.camera.position.copy(camPos);
            this.controls.target.copy(camTarget);
        }
    }

    setBackground (color) {
        this.backgroundOverride = color;
        this.applyBackground();
    }

    setAutoRotate (on) {
        this.controls.autoRotate = Boolean(on);
        this.invalidate();
    }

    setShadows (on) {
        this.renderer.shadowMap.enabled = Boolean(on);
        this.catcher.visible = Boolean(on) && !this.bounds().isEmpty();
        this.scene.traverse(obj => {
            if (obj.material) {
                (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
                    m.needsUpdate = true;
                });
            }
        });
        this.renderer.shadowMap.needsUpdate = true;
        this.invalidate();
    }

    setWireframe (on) {
        this.wireframe = Boolean(on);
        this.applyWireframe();
        this.invalidate();
    }

    applyWireframe () {
        [this.root, this.extra].forEach(group => group.traverse(obj => {
            if (obj.isMesh && obj.material) {
                (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
                    if ('wireframe' in m) {
                        m.wireframe = this.wireframe;
                    }
                });
            }
        }));
    }

    // ---- Output -------------------------------------------------------------

    render () {
        if (this.lost || this.disposed) {
            return;
        }
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
    }

    /** PNG data URL of the current view (rendered on the spot, so it is never blank). */
    toPNG () {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
    }

    frame () {
        if (this.disposed) {
            return;
        }
        this.raf = requestAnimationFrame(this.frame);
        const moved = this.controls.update();
        if (moved || this.dirty) {
            this.render();
        }
    }

    dispose () {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        const canvas = this.renderer.domElement;
        canvas.removeEventListener('webglcontextlost', this.onLost);
        canvas.removeEventListener('webglcontextrestored', this.onRestored);
        if (this.ro) {
            this.ro.disconnect();
        }
        if (this.onWindowResize) {
            window.removeEventListener('resize', this.onWindowResize);
        }
        this.controls.dispose();
        disposeTree(this.root);
        disposeTree(this.extra);
        this.catcher.geometry.dispose();
        this.catcher.material.dispose();
        this.kit.dispose();
        this.textures.dispose();
        this.envTex.dispose();
        this.sun.shadow.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        canvas.remove();
    }
}

const createViewer = (container, options) => new Viewer(container, options);

export {Viewer, createViewer};
