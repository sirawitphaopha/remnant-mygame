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
import { SHIP, SHIP_ENTER_RADIUS, SHIP_WARM_RADIUS } from '../world/layout';
import { MOVE, WORLD } from '../config/game';
import { Hud, type MapMarker } from '../ui/Hud';
import { BigMap } from '../ui/BigMap';
import { MapImage } from '../ui/MapImage';
import { armViews, beltViews } from './hudView';
import { Tools, type ScanTarget } from './Tools';
import { setLang, t, tf } from '../ui/strings';
import { kind as kindOf } from '../core/catalog';
import { ScanLog } from '../core/scanlog';
import { buildLoadout, starterChoice, type ShipChoice } from '../core/gear';
import { depositAll, dropBag, isBag, loadRatio as loadRatioOf, nestBag, pickUp, takeBag, takeFromRemains, unnestBag, type BagContents, type NestedBag } from '../core/inventory';
import { placeProps } from '../world/props';
import { Props } from '../render/Props';
import { ModelViewer } from '../render/ModelViewer';
import { droppedBagModel } from '../render/models/props';
import { InventoryScreen, ScanCard, ShipScreen, shownName } from '../ui/Screens';
import { BODY, Body, type DeathCause } from '../core/body';
import { emptyLoadout, type Slot } from '../core/gear';
import { BodyFx, DeathScreen } from '../ui/BodyFx';
import { remainsModel } from '../render/models/hero';
import { Structures } from '../world/structures';
import { buildCaves, caveAt, type Cave } from '../world/caves';
import { buildTown, type TownLayout } from '../world/town';
import { Town } from '../render/Town';
import { Caves } from '../render/Caves';
import { WorldGround } from './WorldGround';
import { disposeObject } from '../render/dispose';
import { Animals } from './Animals';
import { NatureAudio, type Surface } from '../audio/NatureAudio';
import { clearSave, readSave, readSettings, storedSavedAt, writeSave, writeSettings, SAVE_VERSION, type SaveData, type Settings } from '../storage/save';
import { SettingsScreen, TitleScreen } from '../ui/Menus';
import { forestDensity } from '../world/scatter';
import { LAKE, RIVER, RIVER_WIDTH, ROAD, ROAD_WIDTH, TOWN, distToPolyline } from '../world/layout';

