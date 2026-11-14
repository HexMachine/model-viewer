import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const baseName = (u) => decodeURIComponent(u.split('?')[0].split('#')[0].split(/[\\/]/).pop()).toLowerCase();
export const extOf = (n) => (n.split('.').pop() || '').toLowerCase();

export class Viewer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene = new THREE.Scene();
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.grid = new THREE.GridHelper(10, 20, 0x666666, 0x333333);
    this.scene.add(this.grid);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 6, 4);
    this.scene.add(sun, new THREE.AmbientLight(0xffffff, 0.3));
    this.clock = new THREE.Clock();
    this.model = null;
    this.mixer = null;
    this.wire = false;
    this.setLightBackground(false);
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.mixer?.update(this.clock.getDelta());
      this.renderer.render(this.scene, this.camera);
    });
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement.parentElement;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  setLightBackground(on) { this.scene.background = on ? new THREE.Color(0xdfe3e8) : null; }
  setGrid(on) { this.grid.visible = on; }
  setAutoRotate(on) { this.controls.autoRotate = on; }
  setWireframe(on) {
    this.wire = on;
    this.model?.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => (m.wireframe = on)); });
  }

  /** files: File[] (a model plus optional .mtl/.bin/textures) or a single URL string with optional {mtl}. */
  async load(source, opts = {}) {
    const resources = new Map();
    const blobs = [];
    let url, ext, label;
    if (typeof source === 'string') {
      url = source; ext = extOf(source); label = baseName(source);
    } else {
      const files = [...source];
      const main = ['glb', 'gltf', 'fbx', 'obj'].map((e) => files.find((f) => extOf(f.name) === e)).find(Boolean);
      if (!main) throw new Error('No .glb, .gltf, .fbx or .obj file found in selection.');
      for (const f of files) { const b = URL.createObjectURL(f); blobs.push(b); resources.set(f.name.toLowerCase(), b); }
      url = resources.get(main.name.toLowerCase()); ext = extOf(main.name); label = main.name;
      const mtl = files.find((f) => extOf(f.name) === 'mtl');
      if (mtl) opts = { ...opts, mtl: resources.get(mtl.name.toLowerCase()) };
    }

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((u) => resources.get(baseName(u)) ?? u);

    try {
      let root, animations = [];
      if (ext === 'glb' || ext === 'gltf') {
        const loader = new GLTFLoader(manager);
        loader.setDRACOLoader(new DRACOLoader().setDecoderPath(import.meta.env.BASE_URL + 'draco/'));
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.loadAsync(url);
        root = gltf.scene; animations = gltf.animations;
      } else if (ext === 'fbx') {
        root = await new FBXLoader(manager).loadAsync(url);
        animations = root.animations;
      } else if (ext === 'obj') {
        const loader = new OBJLoader(manager);
        if (opts.mtl) {
          try {
            const mats = await new MTLLoader(manager).loadAsync(opts.mtl);
            mats.preload(); loader.setMaterials(mats);
          } catch (e) { console.warn('MTL failed to load', e); }
        }
        root = await loader.loadAsync(url);
        root.traverse((o) => { if (o.isMesh && !opts.mtl) o.material = new THREE.MeshStandardMaterial({ color: 0xbbbbbb }); });
      } else throw new Error(`Unsupported format: .${ext}`);
      this.show(root, animations);
      return { name: label, ...this.stats(root) };
    } finally {
      // Textures decode asynchronously after loadAsync resolves; revoke after a delay.
      setTimeout(() => blobs.forEach(URL.revokeObjectURL), 30000);
    }
  }

  clear() {
    if (!this.model) return;
    this.scene.remove(this.model);
    this.model.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material ?? []).forEach((m) => {
        for (const v of Object.values(m)) v?.isTexture && v.dispose();
        m.dispose();
      });
    });
    this.mixer?.stopAllAction();
    this.mixer = null; this.model = null; this.clips = [];
  }

  show(root, animations) {
    this.clear();
    this.model = root;
    this.scene.add(root);
    // center on origin, sit on the grid
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    this.size = box.getSize(new THREE.Vector3());
    const radius = Math.max(this.size.length() / 2, 1e-3);
    this.radius = radius;
    this.camera.near = radius / 100; this.camera.far = radius * 100;
    this.camera.updateProjectionMatrix();
    const g = new THREE.GridHelper(radius * 4, 20, 0x666666, 0x333333);
    g.visible = this.grid.visible;
    this.scene.remove(this.grid); this.grid.dispose?.(); this.grid = g; this.scene.add(g);
    this.resetCamera();
    this.setWireframe(this.wire);
    this.clips = animations;
    if (animations.length) { this.mixer = new THREE.AnimationMixer(root); this.playClip(0); }
  }

  playClip(i) {
    if (!this.mixer) return;
    this.mixer.stopAllAction();
    if (i >= 0) this.mixer.clipAction(this.clips[i]).play();
  }

  resetCamera() {
    const r = this.radius ?? 2;
    this.controls.target.set(0, this.size ? this.size.y / 2 : 0, 0);
    this.camera.position.set(r * 1.6, r * 1.2 + (this.size?.y ?? 0) / 2, r * 2.2);
    this.controls.update();
  }

  stats(root) {
    let tris = 0, verts = 0, meshes = 0;
    root.traverse((o) => {
      if (o.isMesh) {
        const g = o.geometry; meshes++;
        verts += g.attributes.position.count;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    return { triangles: Math.round(tris), vertices: verts, meshes, size: this.size, clips: this.clips };
  }
}
