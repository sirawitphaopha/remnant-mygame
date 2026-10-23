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
import { Tools, type ScanTarget } from './Tools';
import { t } from '../ui/strings';
import { kind as kindOf } from '../core/catalog';
import { ScanLog } from '../core/scanlog';
import { buildLoadout, starterChoice, type ShipChoice } from '../core/gear';
import { depositAll, dropBag, loadRatio as loadRatioOf, nestBag, pickUp, takeBag, takeFromRemains, unnestBag, type NestedBag } from '../core/inventory';
import { placeProps } from '../world/props';
import { Props } from '../render/Props';
import { ModelViewer } from '../render/ModelViewer';
import { droppedBagModel } from '../render/models/props';
import { InventoryScreen, ScanCard, ShipScreen, shownName } from '../ui/Screens';
import { Body, type DeathCause } from '../core/body';
import { emptyLoadout, type Slot } from '../core/gear';
import { BodyFx, DeathScreen } from '../ui/BodyFx';
import { remainsModel } from '../render/models/hero';

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
  readonly tools: Tools;
  readonly props: Props;
  readonly scanLog = new ScanLog();
  readonly scanCard: ScanCard;
  readonly viewer = new ModelViewer();
  readonly inventory: InventoryScreen;
  readonly shipScreen: ShipScreen;
  shipChoice: ShipChoice = starterChoice();
  readonly body = new Body();
  readonly bodyFx: BodyFx;
  readonly deathScreen: DeathScreen;
  /** ร่างที่เท่าไรแล้ว (ยานจำลองใหม่ทุกครั้งที่ตาย) */
  bodyNumber = 1;
  /** ซากร่างทุกร่าง · ร่างล่าสุดยังมีของ ร่างเก่าของหายแล้ว */
  readonly corpses: { key: string; n: number; x: number; y: number; z: number; slots: Slot[]; object: THREE.Object3D }[] = [];
  private dying: { t: number; cause: DeathCause } | null = null;
  private lastDrain = -99;
  /** ช่วง 8: ตรงนี้มีก๊าซพิษไหม (ถ้ำลึก) · ตรงนี้มีหลังคาไหม */
  gasAt: (x: number, y: number, z: number) => boolean = () => false;
  shelterAt: (x: number, y: number, z: number) => boolean = () => false;
  /** กระเป๋าที่วางไว้ในโลก */
  readonly droppedBags: { id: number; x: number; y: number; z: number; bag: NestedBag; beacon: boolean; object: THREE.Object3D }[] = [];
  private bagSeq = 0;
  /** ป้ายกดปุ่มตอนนี้ (เก็บของ เข้ายาน หยิบกระเป๋า) */
  private interact: { key: string; text: string; run: () => void; alt?: { code: string; run: () => void } } | null = null;
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
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const app = this;
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

    this.props = new Props(placeProps(), (x, z) => this.terrain.heightAt(x, z), this.colliders, { x: SHIP.x, z: SHIP.z, y: this.terrain.heightAt(SHIP.x, SHIP.z) });
    this.scene.add(this.props.group);
    this.mapImage = new MapImage(this.terrain);
    this.hud = new Hud(uiRoot, this.mapImage, this.explore);
    this.bigMap = new BigMap(uiRoot, this.mapImage, this.explore);
    this.bigMap.onClose = () => this.toggleMap(false);
    this.scanCard = new ScanCard(uiRoot);
    this.inventory = new InventoryScreen(uiRoot, this.viewer, {
      equip: (slot, arm) => equipToArm(this.loadout, slot, arm),
      dropBag: (slot) => this.dropBagAt(slot),
      nestBag: (slot) => {
        const into = this.loadout.belt.findIndex((x, i) => i !== slot && x?.kind === 'gear' && x.id === 'bag');
        if (into >= 0) nestBag(this.loadout, slot, into);
      },
      unnestBag: (slot, i) => unnestBag(this.loadout, slot, i),
      close: () => this.closeScreens(),
    });
    this.shipScreen = new ShipScreen(uiRoot, { depart: (c) => this.depart(c) });
    this.bodyFx = new BodyFx(uiRoot);
    this.deathScreen = new DeathScreen(uiRoot);
    this.tools = new Tools({
      scene: this.scene,
      hero: this.hero,
      get loadout() { return app.loadout; },
      heightAt: (x, z) => this.terrain.heightAt(x, z),
      toast: (text, kind = '') => this.hud.toast(text, kind),
      findScanTarget: (o, d) => this.findScanTarget(o, d),
      onScanned: (target) => this.onScanned(target),
      sealCrack: () => this.body.seal(),
      refillOxygen: () => this.body.refill(),
      onInk: () => {},
      sunlit: () => this.skyState.sunHeight > 0.05,
    });

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

  /** หมุนลูกกลิ้งเมาส์: แขนหลักถือของช่องถัดไปที่ไม่ว่าง */
  private cycleMainArm(dir: number): void {
    const cur = this.loadout.arms[0] ?? -1;
    for (let k = 1; k <= 9; k++) {
      const i = (((cur + k * Math.sign(dir)) % 9) + 9) % 9;
      if (this.loadout.belt[i]) { equipToArm(this.loadout, i); return; }
    }
  }

  /** ของที่สแกนได้ในทิศที่มอง · ช่วงนี้มีต้นไม้กับหิน (ช่วง 6 เพิ่มของมนุษย์ ช่วง 9 เพิ่มสัตว์) */
  findScanTarget(origin: THREE.Vector3, dir: THREE.Vector3): ScanTarget | null {
    let best: ScanTarget | null = null;
    let bestCos = 0.975;
    const p = this.player;
    const test = (key: string, kind: string, x: number, y: number, z: number) => {
      const dx = x - origin.x;
      const dy = y - origin.y;
      const dz = z - origin.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 28 || d < 0.5) return;
      const c = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (c > bestCos) { bestCos = c; best = { key, kind, x, y, z }; }
    };
    this.vegetation.trees.forEach((set) => set.items.forEach((it, i) => {
      if (Math.abs(it.x - p.x) < 30 && Math.abs(it.z - p.z) < 30) test(`tree-${set.kind}-${i}`, set.kind, it.x, it.y + 2.5 * it.scale, it.z);
    }));
    this.vegetation.rocks.forEach((r, i) => {
      if (Math.abs(r.x - p.x) < 30 && Math.abs(r.z - p.z) < 30) test(`rock-${i}`, 'rock', r.x, r.y + 0.4 * r.scale, r.z);
    });
    const H: Record<string, number> = { car: 1, bus: 1.6, lamp: 4, mailbox: 1, sign: 2.6 };
    for (const pp of this.props.all) {
      if (pp.taken || Math.abs(pp.prop.x - p.x) > 30 || Math.abs(pp.prop.z - p.z) > 30) continue;
      test(pp.prop.key, pp.prop.kind, pp.prop.x, pp.y + (H[pp.prop.kind] ?? 0.12), pp.prop.z);
    }
    for (const c of this.corpses) if (Math.abs(c.x - p.x) < 30 && Math.abs(c.z - p.z) < 30) test(c.key, 'remains', c.x, c.y + 0.3, c.z);
    const found = best as ScanTarget | null;
    if (found) found.special = found.kind === 'remains' || (this.props.byKey.get(found.key)?.prop.special ?? false);
    return found;
  }

  /** สแกนเสร็จ (ช่วง 6 ทำข้อความสแกน 3 ชั้น) */
  onScanned(target: ScanTarget): void {
    const r = this.scanLog.scan(target.kind, target.key, target.special);
    this.scanCard.show(target.kind, this.scanLog, r.firstTime || r.newTruth || r.newLog, this.elapsed);
    const k = kindOf(target.kind);
    this.hud.toast(`${t('scanSent')}<br><b>${k ? shownName(k, this.scanLog.truth(target.kind)) : target.kind}</b>`);
  }

  private openInventory(tab: 'bag' | 'collection'): void {
    this.input.unlock();
    this.inventory.show(tab, { loadout: this.loadout, log: this.scanLog, body: this.bodyView() });
  }

  /** สภาพร่างกาย (ช่วง 7 ผูกค่าจริง) */
  bodyView(): { cracks: number; oxygen: number; cold: boolean } {
    return { cracks: this.body.cracks, oxygen: this.body.oxygen, cold: this.body.warmth < 0.7 };
  }

  /** ร่างกาย: ตก ออกซิเจน ความหนาว และเริ่มตาย */
  private updateBody(dt: number): void {
    const p = this.player;
    if (p.lastFall > 0) {
      const add = this.body.fall(p.lastFall);
      if (add > 0 && !this.body.dead) this.hud.toast(`${t('cracked')} · ${t('sealWithGlue')}`, 'danger');
      p.lastFall = 0;
    }
    const nearShip = Math.hypot(p.x - SHIP.x, p.z - SHIP.z) < 12;
    const night = this.sky.night;
    this.body.update(dt, {
      underwater: p.underwater,
      gas: this.gasAt(p.x, p.y + 1.7, p.z),
      cold: Math.max(0, night * 1.1 - 0.1),
      shelter: nearShip || this.shelterAt(p.x, p.y, p.z),
    });
    if (this.body.draining) this.lastDrain = this.elapsed;
    this.bodyFx.update(this.body.cracks, this.body.hurt, this.body.warmth);
    // ปลาหมึกซีดลงตามรอยร้าวและออกซิเจน
    const octoMat = (this.hero.octo.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const pale = Math.min(1, this.body.cracks / 4 + (1 - this.body.oxygen) * 0.8);
    octoMat.color.setRGB(0.78 + 0.1 * pale, 0.45 + 0.35 * pale, 0.71 + 0.1 * pale);
    if (this.body.dead) this.startDeath(this.body.dead);
  }

  private startDeath(cause: DeathCause): void {
    const p = this.player;
    // ของทุกอย่างตกอยู่ที่ซาก · ซากเก่าที่ยังมีของ ของหายไป (ซากยังอยู่)
    for (const c of this.corpses) c.slots = [];
    const slots = this.loadout.belt.slice();
    const gear = slots.filter((s) => s && s.kind === 'gear').length;
    let items = slots.filter((s) => s && s.kind === 'item').length;
    for (const s of slots) if (s && s.kind === 'gear' && s.id === 'bag') items += (s as { contents?: { items: unknown[] } }).contents?.items.length ?? 0;
    const obj = remainsModel();
    obj.position.set(p.x, this.terrain.heightAt(p.x, p.z), p.z);
    obj.rotation.y = p.heading;
    this.scene.add(obj);
    this.corpses.push({ key: `remains-${this.bodyNumber}`, n: this.bodyNumber, x: p.x, y: obj.position.y, z: p.z, slots, object: obj });
    this.loadout = emptyLoadout();
    this.hero.root.visible = false;
    this.tools.spot.intensity = 0;
    this.input.unlock();
    this.hud.root.hidden = true;
    this.deathScreen.show(cause, this.bodyNumber, gear, items);
    this.dying = { t: 0, cause };
  }

  private updateDeath(dt: number): void {
    const d = this.dying!;
    d.t += dt;
    this.deathScreen.setProgress(Math.min(1, d.t / 6));
    if (d.t < 6.5) return;
    this.dying = null;
    this.deathScreen.hide();
    this.hud.root.hidden = false;
    this.bodyNumber++;
    this.body.reset();
    this.hero.root.visible = true;
    this.player.place(SPAWN_POINT.x, SPAWN_POINT.z, SPAWN_POINT.heading);
    this.player.stamina.value = 100;
    this.player.stamina.exhausted = false;
    this.rig.snap(this.player);
    this.hud.toast(t('respawned'));
    this.shipScreen.show(this.shipChoice, t('respawned'));
  }

  closeScreens(): void {
    this.inventory.hide();
    this.shipScreen.hide();
  }

  /** ป้ายกดปุ่ม: ของใกล้ตัวที่เก็บได้ ยาน กระเป๋าที่วางไว้ */
  private updateInteract(): void {
    const p = this.player;
    this.interact = null;
    if (Math.hypot(p.x - SHIP.x, p.z - SHIP.z) < 9) {
      this.interact = { key: 'E', text: t('enterShip'), run: () => this.enterShip() };
      return;
    }
    for (const c of this.corpses) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < 2.2 && c.slots.some(Boolean)) {
        this.interact = {
          key: 'E',
          text: t('takeFromBody'),
          run: () => {
            c.slots = takeFromRemains(this.loadout, c.slots);
            this.hud.toast(c.slots.some(Boolean) ? t('bodySomeLeft') : t('tookFromBody'));
          },
        };
        return;
      }
    }
    for (const b of this.droppedBags) {
      if (Math.hypot(b.x - p.x, b.z - p.z) < 1.8) {
        this.interact = {
          key: 'E',
          text: `${t('takeBag')} · G ${t('beacon')}`,
          run: () => {
            if (!takeBag(this.loadout, b.bag)) { this.hud.toast(t('bagFull'), 'warn'); return; }
            this.scene.remove(b.object);
            this.droppedBags.splice(this.droppedBags.indexOf(b), 1);
          },
          alt: { code: 'KeyG', run: () => { b.beacon = true; this.hud.toast(t('beaconOn')); } },
        };
        return;
      }
    }
    let best: { prop: { kind: string; key: string; x: number; z: number } } | null = null;
    let bd = 2.0;
    for (const pp of this.props.all) {
      if (pp.taken) continue;
      const k = kindOf(pp.prop.kind);
      if (!k?.small) continue;
      const d = Math.hypot(pp.prop.x - p.x, pp.prop.z - p.z);
      if (d < bd) { bd = d; best = pp; }
    }
    if (best) {
      const k = kindOf(best.prop.kind)!;
      const key = best.prop.key;
      this.interact = {
        key: 'E',
        text: `${t('pick')} ${shownName(k, this.scanLog.truth(k.id))} · ${k.kg!.toFixed(2)} ${t('kg')}`,
        run: () => {
          const r = pickUp(this.loadout, { itemId: k.id, kg: k.kg! });
          if (r === 'full') { this.hud.toast(t('bagFull'), 'warn'); return; }
          this.props.take(key);
          this.hud.toast(r === 'bag' ? t('pickedBag') : t('pickedHand'));
        },
      };
    }
  }

  private dropBagAt(slot: number): void {
    const bag = dropBag(this.loadout, slot);
    if (!bag) return;
    const p = this.player;
    const object = droppedBagModel();
    const x = p.x - Math.sin(p.heading) * 0.8;
    const z = p.z - Math.cos(p.heading) * 0.8;
    const y = this.terrain.heightAt(x, z);
    object.position.set(x, y, z);
    this.scene.add(object);
    this.droppedBags.push({ id: this.bagSeq++, x, y, z, bag, beacon: false, object });
    this.hud.toast(t('bagDropped'));
  }

  enterShip(): void {
    const items = depositAll(this.loadout);
    for (const it of items) this.scanLog.deposit(it.itemId);
    this.input.unlock();
    this.shipScreen.show(this.shipChoice, items.length ? `${t('depositedN')} ${items.length}` : t('nothingDeposited'));
  }

  private depart(c: ShipChoice): void {
    this.shipChoice = c;
    this.loadout = buildLoadout(c);
    this.closeScreens();
  }

  /** เครื่องหมายบนแผนที่ (ช่วง 6 และ 7 เพิ่มซาก กระเป๋า) */
  markers(): MapMarker[] {
    const last = this.corpses[this.corpses.length - 1];
    const bodies = this.corpses.map((c) => ({ kind: (c === last && c.slots.some(Boolean) ? 'death' : 'oldBody') as 'death' | 'oldBody', x: c.x, z: c.z }));
    return [{ kind: 'ship', x: SHIP.x, z: SHIP.z }, ...bodies, ...this.droppedBags.filter((b) => b.beacon).map((b) => ({ kind: 'bag' as const, x: b.x, z: b.z }))];
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
    if (this.dying) {
      this.updateDeath(dt);
      this.input.endFrame();
      return;
    }
    if (this.input.wasPressed('KeyM') && !this.inventory.open && !this.shipScreen.open) this.toggleMap();
    if ((this.input.wasPressed('Tab') || this.input.wasPressed('KeyI')) && !this.shipScreen.open && !this.bigMap.open) {
      if (this.inventory.open) this.closeScreens();
      else this.openInventory('bag');
      this.input.endFrame();
      return;
    }
    if (this.inventory.open || this.shipScreen.open) {
      if (this.input.wasPressed('Escape')) this.closeScreens();
      this.input.endFrame();
      return;
    }
    if (this.bigMap.open) {
      // เปิดแผนที่อยู่ เกมหยุดเดินเวลา
      if (this.input.wasPressed('Escape')) this.toggleMap(false);
      this.input.endFrame();
      return;
    }
    for (let i = 0; i < 9; i++) if (this.input.wasPressed(`Digit${i + 1}`)) equipToArm(this.loadout, i);
    if (this.input.wheel !== 0) this.cycleMainArm(this.input.wheel);
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
      loadRatio: loadRatioOf(this.loadout),
    });
    if (inp.wasPressed('KeyV')) this.rig.swapShoulder();
    this.updateBody(dt);
    if (this.dying) { inp.endFrame(); return; }
    this.tools.update(dt, (b) => inp.held(b), (b) => inp.pressedAny(b), this.camera.position, this.rig.viewDir());

    const p = this.player;
    this.hero.root.position.set(p.x, p.y, p.z);
    this.hero.root.rotation.y = p.heading;
    this.hero.pose(dt, p.sliding ? 'air' : p.state, p.stepPhase, p.speed, p.running, this.elapsed);
    this.rig.update(dt, p, { heightAt: (x, z) => this.terrain.heightAt(x, z), colliders: this.colliders }, this.aiming || this.tools.aiming, this.elapsed - inp.lastMouseMove);
    this.terrainMesh.update(this.camera.position.x, this.camera.position.z);
    this.vegetation.update(p.x, p.z);
    this.grass.update(p.x, p.z);

    this.explore.reveal(p.x, p.z);
    this.updateInteract();
    if (this.interact && inp.wasPressed('KeyE')) this.interact.run();
    else if (this.interact?.alt && inp.wasPressed(this.interact.alt.code)) this.interact.alt.run();
    this.scanCard.update(this.elapsed);
    for (const b of this.droppedBags) {
      const bc = b.object.getObjectByName('beacon');
      if (bc) bc.visible = b.beacon && Math.sin(this.elapsed * 4) > -0.2;
    }
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
    const name = (id: string) => {
      const k = kindOf(id);
      return k ? shownName(k, this.scanLog.truth(id)) : id;
    };
    this.hud.update({
      yaw: this.rig.yaw,
      x: p.x,
      z: p.z,
      heading: p.heading,
      stamina: p.stamina.value / 100,
      exhausted: p.stamina.exhausted,
      oxygen: this.elapsed - this.lastDrain < 3 || this.body.oxygen < 0.999 && this.body.draining ? this.body.oxygen : null,
      battery: light && light.on ? light.charge ?? 0 : null,
      arms: armViews(this.loadout, name),
      belt: beltViews(this.loadout, name),
      markers: this.markers(),
      prompt: this.tools.scanning
        ? { key: t('keyLeft'), text: this.tools.scanProgress < 0 ? t('scanNothing') : `${t('scanning')} ${Math.round(this.tools.scanProgress * 100)}%` }
        : this.interact ? { key: this.interact.key, text: this.interact.text } : null,
      reticle: this.aiming || this.tools.aiming,
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