/** ผูกทุกส่วนของเกมเข้าด้วยกัน และวนลูปทุกเฟรม */
/** ป้ายปุ่มของแต่ละแขน (แขนบนขวา บนซ้าย ล่างขวา ล่างซ้าย) */
const ARM_KEY_LABEL: (() => string)[] = [() => t('keyLeft'), () => t('keyRight'), () => 'Q', () => 'R'];

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
  readonly structures = new Structures();
  readonly caves: Cave[];
  readonly town: TownLayout;
  readonly cavesView: Caves;
  readonly worldGround: WorldGround;
  readonly animals: Animals;
  readonly audio = new NatureAudio();
  settings: Settings = readSettings();
  readonly title: TitleScreen;
  readonly settingsScreen: SettingsScreen;
  /** กดเล่นแล้วหรือยัง (ยังอยู่หน้าเริ่มเกม = false) */
  started = false;
  /** โลกในหน่วยความจำเป็นเกมที่กำลังเล่นอยู่แล้ว (โหลดจากบันทึกหรือกดเล่นไปแล้ว) ห้ามโหลดทับซ้ำ */
  private live = false;
  /** หน้ายานที่เปิดอยู่มาจากการเกิดใหม่ (Esc = ออกเดินทาง) */
  private respawnShip = false;
  /** เวลาบันทึกล่าสุดที่แท็บนี้รู้ (ของตัวเองหรือที่โหลดมา) ไว้จับว่าแท็บอื่นเขียนทับ */
  private lastSavedAt = 0;
  /** มีเกมเปิดอยู่อีกแท็บ แท็บนี้หยุดบันทึก */
  private saveBlocked = false;
  /** เตือนว่าบันทึกไม่ได้ไปแล้ว (เตือนครั้งเดียว) */
  private saveWarned = false;
  private saveTimer = 0;
  private titleOrbit = 0;
  private lastStep = 0;
  /** อยู่ลึกในถ้ำแค่ไหน 0 = ข้างนอก 1 = ปลายถ้ำ (หรี่แสงแดดกับแสงฟ้า) */
  caveDepth = 0;
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

    this.caves = buildCaves(this.terrain);
    this.town = buildTown(this.terrain, this.structures);
    this.scene.add(new Town(this.town.buildings, this.town.bridge).group);
    this.cavesView = new Caves(this.caves);
    this.scene.add(this.cavesView.group);
    this.cavesView.cutTerrain(this.terrainMesh.material);
    this.worldGround = new WorldGround(this.terrain, this.structures, this.caves);
    this.gasAt = (x, y, z) => {
      const c = caveAt(this.caves, x, z);
      return !!c && c.f >= c.cave.gasFrom && y < c.floor + 4;
    };
    this.shelterAt = (x, y, z) => this.structures.roofOver(x, y, z) || (!!caveAt(this.caves, x, z) && y < this.terrain.heightAt(x, z) - 2);
    this.animals = new Animals(this.terrain);
    this.scene.add(this.animals.group);
    // โดนรุมก็โดนตีได้ทีละครั้ง เว้น 1.5 วินาที มีเวลาหนีหรือยิงหมึก
    let lastHit = -99;
    this.animals.onAttack = () => {
      if (this.elapsed - lastHit < 1.5) return;
      lastHit = this.elapsed;
      this.body.hit();
      this.audio.hurt();
      if (!this.body.dead) this.hud.toast(`${t('attacked')} · ${t('sealWithGlue')}`, 'danger');
    };
    this.player = new Player(this.worldGround, this.colliders);
    this.player.place(SPAWN_POINT.x, SPAWN_POINT.z, SPAWN_POINT.heading);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(this.player);

    this.props = new Props(placeProps(), (x, z) => this.terrain.heightAt(x, z), this.colliders, { x: SHIP.x, z: SHIP.z, y: this.terrain.heightAt(SHIP.x, SHIP.z) });
    this.scene.add(this.props.group);
    this.mapImage = new MapImage(this.terrain);
    this.mapImage.drawBoxes(this.structures.boxes);
    this.hud = new Hud(uiRoot, this.mapImage, this.explore);
    this.bigMap = new BigMap(uiRoot, this.mapImage, this.explore);
    this.bigMap.onClose = () => this.toggleMap(false);
    this.scanCard = new ScanCard(uiRoot);
    this.inventory = new InventoryScreen(uiRoot, this.viewer, {
      equip: (slot, arm) => equipToArm(this.loadout, slot, arm),
      dropBag: (slot) => this.dropBagAt(slot),
      nestBag: (slot) => {
        // ลองทุกใบ ใบแรกที่รับน้ำหนักไหวชนะ (เดิมเลือกใบแรกที่เจอเสมอ ใส่ไม่ได้ก็เงียบ)
        for (let into = 0; into < this.loadout.belt.length; into++) {
          const x = this.loadout.belt[into];
          if (into !== slot && x?.kind === 'gear' && x.id === 'bag' && nestBag(this.loadout, slot, into)) return;
        }
        this.hud.toast(t('nestFailed'), 'warn');
      },
      unnestBag: (slot, i) => { if (!unnestBag(this.loadout, slot, i)) this.hud.toast(t('unnestFailed'), 'warn'); },
      close: () => this.closeScreens(),
    });
    this.shipScreen = new ShipScreen(uiRoot, { depart: (c) => this.depart(c) });
    this.bodyFx = new BodyFx(uiRoot);
    this.deathScreen = new DeathScreen(uiRoot);
    this.settingsScreen = new SettingsScreen(uiRoot, {
      change: (s) => this.applySettings(s),
      resume: () => {
        this.settingsScreen.hide();
        if (this.started) this.input.lock();
      },
      toTitle: () => this.toTitle(),
    });
    this.title = new TitleScreen(uiRoot, {
      continueGame: () => this.continueGame(),
      newGame: () => this.newGame(),
      openCollection: () => this.inventory.show('collection', { loadout: this.loadout, log: this.scanLog, body: this.bodyView(), viewOnly: true }),
      openSettings: () => this.settingsScreen.show(this.settings, true),
      quit: () => this.save(),
    });
    this.tools = new Tools({
      scene: this.scene,
      hero: this.hero,
      get loadout() { return app.loadout; },
      groundAt: (x, z, y) => this.worldGround.groundAt(x, z, y),
      toast: (text, kind = '') => this.hud.toast(text, kind),
      findScanTarget: (o, d) => this.findScanTarget(o, d),
      onScanned: (target) => this.onScanned(target),
      sealCrack: () => this.body.seal(),
      // บนบกที่กำลังเติมเองอยู่ ไม่ต้องเปิดถัง (กันเสียถังทั้งใบเพื่อได้ไม่กี่เปอร์เซ็นต์)
      refillOxygen: () => (this.body.draining || this.body.oxygen < 0.9) && this.body.refill(),
      onInk: (x, y, z) => { this.animals.ink(x, y, z); },
      // แดดถึงตัวจริง: กลางวัน ไม่อยู่ในถ้ำ ไม่อยู่ใต้หลังคา
      sunlit: () => this.skyState.sunHeight > 0.05 && this.caveDepth < 0.05 && !this.shelterAt(this.player.x, this.player.y, this.player.z),
      sound: (n) => (n === 'ink' ? this.audio.inkShot() : n === 'glue' ? this.audio.glue() : this.audio.click()),
    });

    // เปิดเสียงหลังคนกดปุ่มหรือคลิกครั้งแรก (กฎเบราว์เซอร์)
    const wake = () => this.audio.start();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);

    // จำนวนชิ้นที่มีอยู่จริงต่อชนิด ชนิดที่มีไม่ถึง 3 ชิ้น (รถเมล์ สะพาน ภาพวาด) ปลดความจริงได้เมื่อสแกนครบทุกชิ้นที่มี
    const counts: Record<string, number> = {};
    const add = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };
    for (const pp of this.props.all) add(pp.prop.kind);
    for (let i = 0; i < this.town.buildings.length; i++) add('building');
    for (const sc of this.cavesView.scannables) add(sc.kind);
    if (this.town.bridge.length) add('bridge');
    this.scanLog.setAvailable(counts);

    this.setQuality(DEFAULT_QUALITY);
    this.applySettings(this.settings);
    // หลุดจากการล็อกเมาส์ระหว่างเล่น (กด Esc) = หยุดเกม
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.started && !this.dying && !this.anyScreenOpen()) this.settingsScreen.show(this.settings, false);
    });
    const autosave = () => { if (this.started && !this.dying) this.save(); };
    window.addEventListener('beforeunload', autosave);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) autosave();
      this.audio.pause(document.hidden);
    });
    // มาจากปุ่มเริ่มสำรวจใหม่ (ล้างบันทึกแล้วเปิดใหม่) = เริ่มเล่นทันที
    let autostart = false;
    try { autostart = sessionStorage.getItem('remnant.autostart') === '1'; sessionStorage.removeItem('remnant.autostart'); } catch { /* ไม่เป็นไร */ }
    if (autostart) this.startPlaying();
    else this.showTitle();
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

  /** มีหน้าจอไหนเปิดทับเกมอยู่ไหม */
  private anyScreenOpen(): boolean {
    return this.inventory.open || this.shipScreen.open || this.bigMap.open || this.settingsScreen.open || this.title.open;
  }

  /** หน้าเริ่มเกมหรือหยุดเกม: โลกยังสวยอยู่ข้างหลัง ฟ้าเดินเวลาช้า ๆ กล้องหมุนรอบยาน */
  private updateIdle(dt: number): void {
    WIND.uTime.value = this.elapsed;
    this.water.update(dt);
    if (!this.started) {
      this.titleOrbit += dt * 0.04;
      const cx = SHIP.x + 18;
      const cz = SHIP.z - 30;
      this.camera.position.set(cx + Math.cos(this.titleOrbit) * 30, this.terrain.heightAt(cx, cz) + 9, cz + Math.sin(this.titleOrbit) * 30);
      this.camera.lookAt(SHIP.x - 60, this.terrain.heightAt(SHIP.x, SHIP.z) + 14, SHIP.z - 120);
      this.terrainMesh.update(this.camera.position.x, this.camera.position.z);
      this.vegetation.update(this.camera.position.x, this.camera.position.z);
      this.grass.update(this.camera.position.x, this.camera.position.z);
    }
    this.sky.update(this.skyState, this.elapsed, this.camera, this.sun, this.hemi, this.fog);
    const d = this.skyState.sun;
    this.sun.position.set(this.camera.position.x + d[0] * 180, this.camera.position.y + Math.max(0.05, d[1]) * 180, this.camera.position.z + d[2] * 180);
    this.sun.target.position.copy(this.camera.position);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (s.quality !== this.quality) this.setQuality(s.quality);
    setLang(s.lang);
    // ชื่อแท็บก็ภาษาเดียวกับในเกม
    document.title = t('gameTitle');
    this.audio.natureVolume = s.nature;
    this.audio.gearVolume = s.gear;
    this.sky.fogScale = 1.6 - s.viewDistance;
    writeSettings(s);
  }

  private showTitle(): void {
    const found = () => [...this.scanLog.records.values()].filter((r) => r.seen.length || r.deposited).length;
    this.hud.root.hidden = true;
    this.scanCard.root.hidden = true;
    this.bodyFx.hide();
    this.audio.idle();
    // กลับจากเกมที่เล่นอยู่ = โลกในหน่วยความจำคือของจริงล่าสุด (บันทึกในเครื่องอาจเขียนไม่สำเร็จ) ไม่อ่านมาทับ
    if (this.live) {
      this.title.show({ body: this.bodyNumber, day: Math.floor(this.gameTime / DAY_SECONDS) + 1, found: found() });
      return;
    }
    const d = readSave();
    // ให้หน้าเริ่มเกมเป็นช่วงแดดเย็นแบบในมอคอัป
    this.gameTime = d ? d.gameTime : (17.6 / 24) * DAY_SECONDS;
    this.skyState = skyAt(this.gameTime);
    if (d) this.scanLog.load(d.scanLog);
    this.title.show(d ? { body: d.bodyNumber, day: Math.floor(d.gameTime / DAY_SECONDS) + 1, found: found() } : null);
  }

  private startPlaying(): void {
    this.started = true;
    this.live = true;
    this.title.hide();
    this.closeScreens();
    this.hud.root.hidden = false;
    this.rig.snap(this.player);
    this.audio.start();
    this.input.lock();
  }

  private continueGame(): void {
    const d = readSave();
    if (d && !this.live) this.restore(d);
    this.startPlaying();
  }

  private newGame(): void {
    // มีของเก่าค้างในหน่วยความจำ (หน้าแรกโหลดบันทึกสแกนมานับ หรือเล่นไปแล้ว) ต้องเปิดหน้าใหม่ให้โลกสะอาด
    const hadSave = readSave() !== null;
    clearSave();
    if (hadSave || this.live) {
      try { sessionStorage.setItem('remnant.autostart', '1'); } catch { /* ไม่เป็นไร */ }
      location.reload();
      return;
    }
    this.gameTime = START_TIME * DAY_SECONDS;
    this.startPlaying();
  }

  private toTitle(): void {
    this.save();
    this.settingsScreen.hide();
    this.started = false;
    this.input.unlock();
    this.showTitle();
  }

  /** บันทึกความคืบหน้าทั้งหมดลงเบราว์เซอร์ */
  save(over: Partial<SaveData> = {}): boolean {
    // ยังอยู่หน้าแรกและยังไม่ได้กดเล่น โลกในเครื่องยังเปล่า บันทึกตอนนี้จะทับของเดิมทิ้ง
    if (!this.live || this.saveBlocked) return false;
    // ร่างที่โหลแตกแล้วแต่ยังไม่เข้าจอตาย ห้ามบันทึก (โหลดกลับมาจะเดินได้ทั้งที่ร้าวครบ) · ยกเว้นบันทึกสภาพหลังตายที่ startDeath ส่งมา
    if (this.body.dead && !over.player) return false;
    // แท็บอื่นเขียนบันทึกใหม่กว่าที่แท็บนี้รู้ = มีเกมเปิดอยู่อีกแท็บ หยุดบันทึกจากแท็บนี้ ไม่ให้ของเก่าทับของใหม่
    const stored = storedSavedAt();
    if (stored > this.lastSavedAt + 1) {
      this.saveBlocked = true;
      this.hud.toast(t('otherTab'), 'danger', 8);
      return false;
    }
    const p = this.player;
    const d: SaveData = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      gameTime: this.gameTime,
      bodyNumber: this.bodyNumber,
      player: { x: p.x, z: p.z, heading: p.heading, y: p.y },
      loadout: this.loadout,
      shipChoice: this.shipChoice,
      scanLog: this.scanLog.serialize(),
      explore: this.explore.serialize(),
      takenProps: this.props.all.filter((x) => x.taken).map((x) => x.prop.key),
      corpses: this.corpses.map((c) => ({ n: c.n, x: c.x, z: c.z, y: c.y, slots: c.slots })),
      droppedBags: this.droppedBags.map((b) => ({ x: b.x, z: b.z, y: b.y, bag: b.bag, beacon: b.beacon })),
      body: { oxygen: this.body.oxygen, cracks: this.body.cracks, warmth: this.body.warmth },
      ...over,
    };
    const ok = writeSave(d);
    if (ok) this.lastSavedAt = d.savedAt;
    else if (!this.saveWarned) {
      this.saveWarned = true;
      this.hud.toast(t('saveFailed'), 'danger', 8);
    }
    return ok;
  }

  /** โหลดความคืบหน้าที่บันทึกไว้ */
  restore(d: SaveData): void {
    // ล้างซากกับกระเป๋าที่อยู่ในโลกก่อน (กันของงอกซ้ำ)
    for (const c of this.corpses) disposeObject(c.object);
    for (const b of this.droppedBags) disposeObject(b.object);
    this.corpses.length = 0;
    this.droppedBags.length = 0;
    this.lastSavedAt = d.savedAt;
    this.gameTime = d.gameTime;
    this.bodyNumber = d.bodyNumber;
    this.loadout = { belt: d.loadout.belt.slice(0, 9), arms: d.loadout.arms.slice(0, 4) };
    while (this.loadout.belt.length < 9) this.loadout.belt.push(null);
    this.shipChoice = d.shipChoice;
    this.scanLog.load(d.scanLog);
    this.explore.load(d.explore);
    for (const k of d.takenProps) this.props.take(k);
    for (const c of d.corpses) {
      const obj = remainsModel();
      const y = c.y ?? this.terrain.heightAt(c.x, c.z);
      obj.position.set(c.x, y, c.z);
      this.scene.add(obj);
      this.corpses.push({ key: `remains-${c.n}`, n: c.n, x: c.x, y, z: c.z, slots: c.slots, object: obj });
    }
    for (const b of d.droppedBags) {
      const object = droppedBagModel();
      const y = b.y ?? this.terrain.heightAt(b.x, b.z);
      object.position.set(b.x, y, b.z);
      this.scene.add(object);
      this.droppedBags.push({ id: this.bagSeq++, x: b.x, y, z: b.z, bag: b.bag, beacon: b.beacon, object });
    }
    this.body.oxygen = Math.max(0.05, d.body.oxygen);
    // รอยร้าวครบแล้วโหลแตก บันทึกแบบนั้นไม่ควรมี ถ้ามีก็ไม่ให้เกิดร่างเดินได้ที่ร้าวครบ
    this.body.cracks = Math.min(d.body.cracks, BODY.maxCracks - 1);
    this.body.warmth = d.body.warmth;
    // ยืนในถ้ำหรือบนหลังคาตอนบันทึก โหลดกลับชั้นเดิม (บันทึกเก่าไม่มี y ใช้ชั้นบนสุดแบบเดิม)
    this.worldGround.contextY = d.player.y !== undefined ? d.player.y + 0.5 : Infinity;
    this.player.place(d.player.x, d.player.z, d.player.heading);
    this.rig.snap(this.player);
    this.live = true;
  }

  /** เสียงธรรมชาติตามที่อยู่ เวลา และฝีเท้า */
  private updateAudio(dt: number): void {
    const p = this.player;
    const waterDist = Math.min(distToPolyline(p.x, p.z, RIVER) - RIVER_WIDTH, Math.hypot(p.x - LAKE.x, p.z - LAKE.z) - LAKE.radius);
    const gust = 0.5 + 0.5 * Math.sin(this.elapsed * 0.35 + p.x * 0.013 + p.z * 0.009);
    this.audio.update(dt, {
      night: this.sky.night,
      forest: forestDensity(this.terrain, p.x, p.z),
      waterDist: Math.max(0, waterDist),
      cave: this.caveDepth,
      underwater: p.underwater,
      town: Math.max(0, 1 - Math.hypot(p.x - TOWN.x, p.z - TOWN.z) / (TOWN.radius * 1.3)),
      altitude: Math.max(0, p.y - 10),
      gust,
    });
    // ฝีเท้า: ทุกครึ่งรอบจังหวะก้าว
    const step = Math.floor(p.stepPhase / Math.PI);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if (p.state === 'ground' && p.speed > 0.4) {
        let surface: Surface = 'grass';
        if (this.terrain.heightAt(p.x, p.z) < 2.1 && p.y < WORLD.waterLevel + 0.6) surface = 'water';
        else if (this.caveDepth > 0.05) surface = 'cave';
        else if (p.y > this.terrain.heightAt(p.x, p.z) + 0.5) surface = 'rock';
        else if (distToPolyline(p.x, p.z, ROAD) < ROAD_WIDTH) surface = 'road';
        this.audio.step(surface, p.running);
      }
    }
  }

  /** พื้นที่กล้องใช้กันจม · อยู่ในถ้ำใช้พื้นถ้ำ */
  private camGround(x: number, z: number): number {
    const p = this.player;
    const c = caveAt(this.caves, x, z);
    if (c && p.y < this.terrain.heightAt(p.x, p.z) - 2) return c.floor;
    return this.terrain.heightAt(x, z);
  }

  /** กล้องชนผนังตึก · ในถ้ำกล้องต้องอยู่ในอุโมงค์ */
  private camBlock(a: THREE.Vector3, b: THREE.Vector3): number {
    let hit = this.structures.segment(a.x, a.y, a.z, b.x, b.y, b.z);
    const p = this.player;
    if (p.y < this.terrain.heightAt(p.x, p.z) - 2) {
      for (let i = 1; i <= 10; i++) {
        const f = i / 10;
        const x = a.x + (b.x - a.x) * f;
        const y = a.y + (b.y - a.y) * f;
        const z = a.z + (b.z - a.z) * f;
        const c = caveAt(this.caves, x, z);
        if (!c || y > c.ceil - 0.4) { hit = Math.min(hit, f - 0.1); break; }
      }
    }
    return hit;
  }

  /** ตัวช่วยทดสอบ: วาร์ปไปจุดนั้น */
  teleport(x: number, z: number, heading = this.player.heading): void {
    this.worldGround.contextY = Infinity;
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
    // ข้ามช่องที่แขนอื่นถืออยู่ ไม่อย่างนั้นของในแขนอื่นจะสลับไปมาเป็นลูกโซ่ (กด Q แล้วไม่ใช่ปืนหมึก)
    const held = new Set(this.loadout.arms.slice(1).filter((a): a is number => a !== null));
    for (let k = 1; k <= 9; k++) {
      const i = (((cur + k * Math.sign(dir)) % 9) + 9) % 9;
      if (this.loadout.belt[i] && !held.has(i)) { equipToArm(this.loadout, i); return; }
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
    for (const b of this.town.buildings) if (Math.abs(b.x - p.x) < 40 && Math.abs(b.z - p.z) < 40) test(b.key, 'building', b.x, b.y + Math.min(b.h, 6) / 2, b.z);
    for (const s of this.cavesView.scannables) if (Math.abs(s.x - p.x) < 30 && Math.abs(s.z - p.z) < 30) test(s.key, s.kind, s.x, s.y, s.z);
    for (const an of this.animals.scanTargets()) if (Math.abs(an.x - p.x) < 30 && Math.abs(an.z - p.z) < 30) test(an.key, an.kind, an.x, an.y, an.z);
    const ff = this.animals.nearestFirefly(p.x, p.z);
    if (ff) test(`firefly-${ff.i}`, 'firefly', ff.x, ff.y, ff.z);
    const bp = this.town.bridge[0];
    if (bp && Math.abs(bp.x - p.x) < 40 && Math.abs(bp.z - p.z) < 40) test('bridge-0', 'bridge', bp.x, bp.y1, bp.z);
    const found = best as ScanTarget | null;
    if (found) found.special = found.kind === 'remains' || found.kind === 'painting' || (this.props.byKey.get(found.key)?.prop.special ?? false);
    return found;
  }

  /** สแกนเสร็จ (ช่วง 6 ทำข้อความสแกน 3 ชั้น) */
  onScanned(target: ScanTarget): void {
    const r = this.scanLog.scan(target.kind, target.key, target.special);
    this.audio.scanDone();
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
    const nearShip = Math.hypot(p.x - SHIP.x, p.z - SHIP.z) < SHIP_WARM_RADIUS;
    const night = this.sky.night;
    this.body.update(dt, {
      underwater: p.underwater,
      gas: this.gasAt(p.x, p.y + MOVE.headHeight, p.z),
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
    // นับของทุกชั้น รวมกระเป๋าที่ซ้อนอยู่ข้างใน
    const countIn = (c: BagContents): number => c.items.length + c.bags.reduce((n, b) => n + countIn(b.contents), 0);
    for (const s of slots) if (isBag(s) && s.contents) items += countIn(s.contents);
    const obj = remainsModel();
    obj.position.set(p.x, this.worldGround.groundAt(p.x, p.z, p.y), p.z);
    obj.rotation.y = p.heading;
    this.scene.add(obj);
    this.corpses.push({ key: `remains-${this.bodyNumber}`, n: this.bodyNumber, x: p.x, y: obj.position.y, z: p.z, slots, object: obj });
    this.loadout = emptyLoadout();
    this.hero.root.visible = false;
    this.tools.spot.intensity = 0;
    this.input.unlock();
    this.hud.root.hidden = true;
    this.deathScreen.show(cause, this.bodyNumber, gear, items);
    this.scanCard.root.hidden = true;
    this.audio.idle();
    this.dying = { t: 0, cause };
    // บันทึกสภาพ "ตายแล้ว" ทันที (ร่างถัดไปที่จุดเกิด ของอยู่ที่ซาก) ปิดแท็บระหว่างจอตายแล้วจะไม่ฟื้นแบบไม่เคยตาย
    this.save({ bodyNumber: this.bodyNumber + 1, player: { x: SPAWN_POINT.x, z: SPAWN_POINT.z, heading: SPAWN_POINT.heading }, body: { oxygen: 1, cracks: 0, warmth: 1 } });
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
    this.worldGround.contextY = Infinity;
    this.player.place(SPAWN_POINT.x, SPAWN_POINT.z, SPAWN_POINT.heading);
    this.player.stamina.value = 100;
    this.player.stamina.exhausted = false;
    this.rig.snap(this.player);
    this.hud.toast(t('respawned'));
    this.respawnShip = true;
    this.shipScreen.show(this.shipChoice, () => t('respawned'));
  }

  closeScreens(): void {
    this.inventory.hide();
    this.shipScreen.hide();
    this.resumeControl();
  }

  /**
   * ปิดหน้าจอซ้อนแล้วกลับมาคุมกล้องได้ทันที ทุกทางที่ปิด (Esc ปุ่ม M Tab ออกเดินทาง)
   * ปลดโฟกัสปุ่มที่เพิ่งคลิก (กันเว้นวรรคไปกดปุ่มซ้ำหลังหน้าจอปิด)
   */
  private resumeControl(): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (this.started && !this.dying && !this.anyScreenOpen()) this.input.lock();
  }

  /**
   * ป้ายกดปุ่ม: ของใกล้ตัวที่เก็บได้ ซาก กระเป๋าที่วางไว้ ยาน
   * ของที่อยู่ใกล้ที่สุดชนะ (ต้องอยู่ชั้นเดียวกัน ต่างความสูงไม่เกิน 1.6 ม.) · ยานรับเฉพาะตอนไม่มีของอื่นในระยะหยิบ
   * เดิมยานถูกเช็กก่อน กระเป๋าหรือซากที่อยู่ใกล้ยานจึงหยิบคืนไม่ได้อีกเลย
   */
  private updateInteract(): void {
    const p = this.player;
    this.interact = null;
    const reach = (x: number, y: number, z: number, r: number) => {
      const d = Math.hypot(x - p.x, z - p.z);
      return d < r && Math.abs(y - p.y) < 1.6 ? d : Infinity;
    };
    let bestD = Infinity;
    for (const c of this.corpses) {
      if (!c.slots.some(Boolean)) continue;
      const d = reach(c.x, c.y, c.z, 2.2);
      if (d >= bestD) continue;
      bestD = d;
      this.interact = {
        key: 'E',
        text: t('takeFromBody'),
        run: () => {
          c.slots = takeFromRemains(this.loadout, c.slots);
          this.hud.toast(c.slots.some(Boolean) ? t('bodySomeLeft') : t('tookFromBody'));
        },
      };
    }
    for (const b of this.droppedBags) {
      const d = reach(b.x, b.y, b.z, 1.8);
      if (d >= bestD) continue;
      bestD = d;
      this.interact = {
        key: 'E',
        text: `${t('takeBag')} · G ${t('beacon')}`,
        run: () => {
          if (!takeBag(this.loadout, b.bag)) { this.hud.toast(t('bagFull'), 'warn'); return; }
          disposeObject(b.object);
          this.droppedBags.splice(this.droppedBags.indexOf(b), 1);
        },
        alt: { code: 'KeyG', run: () => { b.beacon = true; this.hud.toast(t('beaconOn')); } },
      };
    }
    for (const pp of this.props.all) {
      if (pp.taken) continue;
      const k = kindOf(pp.prop.kind);
      if (!k?.small) continue;
      const d = reach(pp.prop.x, pp.y, pp.prop.z, 2.0);
      if (d >= bestD) continue;
      bestD = d;
      const key = pp.prop.key;
      const special = !!pp.prop.special && !!k.log;
      this.interact = {
        key: 'E',
        text: `${t('pick')} ${shownName(k, this.scanLog.truth(k.id))} · ${k.kg!.toFixed(2)} ${t('kg')}`,
        run: () => {
          const r = pickUp(this.loadout, { itemId: k.id, kg: k.kg!, special });
          if (r === 'full') { this.hud.toast(t('bagFull'), 'warn'); return; }
          this.props.take(key);
          this.hud.toast(r === 'bag' ? t('pickedBag') : t('pickedHand'));
        },
      };
    }
    if (!this.interact && Math.hypot(p.x - SHIP.x, p.z - SHIP.z) < SHIP_ENTER_RADIUS) {
      this.interact = { key: 'E', text: t('enterShip'), run: () => this.enterShip() };
    }
  }

  private dropBagAt(slot: number): void {
    const bag = dropBag(this.loadout, slot);
    if (!bag) return;
    const p = this.player;
    const object = droppedBagModel();
    const x = p.x - Math.sin(p.heading) * 0.8;
    const z = p.z - Math.cos(p.heading) * 0.8;
    const y = this.worldGround.groundAt(x, z, p.y);
    object.position.set(x, y, z);
    this.scene.add(object);
    this.droppedBags.push({ id: this.bagSeq++, x, y, z, bag, beacon: false, object });
    this.hud.toast(t('bagDropped'));
  }

  enterShip(): void {
    const items = depositAll(this.loadout);
    let newLog = false;
    for (const it of items) newLog = this.scanLog.deposit(it.itemId, it.special) || newLog;
    this.save();
    this.input.unlock();
    const n = items.length;
    this.respawnShip = false;
    this.shipScreen.show(this.shipChoice, () => {
      const m = n ? tf('depositedN', { n }) : t('nothingDeposited');
      return newLog ? `${m} · ${t('logUnlocked')}` : m;
    });
  }

  private depart(c: ShipChoice): void {
    this.respawnShip = false;
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
      this.resumeControl();
    }
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.input.setTime(this.elapsed);
    this.hud.setTime(this.elapsed);
    this.input.captureTab = this.started && !this.settingsScreen.open && !this.title.open;
    if (!this.started || this.settingsScreen.open) {
      // Esc ในหน้าตั้งค่า = กลับเข้าเกม · ในคอลเลกชันที่เปิดจากหน้าเริ่มเกม Esc Tab I = ปิด (ป้ายบนปุ่มบอกไว้)
      const close = this.input.wasPressed('Escape') || this.input.wasPressed('Tab') || this.input.wasPressed('KeyI');
      if (this.settingsScreen.open && this.input.wasPressed('Escape')) { this.settingsScreen.hide(); this.resumeControl(); }
      else if (!this.started && this.inventory.open && close) this.closeScreens();
      this.updateIdle(dt);
      this.input.endFrame();
      return;
    }
    this.saveTimer += dt;
    if (this.saveTimer > 15 && !this.dying) { this.saveTimer = 0; this.save(); }
    if (this.dying) {
      this.updateDeath(dt);
      this.input.endFrame();
      return;
    }
    if (this.input.wasPressed('KeyM') && !this.inventory.open && !this.shipScreen.open) this.toggleMap();
    if ((this.input.wasPressed('Tab') || this.input.wasPressed('KeyI')) && !this.shipScreen.open && !this.bigMap.open) {
      if (this.inventory.open) { this.closeScreens(); this.input.lock(); }
      else this.openInventory('bag');
      this.input.endFrame();
      return;
    }
    if (this.inventory.open || this.shipScreen.open) {
      // หน้ายานหลังเกิดใหม่ Esc = ออกเดินทางด้วยของที่เลือกไว้ (เดิมปิดแล้วได้ร่างมือเปล่า)
      if (this.input.wasPressed('Escape') && this.shipScreen.open && this.respawnShip) this.depart(this.shipScreen.choice);
      else if (this.input.wasPressed('Escape')) this.closeScreens();
      this.input.endFrame();
      return;
    }
    if (this.bigMap.open) {
      // เปิดแผนที่อยู่ เกมหยุดเดินเวลา
      if (this.input.wasPressed('Escape')) this.toggleMap(false);
      this.input.endFrame();
      return;
    }
    // เมาส์ไม่ได้ล็อกอยู่ (กดออกนอกเกมไปแล้ว) กด Esc ก็ต้องหยุดเกมได้
    if (this.input.wasPressed('Escape')) {
      this.settingsScreen.show(this.settings, false);
      this.input.endFrame();
      return;
    }
    for (let i = 0; i < 9; i++) if (this.input.wasPressed(`Digit${i + 1}`) || this.input.wasPressed(`Numpad${i + 1}`)) equipToArm(this.loadout, i);
    if (this.input.wheel !== 0) this.cycleMainArm(this.input.wheel);
    WIND.uTime.value = this.elapsed;
    this.water.update(dt);
    this.gameTime += dt * this.timeScale;
    this.skyState = skyAt(this.gameTime);

    const inp = this.input;
    this.rig.rotate(inp.mouseDX, inp.mouseDY, 0.0008 + this.settings.sensitivity * 0.003);
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
    this.rig.update(dt, p, { heightAt: (x, z) => this.camGround(x, z), colliders: this.colliders, blockers: (a, b) => this.camBlock(a, b) }, this.aiming || this.tools.aiming, this.elapsed - inp.lastMouseMove);
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
    // ในถ้ำ แสงแดดกับแสงฟ้าค่อย ๆ หายตามความลึก เหลือไฟฉายกับเห็ดเรืองแสง
    const inCave = caveAt(this.caves, p.x, p.z);
    const under = inCave && p.y < this.terrain.heightAt(p.x, p.z) - 2 ? inCave.f : 0;
    this.caveDepth += (under - this.caveDepth) * Math.min(1, dt * 2);
    const dim = 1 - 0.96 * Math.min(1, this.caveDepth / 0.3);
    this.sun.intensity *= dim;
    this.hemi.intensity *= dim;
    this.cavesView.update(this.elapsed);
    this.animals.update(dt, p.x, p.y, p.z, this.sky.night > 0.5, this.elapsed);
    this.updateAudio(dt);
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
        ? { key: ARM_KEY_LABEL[this.tools.scanArm](), text: this.tools.scanProgress < 0 ? t('scanNothing') : `${t('scanning')} ${Math.round(this.tools.scanProgress * 100)}%` }
        : this.interact ? { key: this.interact.key, text: this.interact.text }
        // ขอล็อกเมาส์ไม่สำเร็จ บอกให้คลิกจอ (เดิมกล้องไม่หมุนเฉย ๆ ไม่มีอะไรบอก)
        : !this.input.locked && this.input.lockFailed ? { key: '', text: t('clickToPlay') } : null,
      reticle: this.aiming || this.tools.aiming,
      status: this.statusChips(),
    }, this.elapsed);
  }

  /** ป้ายสถานะค้าง: บอกสิ่งที่กำลังทำร้ายร่างกายอยู่ และวิธีแก้ */
  private statusChips(): { text: string; kind: 'warn' | 'danger' | '' }[] {
    const out: { text: string; kind: 'warn' | 'danger' | '' }[] = [];
    const p = this.player;
    const sheltered = Math.hypot(p.x - SHIP.x, p.z - SHIP.z) < SHIP_WARM_RADIUS || this.shelterAt(p.x, p.y, p.z);
    if (this.body.cracks > 0) out.push({ text: tf('crackStatus', { n: this.body.cracks }), kind: 'danger' });
    if (this.body.draining) out.push({ text: t('oxygenLow'), kind: 'danger' });
    if (this.body.warmth < 0.95 && !sheltered && this.sky.night > 0.3) out.push({ text: t('cold'), kind: 'warn' });
    else if (this.body.warmth < 0.99 && sheltered) out.push({ text: t('warmNearShip'), kind: '' });
    return out;
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
