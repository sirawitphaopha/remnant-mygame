import * as THREE from 'three';
import { DEFAULT_QUALITY, QUALITY, type QualityLevel, type QualityPreset } from '../config/quality';
import { DAY_SECONDS, START_TIME, skyAt, type SkyState } from '../core/time';
import { SPAWN_POINT } from '../world/layout';
import { Terrain } from '../world/Terrain';
import { CircleColliders } from '../world/colliders';
import { Player } from '../player/Player';
import { CameraRig } from '../render/CameraRig';
import { HeroModel } from '../render/models/hero';
import { Sky } from '../render/Sky';
import { Grass } from '../render/Grass';
import { TerrainMesh } from '../render/TerrainMesh';
import { Vegetation } from '../render/Vegetation';
import { Water } from '../render/Water';
import { WIND } from '../render/wind';
import { Input } from './Input';
import { ExploreMap } from '../core/explore';
import { findGear, holding, equipToArm, starterPack, type Loadout } from '../core/gear';
import { SHIP } from '../world/layout';
import { Hud, type MapMarker } from '../ui/Hud';
import { BigMap } from '../ui/BigMap';
import { MapImage } from '../ui/MapImage';
import { armViews, beltViews } from './hudView';

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
  readonly sky = new Sky();
  readonly fog = new THREE.FogExp2(0xb7cdd6, 0.0034);
  /** เวลาในเกม วินาทีนับจาก 00:00 ของวันแรก */
  gameTime = START_TIME * DAY_SECONDS;
  /** ตัวคูณความเร็วเวลา (ทดสอบเท่านั้น) */
  timeScale = 1;
  skyState: SkyState = skyAt(this.gameTime);
  quality: QualityLevel = DEFAULT_QUALITY;
  private q: QualityPreset = QUALITY[DEFAULT_QUALITY];
  readonly hero = new HeroModel();
  readonly colliders = new CircleColliders();
  /** ของที่พกอยู่ แถบล่าง 9 ช่อง และแขน 4 ข้าง */
  loadout: Loadout = starterPack();
  readonly explore = new ExploreMap();
  readonly mapImage: MapImage;
  readonly hud: Hud;
  readonly bigMap: BigMap;
  /** กำลังเล็งหรือสแกน (กล้องซูมชิดไหล่) */
  aiming = false;
  /** น้ำหนักที่แบก ÷ ที่รับได้ (ช่วง 6 ผูกกับกระเป๋า) */
  loadRatio = 0;
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
    this.scene.fog = this.fog;
    this.scene.add(this.sky.mesh);

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

    this.scene.add(this.hero.root);
    // ลำต้นไม้กับก้อนหินเป็นสิ่งกีดขวาง
    for (const set of this.vegetation.trees) {
      const r = set.kind === 'oak' ? 0.42 : set.kind === 'dead' ? 0.32 : set.kind === 'pine' ? 0.3 : 0.2;
      for (const t of set.items) this.colliders.add({ x: t.x, z: t.z, r: r * t.scale, top: 8 });
    }
    for (const r of this.vegetation.rocks) this.colliders.add({ x: r.x, z: r.z, r: 1.05 * r.scale, top: 0.75 * r.scale });

    this.player = new Player(this.terrain, this.colliders);
    this.player.place(SPAWN_POINT.x, SPAWN_POINT.z, SPAWN_POINT.heading);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(this.player);

    this.mapImage = new MapImage(this.terrain);
    this.hud = new Hud(uiRoot, this.mapImage, this.explore);
    this.bigMap = new BigMap(uiRoot, this.mapImage, this.explore);
    this.bigMap.onClose = () => this.toggleMap(false);

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

  /** ตัวช่วยทดสอบ: ตั้งเวลา (ชั่วโมง 0 ถึง 24) ของวันที่เท่านั้น */
  setClock(hour: number, day = Math.floor(this.gameTime / DAY_SECONDS)): void {
    this.gameTime = (day + hour / 24) * DAY_SECONDS;
    this.advance(0.05);
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

  /** เครื่องหมายบนแผนที่ (ช่วง 6 และ 7 เพิ่มซาก กระเป๋า) */
  markers(): MapMarker[] {
    return [{ kind: 'ship', x: SHIP.x, z: SHIP.z }];
  }

  toggleMap(open = !this.bigMap.open): void {
    if (open) {
      this.bigMap.show(this.player.x, this.player.z, this.player.heading, this.markers());
      this.input.unlock();
    } else {
      this.bigMap.hide();
    }
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.input.setTime(this.elapsed);
    if (this.input.wasPressed('KeyM')) this.toggleMap();
    if (this.bigMap.open) {
      // เปิดแผนที่อยู่ เกมหยุดเดินเวลา
      if (this.input.wasPressed('Escape')) this.toggleMap(false);
      this.input.endFrame();
      return;
    }
    for (let i = 0; i < 9; i++) if (this.input.wasPressed(`Digit${i + 1}`)) equipToArm(this.loadout, i);
    WIND.uTime.value = this.elapsed;
    this.water.update(dt);
    this.gameTime += dt * this.timeScale;
    this.skyState = skyAt(this.gameTime);

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
      climbGear: holding(this.loadout, 'climber') !== null,
      loadRatio: this.loadRatio,
    });
    if (inp.wasPressed('KeyV')) this.rig.swapShoulder();

    const p = this.player;
    this.hero.root.position.set(p.x, p.y, p.z);
    this.hero.root.rotation.y = p.heading;
    this.hero.pose(dt, p.sliding ? 'air' : p.state, p.stepPhase, p.speed, p.running, this.elapsed);
    this.rig.update(dt, p, { heightAt: (x, z) => this.terrain.heightAt(x, z), colliders: this.colliders }, this.aiming, this.elapsed - inp.lastMouseMove);
    this.terrainMesh.update(this.camera.position.x, this.camera.position.z);
    this.vegetation.update(p.x, p.z);
    this.grass.update(p.x, p.z);

    this.explore.reveal(p.x, p.z);
    this.updateHud();
    this.sky.update(this.skyState, this.elapsed, this.camera, this.sun, this.hemi, this.fog);
    // แสงแดดหรือแสงจันทร์กับเงาตามผู้เล่น ขยับเป็นขั้น กันเงาสั่น
    const snap = 4;
    const sx = Math.round(p.x / snap) * snap;
    const sz = Math.round(p.z / snap) * snap;
    const d = (this.sun.userData.dir as [number, number, number] | undefined) ?? this.skyState.sun;
    this.sun.target.position.set(sx, p.y, sz);
    this.sun.position.set(sx + d[0] * 180, p.y + Math.max(0.05, d[1]) * 180, sz + d[2] * 180);
    const wu = this.water.uniforms;
    wu.uSunDir.value.set(d[0], d[1], d[2]);
    wu.uSunColor.value.copy(this.sun.color).multiplyScalar(Math.min(1, this.sun.intensity / 2));
    wu.uSkyColor.value.copy(this.sky.horizon);
    wu.uLight.value = 0.04 + 0.96 * this.sky.brightness;
    inp.endFrame();
  }

  private updateHud(): void {
    const p = this.player;
    const light = findGear(this.loadout, 'flashlight');
    const name = (id: string) => id;
    this.hud.update({
      yaw: this.rig.yaw,
      x: p.x,
      z: p.z,
      heading: p.heading,
      stamina: p.stamina.value / 100,
      exhausted: p.stamina.exhausted,
      oxygen: null,
      battery: light && light.on ? light.charge ?? 0 : null,
      arms: armViews(this.loadout, name),
      belt: beltViews(this.loadout, name),
      markers: this.markers(),
      prompt: null,
      reticle: this.aiming,
    }, this.elapsed);
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
