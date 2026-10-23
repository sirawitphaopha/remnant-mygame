import * as THREE from 'three';
import { DEFAULT_QUALITY, QUALITY, type QualityLevel, type QualityPreset } from '../config/quality';
import { SPAWN_POINT } from '../world/layout';
import { Terrain } from '../world/Terrain';
import { Player } from '../player/Player';
import { CameraRig } from '../render/CameraRig';
import { Grass } from '../render/Grass';
import { TerrainMesh } from '../render/TerrainMesh';
import { Vegetation } from '../render/Vegetation';
import { Water } from '../render/Water';
import { WIND } from '../render/wind';
import { Input } from './Input';

/** ผูกทุกส่วนของเกมเข้าด้วยกัน และวนลูปทุกเฟรม */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1400);
  readonly input: Input;
  readonly terrain: Terrain;
  readonly terrainMesh: TerrainMesh;
  readonly water: Water;
  readonly vegetation: Vegetation;
  readonly grass: Grass;
  readonly player: Player;
  readonly rig: CameraRig;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  quality: QualityLevel = DEFAULT_QUALITY;
  private q: QualityPreset = QUALITY[DEFAULT_QUALITY];
  private hero: THREE.Object3D;
  private clock = new THREE.Clock();
  private elapsed = 0;
  /** หยุดลูปจริงไว้ ใช้ตอนทดสอบด้วย advance() */
  paused = false;
  fps = 0;
  /** เวลาที่ใช้วาดภาพล่าสุด (มิลลิวินาที ฝั่งเครื่อง ไม่รวมการ์ดจอ) */
  renderMs = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(private host: HTMLElement, readonly uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);

    const t0 = performance.now();
    this.terrain = new Terrain();
    const sky = new THREE.Color(0x9cc4dc);
    this.scene.background = sky;
    this.scene.fog = new THREE.FogExp2(0xb7cdd6, 0.0034);

    this.hemi = new THREE.HemisphereLight(0xcfe3f2, 0x4a4a32, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d8, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -55;
    sc.right = sc.top = 55;
    sc.near = 1;
    sc.far = 400;
    this.scene.add(this.sun, this.sun.target);

    this.terrainMesh = new TerrainMesh(this.terrain);
    this.scene.add(this.terrainMesh.group);
    this.water = new Water();
    this.scene.add(this.water.mesh);
    this.vegetation = new Vegetation(this.terrain, this.q);
    this.scene.add(this.vegetation.group);
    this.grass = new Grass(this.terrain, this.terrainMesh, this.q);
    this.scene.add(this.grass.mesh);
    this.loadMs = Math.round(performance.now() - t0);

    this.hero = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 6, 12).translate(0, 0.9, 0),
      new THREE.MeshStandardMaterial({ color: 0xd6d8d2 }),
    );
    this.hero.castShadow = true;
    this.scene.add(this.hero);

    this.player = new Player(this.terrain);
    this.player.place(SPAWN_POINT.x, SPAWN_POINT.z, SPAWN_POINT.heading);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(this.player);

    this.setQuality(DEFAULT_QUALITY);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    if (import.meta.env.DEV) (window as unknown as { __remnant: App }).__remnant = this;
  }

  /** เวลาที่ใช้สร้างโลกตอนเปิดเกม (มิลลิวินาที) */
  readonly loadMs: number;

  setQuality(level: QualityLevel): void {
    this.quality = level;
    this.q = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.sun.castShadow = this.q.shadows;
    this.sun.shadow.mapSize.set(this.q.shadowMapSize, this.q.shadowMapSize);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.terrainMesh.nearDistance = this.q.terrainNear;
    this.vegetation.setQuality(this.q);
    this.grass.setQuality(this.q);
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.measureFps(dt);
    if (!this.paused) this.update(dt);
    this.render();
  }

  /**
   * ตัวช่วยทดสอบ: เดินเวลาเกมไปตามจำนวนวินาที ทีละ 1/60 วินาที แล้ววาดภาพหนึ่งครั้ง
   * ใช้ตอนหน้าต่างโครมวาดภาพช้า (ถูกบัง) ผลจะเหมือนเล่นจริงทุกเฟรม
   */
  advance(seconds: number): void {
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) this.update(step);
    this.render();
  }

  /** ตัวช่วยทดสอบ: วาร์ปไปจุดนั้น */
  teleport(x: number, z: number, heading = this.player.heading): void {
    this.player.place(x, z, heading);
    this.rig.snap(this.player);
    this.advance(0.1);
  }

  private render(): void {
    const t = performance.now();
    this.renderer.render(this.scene, this.camera);
    this.renderMs = performance.now() - t;
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.input.setTime(this.elapsed);
    WIND.uTime.value = this.elapsed;
    this.water.update(dt);

    const inp = this.input;
    this.rig.rotate(inp.mouseDX, inp.mouseDY);
    const f = this.rig.forward();
    const r = { x: -f.z, z: f.x };
    let mx = 0;
    let mz = 0;
    if (inp.isDown('KeyW')) { mx += f.x; mz += f.z; }
    if (inp.isDown('KeyS')) { mx -= f.x; mz -= f.z; }
    if (inp.isDown('KeyD')) { mx += r.x; mz += r.z; }
    if (inp.isDown('KeyA')) { mx -= r.x; mz -= r.z; }
    this.player.update(dt, {
      x: mx,
      z: mz,
      run: inp.isDown('ShiftLeft') || inp.isDown('ShiftRight'),
      jump: inp.wasPressed('Space'),
    });

    const p = this.player;
    this.hero.position.set(p.x, p.y, p.z);
    this.hero.rotation.y = p.heading;
    this.rig.update(dt, p);
    this.terrainMesh.update(this.camera.position.x, this.camera.position.z);
    this.vegetation.update(p.x, p.z);
    this.grass.update(p.x, p.z);

    // แสงแดดกับเงาตามผู้เล่น ขยับเป็นขั้น กันเงาสั่น
    const snap = 4;
    const sx = Math.round(p.x / snap) * snap;
    const sz = Math.round(p.z / snap) * snap;
    this.sun.target.position.set(sx, p.y, sz);
    this.sun.position.set(sx + 90, p.y + 160, sz + 60);
    inp.endFrame();
  }

  private measureFps(dt: number): void {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }
}
