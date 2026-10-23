import * as THREE from 'three';
import { disposeObject } from '../render/dispose';
import { WORLD } from '../config/game';
import { ATTACK_COOLDOWN, ATTACK_RANGE, SPECIES_BY_ID, chaseWant, currentSpeed, inkHit, type Species } from '../core/animals';
import { ECO, ECO_BY_ID, FOOD, dayPart, fleeDir, groupsWanted, herdSize, newEcoMind, outOfView, pickStraggler, think, type DayPart, type Eco, type EcoMind, type Sense } from '../core/ecology';
import { animalModel, type AnimalModel, type Pose } from '../render/models/animals';
import { caveAt, type Cave } from '../world/caves';
import type { CircleColliders } from '../world/colliders';
import { biomeSet, drinkSpot, habitatFits, nearestBiome, type WildZones } from '../world/habitat';
import type { P2 } from '../world/layout';
import type { PointGrid } from '../world/pointGrid';
import type { Structures } from '../world/structures';
import type { BiomeId } from '../world/terrainGen';
import type { Terrain } from '../world/Terrain';
import { trunkRadius } from '../world/trees';

/** ต้นไม้หนึ่งต้นในตารางค้นหา (กระรอกปีน หมีกินลูกไม้ เป้าสแกน) */
export interface TreePoint { x: number; y: number; z: number; kind: string; height: number }

/** ของในโลกที่สัตว์ต้องรู้ */
export interface AnimalWorld {
  terrain: Terrain;
  colliders: CircleColliders;
  structures: Structures;
  caves: Cave[];
  wild: WildZones;
  trees: PointGrid<TreePoint>;
}

/** ข้อมูลต่อเฟรม (App เก็บวัตถุเดียวแล้วแก้ค่า ไม่สร้างใหม่ทุกเฟรม) */
export interface AnimalFrame {
  dt: number;
  px: number;
  py: number;
  pz: number;
  /** ผู้เล่นอยู่ระดับพื้นดิน (ไม่อยู่ในถ้ำ ไม่อยู่บนหลังคา) สัตว์ไล่ถึง */
  reach: boolean;
  timeOfDay: number;
  rain: number;
  time: number;
  /** ทิศกล้องตามแนวนอน (หนึ่งหน่วย) ไว้เกิดและหายนอกสายตา */
  fx: number;
  fz: number;
}

interface Herd {
  id: number;
  s: Species;
  e: Eco;
  members: Animal[];
  /** ที่อยู่ของฝูง (ย้ายเมื่อหลบเข้าที่พักแล้ว) */
  hx: number;
  hz: number;
  /** เป้าเดินของฝูง */
  tx: number;
  tz: number;
  retarget: number;
  /** ที่หลบพักที่หาไว้ */
  restGoal: P2 | null;
  /** เหยื่อที่ฝูงหมาป่ากำลังล่า */
  prey: Animal | null;
  /** ต้นไม้ที่อาศัย (กระรอก) */
  tree: TreePoint | null;
}

interface Animal {
  id: number;
  s: Species;
  e: Eco;
  herd: Herd;
  /** ลำดับในฝูง (ตัวแรกของฝูงกวางคอยเงยหน้าระวังภัย) */
  slot: number;
  model: AnimalModel;
  mind: EcoMind;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  alt: number;
  pose: Pose;
  /** หลบสิ่งกีดขวาง: เหลือกี่วินาที เลี้ยวไปทางไหน */
  avoid: number;
  avoidDir: number;
  /** จุดหมายของงานตอนนี้ (ที่กินน้ำ ต้นผลไม้) · งานที่หาไว้ */
  goal: P2 | null;
  goalTask: string;
  /** ต้นลูกไม้ที่หมีจะไปกิน (หาใหม่ทุก 10 วินาที) */
  food: P2 | null;
  foodTimer: number;
  /** ตะครุบพลาดแล้วรอ · เหยื่อดิ้นหลุดแล้ววิ่งเร็วขึ้นชั่วคราว */
  catchCd: number;
  boost: number;
  /** ตำแหน่งสิ่งที่หนี */
  thx: number;
  thz: number;
  /** กระรอก: ความสูงบนลำต้น · สถานะ */
  climb: number;
  climbState: 'ground' | 'up' | 'top' | 'down';
  climbTimer: number;
  /** กบ: ดำน้ำหลบอยู่ */
  hidden: number;
  /** อีกาลงเกาะพื้นแล้ว */
  landed: boolean;
  /** เวลาที่ยังไม่ได้คิด (สัตว์ไกลคิดทุก 3 เฟรม) */
  acc: number;
  /** ความแข็งแรง 0.8 ถึง 1 (ตัวอ่อนแอหรือลูกวิ่งช้ากว่า หลุดท้ายฝูง หมาป่าเลือกตัวนี้) */
  vigor: number;
}

interface Carcass {
  key: string;
  s: Species;
  model: AnimalModel;
  x: number;
  y: number;
  z: number;
  heading: number;
  age: number;
  /** เนื้อเหลือ 0 ถึง 1 · หมดแล้วเหลือแต่ซาก */
  meat: number;
}

const FIRE_COUNT = 40;
/** สัตว์ที่ระบบนี้ดูแล (นกกิ้งโครง ผีเสื้อ ผึ้ง อยู่ใน render/Flock.ts กับ render/Insects.ts · ปลาอยู่ใน render/Fish.ts) */
const MANAGED = ['deer', 'rabbit', 'fox', 'crow', 'eagle', 'frog', 'owl', 'wolf', 'bear', 'squirrel'];
/** ต้นที่หมีกินลูก (ลูกโอ๊ก นัทบีช มะม่วง แอปเปิล เชอร์รี) · REFERENCES-R2 หัวข้อ 8 */
const FOOD_TREES = new Set(['oak', 'beech', 'mango', 'apple', 'cherry']);
/** ต้นที่กระรอกอาศัย (ป่าสนกับป่าผสม) */
const SQUIRREL_TREES = new Set(['scotsPine', 'spruce', 'fir', 'redwood', 'oak', 'beech', 'maple', 'birch']);
const SPAWN_NEAR = 75;
const SPAWN_FAR = 150;
const DESPAWN = 230;
/** ไม่ยืนบนพื้นที่ชันกว่านี้ (เวกเตอร์ตั้งฉาก y เท่ากับผู้เล่น) */
const WALKABLE_NY = 0.72;

/**
 * สัตว์รอบตัวผู้เล่นตามระบบนิเวศ (รอบสอง ช่วง 12)
 * เกิดเป็นฝูงในถิ่นของมันนอกสายตา หายเมื่อไกลหรือนอกสายตา · ออกหากินตามเวลา หลบฝน ลงกินน้ำ
 * หมาป่าล่ากวางกับกระต่าย ล่าได้แล้วกินทิ้งซาก อีกามารุม · จิ้งจอกล่ากระต่าย · หมีกินลูกไม้และจับปลาที่น้ำตก · กระรอกวิ่งขึ้นต้นไม้
 * สัตว์บกชนต้นไม้ หิน ตึก ไม่ขึ้นหน้าผาชัน ไม่เข้าถ้ำ (รายงานตรวจข้อ 98 ถึง 102 · 128)
 */
export class Animals {
  readonly group = new THREE.Group();
  readonly list: Animal[] = [];
  readonly herds: Herd[] = [];
  readonly carcasses: Carcass[] = [];
  private seq = 0;
  private herdSeq = 0;
  /** ต่อหน้ารหัสสัตว์ ให้ตัวที่เกิดหลังเปิดเกมใหม่ไม่ซ้ำกับตัวที่เคยสแกน */
  private readonly tag = Math.floor(Math.random() * 36 ** 4).toString(36);
  private fireflies: THREE.Points;
  private firePos: Float32Array;
  private fireSeed: Float32Array;
  private feedSets = new Map<string, Set<BiomeId>>();
  private restSets = new Map<string, Set<BiomeId>>();
  private herdCount = new Map<string, number>();
  private popTimer = 0;
  private frame = 0;
  private iter: Animal[] = [];
  /** เกิดฝูงใหม่เองตามถิ่น (เทสปิดไว้แล้ววางสัตว์เอง) */
  spawning = true;
  /** โดนสัตว์ตี (ส่งไปทำโหลร้าว) */
  onAttack: (speciesId: string) => void = () => {};

  constructor(private w: AnimalWorld) {
    for (const e of ECO) {
      this.feedSets.set(e.id, biomeSet(e.feed));
      if (e.rest) this.restSets.set(e.id, biomeSet(e.rest));
    }
    this.firePos = new Float32Array(FIRE_COUNT * 3);
    this.fireSeed = new Float32Array(FIRE_COUNT);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.firePos, 3));
    this.fireflies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.12, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
  }

  private get t(): Terrain { return this.w.terrain; }

  // ================= เกิด หาย =================

  /** ช่วงนี้ชนิดนี้ควรอยู่ที่พัก (ไม่ใช่ที่หากิน) */
  private restTime(e: Eco, part: DayPart, rain: number): boolean {
    if (!e.rest) return false;
    return (rain > 0.4 && e.shelter) || e.activity[part] < 0.4 || (!!e.feedAt && !e.feedAt.includes(part));
  }

  private makeAnimal(s: Species, e: Eco, herd: Herd, slot: number, x: number, z: number): Animal {
    const model = animalModel(s.id);
    this.group.add(model.root);
    const air = s.move === 'fly';
    const alt = !air ? 0 : s.id === 'eagle' ? 45 + Math.random() * 20 : s.id === 'owl' ? 6 + Math.random() * 7 : 8 + Math.random() * 10;
    const a: Animal = {
      id: this.seq++, s, e, herd, slot, model, mind: newEcoMind(0.2 + Math.random() * 0.7, Math.random() * 0.8),
      x, y: this.t.heightAt(x, z), z, heading: Math.random() * 6.28, speed: 0, alt, pose: 'walk',
      avoid: 0, avoidDir: 1, goal: null, goalTask: '', food: null, foodTimer: 0, catchCd: 0, boost: 0, thx: x, thz: z,
      climb: 0, climbState: 'ground', climbTimer: 0, hidden: 0, landed: false, acc: 0,
      vigor: slot >= 3 ? 0.8 + Math.random() * 0.06 : 0.86 + Math.random() * 0.14,
    };
    if (air) a.y += alt;
    this.list.push(a);
    herd.members.push(a);
    return a;
  }

  private newHerd(s: Species, e: Eco, x: number, z: number): Herd {
    const h: Herd = { id: this.herdSeq++, s, e, members: [], hx: x, hz: z, tx: x, tz: z, retarget: 0, restGoal: null, prey: null, tree: null };
    this.herds.push(h);
    this.herdCount.set(s.id, (this.herdCount.get(s.id) ?? 0) + 1);
    return h;
  }

  private spawnHerd(e: Eco, f: AnimalFrame, part: DayPart): void {
    const s = SPECIES_BY_ID.get(e.id)!;
    const set = this.restTime(e, part, f.rain) ? this.restSets.get(e.id)! : this.feedSets.get(e.id)!;
    for (let tries = 0; tries < 10; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const d = SPAWN_NEAR + Math.random() * (SPAWN_FAR - SPAWN_NEAR);
      const x = f.px + Math.cos(ang) * d;
      const z = f.pz + Math.sin(ang) * d;
      if (!outOfView(x - f.px, z - f.pz, f.fx, f.fz) || !habitatFits(this.t, set, x, z, this.w.wild, e) || caveAt(this.w.caves, x, z, 4)) continue;
      let tree: TreePoint | null = null;
      if (e.id === 'squirrel') {
        tree = this.w.trees.nearest(x, z, 14, (tp) => SQUIRREL_TREES.has(tp.kind) && tp.height > 9);
        if (!tree) continue;
      }
      const herd = this.newHerd(s, e, x, z);
      herd.tree = tree;
      const n = herdSize(e, Math.random(), part);
      for (let i = 0; i < n; i++) {
        let mx = x + (Math.random() - 0.5) * 8;
        let mz = z + (Math.random() - 0.5) * 8;
        if (!habitatFits(this.t, set, mx, mz, this.w.wild, e)) { mx = x; mz = z; }
        if (tree) { mx = tree.x + 2; mz = tree.z; }
        this.makeAnimal(s, e, herd, i, mx, mz);
      }
      return;
    }
  }

  /** อีกาบินมาที่ซาก (เกิดสูงนอกสายตาแล้วบินลงมา) */
  private spawnCarcassCrows(c: Carcass, f: AnimalFrame): void {
    const crow = ECO_BY_ID.get('crow')!;
    const herd = this.newHerd(SPECIES_BY_ID.get('crow')!, crow, c.x, c.z);
    const n = 2 + Math.floor(Math.random() * (FOOD.carcassCrows - 1));
    for (let i = 0; i < n; i++) {
      const ang = Math.atan2(c.z - f.pz, c.x - f.px) + (Math.random() - 0.5) * 1.2;
      const a = this.makeAnimal(herd.s, crow, herd, i, c.x + Math.cos(ang) * 60, c.z + Math.sin(ang) * 60);
      a.mind.hunger = 0.6 + Math.random() * 0.4;
      a.alt = 25 + Math.random() * 10;
    }
  }

  private removeAnimal(a: Animal, dispose = true): void {
    if (dispose) disposeObject(a.model.root);
    const i = this.list.indexOf(a);
    if (i >= 0) this.list.splice(i, 1);
    const m = a.herd.members.indexOf(a);
    if (m >= 0) a.herd.members.splice(m, 1);
    for (const h of this.herds) if (h.prey === a) h.prey = null;
  }

  private removeHerd(h: Herd): void {
    for (const a of [...h.members]) this.removeAnimal(a);
    const i = this.herds.indexOf(h);
    if (i >= 0) this.herds.splice(i, 1);
    this.herdCount.set(h.s.id, Math.max(0, (this.herdCount.get(h.s.id) ?? 1) - 1));
  }

  private population(f: AnimalFrame, part: DayPart): void {
    // หายเมื่อไกลเกิน หรือหมดเวลาออกหากินและอยู่นอกสายตา
    for (let i = this.herds.length - 1; i >= 0; i--) {
      const h = this.herds[i];
      if (!h.members.length) { this.removeHerd(h); continue; }
      const want = groupsWanted(h.e, part, f.rain);
      let far = true;
      let hide = true;
      for (const a of h.members) {
        const dx = a.x - f.px;
        const dz = a.z - f.pz;
        const d = Math.hypot(dx, dz);
        if (d < DESPAWN) far = false;
        if (d < 50 || !outOfView(dx, dz, f.fx, f.fz, 120)) hide = false;
      }
      const surplus = (this.herdCount.get(h.s.id) ?? 0) > Math.max(want, 1);
      if (far || (hide && (want === 0 || surplus) && !h.members.some((a) => a.mind.task === 'eat'))) this.removeHerd(h);
    }
    // เกิดใหม่ให้ครบจำนวนฝูงตามเวลาและอากาศ (ครั้งละหนึ่งฝูง)
    for (const id of MANAGED) {
      const e = ECO_BY_ID.get(id)!;
      if ((this.herdCount.get(id) ?? 0) < groupsWanted(e, part, f.rain) && Math.random() < 0.5) { this.spawnHerd(e, f, part); break; }
    }
    // ซากที่มีอีกามารุม (กลางวันเท่านั้น)
    if (part !== 'night') {
      for (const c of this.carcasses) {
        const d = Math.hypot(c.x - f.px, c.z - f.pz);
        const crowsNear = this.list.some((a) => a.s.id === 'crow' && Math.hypot(a.x - c.x, a.z - c.z) < 60);
        if (!crowsNear && d < 160 && c.age > 20 && Math.random() < 0.3) { this.spawnCarcassCrows(c, f); break; }
      }
    }
  }

  // ================= ห่วงโซ่อาหาร =================

  /** ล่าสำเร็จ: เหยื่อกลายเป็นซาก ใช้โมเดลตัวเดิมนอนตะแคง */
  private kill(prey: Animal): void {
    const c: Carcass = { key: `carcass-${this.tag}-${prey.id}`, s: prey.s, model: prey.model, x: prey.x, y: this.t.heightAt(prey.x, prey.z), z: prey.z, heading: prey.heading, age: 0, meat: prey.s.id === 'rabbit' ? 0.25 : 1 };
    c.model.root.position.set(c.x, c.y, c.z);
    c.model.animate(0, 0, 0, 'dead');
    this.carcasses.push(c);
    this.removeAnimal(prey, false);
  }

  private nearestCarcass(x: number, z: number): Carcass | null {
    let best: Carcass | null = null;
    let bd = Infinity;
    for (const c of this.carcasses) {
      if (c.meat <= 0) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** ใครล่าใคร (คิดจากรายการเหยื่อในระบบนิเวศ) */
  private eats(hunter: Eco, prey: Animal): boolean {
    return !!hunter.prey?.includes(prey.s.id);
  }

  // ================= คิดแล้วขยับ =================

  /** สิ่งที่สัตว์ตัวนี้รับรู้ (ระยะผู้เล่น ผู้ล่า เหยื่อ ซาก อาหาร) */
  private sense(a: Animal, f: AnimalFrame, part: DayPart, out: Sense): Sense {
    const dp = Math.hypot(a.x - f.px, a.z - f.pz);
    out.part = part;
    out.rain = f.rain;
    out.player = f.reach && a.hidden <= 0 ? dp : Infinity;
    out.predator = Infinity;
    out.prey = Infinity;
    a.thx = f.px;
    a.thz = f.pz;
    for (const b of this.list) {
      if (b === a) continue;
      const d0 = Math.hypot(b.x - a.x, b.z - a.z);
      // ผู้ล่าที่ย่องอยู่ เหยื่อเห็นช้ากว่า
      const d = b.mind.task === 'hunt' && b.mind.rush < 0 ? d0 * FOOD.stalkHidden : d0;
      if (this.eats(b.e, a) && d < out.predator) {
        out.predator = d;
        if (d < dp || !f.reach) { a.thx = b.x; a.thz = b.z; }
      }
      if (this.eats(a.e, b) && d0 < out.prey) out.prey = d0;
    }
    const c = (a.e.diet === 'meat' || a.e.diet === 'carrion') ? this.nearestCarcass(a.x, a.z) : null;
    out.carcass = c ? Math.hypot(c.x - a.x, c.z - a.z) : Infinity;
    out.food = Infinity;
    out.fishing = false;
    if (a.e.diet === 'fruit') {
      const zone = this.w.wild.zoneOf(a.x, a.z);
      if (zone === 1) {
        out.fishing = true;
        out.food = Math.hypot(this.w.wild.fishing.x - a.x, this.w.wild.fishing.z - a.z);
      } else {
        a.foodTimer -= 1;
        if (a.foodTimer <= 0 && a.mind.task !== 'forage') {
          a.foodTimer = 600;
          const tp = this.w.trees.nearest(a.x, a.z, 80, (p) => FOOD_TREES.has(p.kind));
          a.food = tp ? { x: tp.x, z: tp.z } : null;
        }
        out.food = a.food ? Math.hypot(a.food.x - a.x, a.food.z - a.z) : Infinity;
      }
    }
    out.fromHome = Math.hypot(a.x - a.herd.hx, a.z - a.herd.hz);
    const rest = this.restSets.get(a.e.id);
    out.inRest = !!rest && rest.has(this.t.biomeAt(a.x, a.z));
    return out;
  }

  private senseBuf: Sense = { part: 'day', rain: 0, player: Infinity, predator: Infinity, prey: Infinity, carcass: Infinity, food: Infinity, fishing: false, fromHome: 0, inRest: false };

  /** เดินหนึ่งก้าวไปทางเป้า ชนสิ่งกีดขวาง ไม่ขึ้นหน้าผา ไม่ลงน้ำลึก ไม่เข้าถ้ำ */
  private step(a: Animal, tx: number, tz: number, want: number, dt: number, climber = false): void {
    // เร่งช้า เบรกเร็ว (เดิมหมาป่าวิ่งเลยระยะตีไปทับตัวผู้เล่นเพราะเบรกช้า)
    a.speed += (want - a.speed) * Math.min(1, dt * (want < a.speed ? 9 : 3));
    const dx = tx - a.x;
    const dz = tz - a.z;
    if (Math.hypot(dx, dz) < 0.05 || a.speed < 0.01) return;
    let target = Math.atan2(-dx, -dz);
    if (a.avoid > 0) { a.avoid -= dt; target += a.avoidDir * 1.15; }
    let d = target - a.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.heading += d * Math.min(1, dt * 4);
    let nx = a.x - Math.sin(a.heading) * a.speed * dt;
    let nz = a.z - Math.cos(a.heading) * a.speed * dt;
    const air = a.s.move === 'fly';
    if (!air) {
      const t = this.t;
      const h0 = t.heightAt(a.x, a.z);
      // ไม่ลงน้ำลึก (หมีลุยน้ำตื้นจับปลาได้ · กบลงน้ำได้)
      const minH = a.s.id === 'frog' ? -Infinity : WORLD.waterLevel - (a.s.id === 'bear' ? 0.5 : 0.3);
      const ok = (x: number, z: number): boolean => {
        const h1 = t.heightAt(x, z);
        if (h1 < minH) return false;
        // หน้าผาชันขึ้นไม่ได้ (เดินลงได้)
        if (h1 > h0 + 0.02 && t.normalAt(x, z)[1] < WALKABLE_NY) return false;
        // ไม่เดินเข้าปากถ้ำ (พื้นตรงนั้นถูกเจาะเป็นรู)
        return !caveAt(this.w.caves, x, z, 2);
      };
      if (!ok(nx, nz)) {
        // หาทางเลี่ยง: หันซ้ายขวาทีละมุม เลือกทางแรกที่เดินได้ เลี้ยวข้างเดิมก่อนกันส่ายไปมา
        const len = Math.max(0.25, a.speed * dt);
        let found = false;
        for (const k of [0.6, 1.2, 1.8, 2.5]) {
          for (const sgn of [a.avoidDir, -a.avoidDir]) {
            const hd = a.heading + sgn * k;
            const cx = a.x - Math.sin(hd) * len;
            const cz = a.z - Math.cos(hd) * len;
            if (!ok(cx, cz)) continue;
            nx = cx;
            nz = cz;
            a.heading += sgn * k * 0.5;
            a.avoidDir = sgn;
            a.avoid = 0.6;
            found = true;
            break;
          }
          if (found) break;
        }
        if (!found) { nx = a.x; nz = a.z; }
      }
      if (a.s.radius > 0 && !climber) {
        // ต้นไม้ หิน ตึก รถ
        const feet = a.y;
        const r1 = this.w.colliders.push(nx, nz, a.s.radius, (c) => feet - (c.y0 ?? t.heightAt(c.x, c.z)));
        const r2 = this.w.structures.push(r1.x, r1.z, a.s.radius, feet);
        if (r1.hit || r2.hit) this.startAvoid(a, dx, dz);
        nx = r2.x;
        nz = r2.z;
      }
    }
    a.x = Math.max(-WORLD.half + 5, Math.min(WORLD.half - 5, nx));
    a.z = Math.max(-WORLD.half + 5, Math.min(WORLD.half - 5, nz));
  }

  private startAvoid(a: Animal, dx: number, dz: number): void {
    if (a.avoid > 0.2) return;
    a.avoid = 0.7 + Math.random() * 0.5;
    // เลี้ยวไปข้างที่หันห่างจากเป้าน้อยกว่า สลับข้างบ้างกันติดมุม
    const side = Math.sin(a.heading) * dz - Math.cos(a.heading) * dx;
    a.avoidDir = Math.random() < 0.25 ? -Math.sign(side || 1) : Math.sign(side || 1);
  }

  /** ฝูงเลือกเป้าเดินใหม่ ในที่ที่เหมาะกับเวลานี้ (ที่หากินหรือที่พัก) */
  private herdTarget(h: Herd, part: DayPart, rain: number, dt: number): void {
    h.retarget -= dt;
    if (h.retarget > 0) return;
    h.retarget = 8 + Math.random() * 12;
    const air = h.s.move === 'fly';
    const set = this.restTime(h.e, part, rain) ? this.restSets.get(h.e.id)! : this.feedSets.get(h.e.id)!;
    const r = air ? 40 : h.s.id === 'squirrel' ? 6 : h.s.id === 'frog' ? 5 : 18;
    for (let k = 0; k < 8; k++) {
      const x = h.hx + (Math.random() - 0.5) * r * 2;
      const z = h.hz + (Math.random() - 0.5) * r * 2;
      if (air || habitatFits(this.t, set, x, z, this.w.wild, h.e)) { h.tx = x; h.tz = z; return; }
    }
    h.tx = h.hx;
    h.tz = h.hz;
  }

  private act(a: Animal, f: AnimalFrame, part: DayPart, dt: number): void {
    const s = a.s;
    const h = a.herd;
    const sense = this.sense(a, f, part, this.senseBuf);
    const task = think(a.mind, s, a.e, sense, dt);
    a.catchCd = Math.max(0, a.catchCd - dt);
    a.boost = Math.max(0, a.boost - dt);
    let tx = a.x;
    let tz = a.z;
    let want = 0;
    let pose: Pose = 'walk';
    const dPlayer = Math.hypot(a.x - f.px, a.z - f.pz);
    if (a.goalTask !== task) { a.goal = null; a.goalTask = task; }

    switch (task) {
      case 'flee': {
        const [ux, uz] = fleeDir(a.x, a.z, a.thx, a.thz, WORLD.half);
        tx = a.x + ux * 20;
        tz = a.z + uz * 20;
        want = s.speed * a.vigor * (a.boost > 0 ? 1.25 : 1);
        // ทั้งฝูงตกใจตาม
        for (const b of h.members) if (b !== a && b.mind.scared < 2) { b.mind.scared = 3; b.thx = a.thx; b.thz = a.thz; }
        if (s.id === 'frog' && this.t.heightAt(a.x, a.z) < WORLD.waterLevel - 0.12) a.hidden = 15;
        break;
      }
      case 'chase': {
        tx = f.px;
        tz = f.pz;
        want = chaseWant(dPlayer, s.speed);
        // ถึงระยะตีแล้วหยุด หันหน้าเข้าหาผู้เล่น
        if (want === 0) turnToward(a, f.px, f.pz, dt * 6);
        if (dPlayer < ATTACK_RANGE && a.mind.cooldown <= 0 && Math.abs(a.y - f.py) < 2 && f.reach) {
          a.mind.cooldown = ATTACK_COOLDOWN;
          this.onAttack(s.id);
        }
        break;
      }
      case 'return': tx = h.hx; tz = h.hz; want = s.speed * 0.6; break;
      case 'hunt': {
        if (!h.prey || !this.list.includes(h.prey)) h.prey = this.choosePrey(a);
        const p = h.prey;
        if (!p) break;
        const dp = Math.hypot(p.x - a.x, p.z - a.z);
        // ย่องเข้าหาจนใกล้ หรือเหยื่อรู้ตัวแล้ว ทั้งฝูงวิ่งไล่พร้อมกัน
        if (a.mind.rush < 0) {
          if (dp < FOOD.rushFrom || p.mind.task === 'flee') {
            for (const b of h.members) if (b.mind.task === 'hunt' && b.mind.rush < 0) b.mind.rush = 0;
          } else {
            tx = p.x;
            tz = p.z;
            want = FOOD.stalkSpeed;
            break;
          }
        }
        // ล้อมจากหลายทาง ดักข้างหน้าเหยื่อเล็กน้อย
        const lead = 0.5;
        const ang = (a.slot / Math.max(1, h.members.length)) * Math.PI * 2;
        const flank = Math.hypot(p.x - a.x, p.z - a.z) > 6 ? 3 : 0;
        tx = p.x - Math.sin(p.heading) * p.speed * lead + Math.cos(ang) * flank;
        tz = p.z - Math.cos(p.heading) * p.speed * lead + Math.sin(ang) * flank;
        want = s.id === 'wolf' ? FOOD.huntSpeed : s.speed * 1.15;
        if (dp < 1.4 && a.catchCd <= 0) {
          a.catchCd = 1.2;
          if (Math.random() < FOOD.catchChance * (p.s.id === 'rabbit' ? 1.3 : 1)) {
            this.kill(p);
            for (const b of h.members) { b.mind.task = 'eat'; b.mind.taskTime = 0; b.mind.rush = -1; }
            h.prey = null;
          } else {
            p.mind.scared = 6;
            p.boost = 2.5;
          }
        }
        break;
      }
      case 'eat': {
        const c = this.nearestCarcass(a.x, a.z);
        if (!c) break;
        // ล้อมกินรอบซาก อีการอห่างกว่า
        const ring = s.id === 'crow' ? 1.6 + (a.slot % 3) * 0.6 : 0.9 + c.meat * 0.4;
        const ang = (a.slot / Math.max(2, h.members.length)) * Math.PI * 2 + a.id;
        tx = c.x + Math.cos(ang) * ring;
        tz = c.z + Math.sin(ang) * ring;
        const there = Math.hypot(tx - a.x, tz - a.z) < 0.6;
        want = there ? 0 : s.speed * (s.move === 'fly' ? 0.7 : 0.5);
        if (!there && s.move === 'fly' && Math.hypot(tx - a.x, tz - a.z) > 2) a.landed = false;
        if (there) {
          pose = 'eat';
          a.heading = Math.atan2(-(c.x - a.x), -(c.z - a.z));
          a.mind.hunger = Math.max(0, a.mind.hunger - dt / FOOD.eatSeconds);
          c.meat = Math.max(0, c.meat - dt * (s.id === 'crow' ? 0.0012 : 0.005));
          if (s.move === 'fly') a.landed = true;
        }
        break;
      }
      case 'drink': {
        if (!a.goal) {
          a.goal = drinkSpot(this.t, a.x, a.z, FOOD.drinkSearch);
          if (!a.goal) { a.mind.thirst = 0; break; }
        }
        const there = Math.hypot(a.goal.x - a.x, a.goal.z - a.z) < 1.2;
        tx = a.goal.x;
        tz = a.goal.z;
        want = there ? 0 : s.speed * 0.4;
        if (there) { pose = 'drink'; a.mind.thirst = Math.max(0, a.mind.thirst - dt / FOOD.drinkSeconds); }
        break;
      }
      case 'shelter': {
        if (!h.restGoal) {
          const set = this.restSets.get(a.e.id);
          h.restGoal = set ? nearestBiome(this.t, set, h.hx, h.hz, 220) : null;
          if (h.restGoal) { h.tx = h.restGoal.x; h.tz = h.restGoal.z; }
        }
        if (h.restGoal) {
          tx = h.restGoal.x + (a.slot % 3) * 2;
          tz = h.restGoal.z + Math.floor(a.slot / 3) * 2;
          want = s.speed * 0.35;
          if (Math.hypot(h.restGoal.x - a.x, h.restGoal.z - a.z) < 6) { h.hx = h.restGoal.x; h.hz = h.restGoal.z; h.restGoal = null; }
        }
        break;
      }
      case 'rest': {
        pose = s.move === 'fly' ? 'perch' : 'rest';
        if (s.move === 'fly' && s.id !== 'crow') { pose = 'walk'; tx = h.tx; tz = h.tz; want = s.speed * 0.4; }
        if (s.id === 'crow') a.landed = true;
        break;
      }
      case 'forage': {
        const g = a.food;
        if (!g) break;
        const tp = this.w.trees.nearest(g.x, g.z, 1);
        const r = (tp ? trunkRadius(tp.kind, tp.height) : 0.5) + 0.9;
        const dd = Math.hypot(g.x - a.x, g.z - a.z);
        tx = g.x + ((a.x - g.x) / (dd || 1)) * r;
        tz = g.z + ((a.z - g.z) / (dd || 1)) * r;
        const there = dd < r + 0.6;
        want = there ? 0 : s.speed * 0.4;
        if (there) {
          a.heading = Math.atan2(-(g.x - a.x), -(g.z - a.z));
          pose = Math.sin(f.time * 0.45 + a.id) > -0.2 ? 'rear' : 'eat';
          a.mind.hunger = Math.max(0, a.mind.hunger - dt / 50);
        }
        break;
      }
      case 'fish': {
        const g = this.w.wild.fishing;
        tx = g.x;
        tz = g.z;
        const there = Math.hypot(g.x - a.x, g.z - a.z) < 1.5;
        want = there ? 0 : s.speed * 0.4;
        if (there) { pose = 'fish'; a.heading = Math.PI / 2; a.mind.hunger = Math.max(0, a.mind.hunger - dt / 80); }
        break;
      }
      case 'graze': {
        pose = 'graze';
        // ตัวแรกของฝูงกวางเงยหน้าระวังภัยเป็นพัก ๆ
        if (a.slot === 0 && h.members.length >= 3 && Math.sin(f.time * 0.4 + h.id) > 0.1) pose = 'alert';
        break;
      }
      default: {
        // เดินเล่นตามฝูง แต่ละตัวมีที่ของตัวเองรอบเป้าฝูง
        this.herdTarget(h, part, f.rain, dt);
        const spread = s.id === 'deer' ? 2.5 : s.id === 'wolf' ? 2 : 1.2;
        tx = h.tx + Math.cos(a.slot * 2.4) * spread * Math.sqrt(a.slot);
        tz = h.tz + Math.sin(a.slot * 2.4) * spread * Math.sqrt(a.slot);
        const far = Math.hypot(tx - a.x, tz - a.z);
        want = far > 1 ? s.speed * (s.move === 'fly' ? 0.6 : 0.22) * Math.min(1, far / 4 + 0.4) : 0;
        if (s.id === 'eagle') {
          // ร่อนเป็นวงกว้างเหนือที่อยู่
          const ang = f.time * 0.08 + h.id;
          tx = h.hx + Math.cos(ang) * 60;
          tz = h.hz + Math.sin(ang) * 60;
          want = s.speed * 0.7;
        }
        // อีกาบินวนแล้วลงเกาะพื้นเป็นพัก ๆ
        if (s.id === 'crow') {
          if (a.landed) { want = 0; pose = 'perch'; if (Math.random() < dt * 0.06) a.landed = false; }
          else if (Math.random() < dt * 0.04) a.landed = true;
        }
      }
    }

    if (s.id === 'squirrel') { this.squirrel(a, task, dPlayer, f, dt); return; }
    if (task === 'flee' && s.move === 'fly') a.landed = false;
    want = currentSpeed(a.mind, s, want);
    if (a.landed && s.move === 'fly') want = Math.min(want, 0.5);
    this.step(a, tx, tz, want, dt);
    a.pose = pose === 'walk' && s.move === 'fly' && a.landed ? 'perch' : pose;
    this.placeModel(a, f.time, dt);
  }

  /** เลือกเหยื่อ: ฝูงที่ใกล้ที่สุดแล้วแยกตัวหลงฝูงออกมา */
  private choosePrey(a: Animal): Animal | null {
    let best: Herd | null = null;
    let bd: number = FOOD.huntRange;
    for (const h of this.herds) {
      if (!h.members.length || !this.eats(a.e, h.members[0])) continue;
      const d = Math.hypot(h.members[0].x - a.x, h.members[0].z - a.z);
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) return null;
    const i = pickStraggler(best.members.map((m) => m.x), best.members.map((m) => m.z), a.x, a.z);
    return best.members[i] ?? null;
  }

  /** กระรอก: วิ่งเป็นช่วงบนพื้นใกล้ต้นของมัน เห็นคนแล้ววิ่งขึ้นต้นไม้ นั่งบนลำต้น ลงเอาหัวลงเมื่อคนไปแล้ว */
  private squirrel(a: Animal, task: string, dPlayer: number, f: AnimalFrame, dt: number): void {
    const tree = a.herd.tree;
    if (!tree) { this.placeModel(a, f.time, dt); return; }
    const top = Math.min(7, tree.height * 0.45);
    const trunk = (hgt: number) => trunkRadius(tree.kind, tree.height) * (1 - (hgt / tree.height) * 0.6) + 0.05;
    const ax = a.x - tree.x;
    const az = a.z - tree.z;
    const al = Math.hypot(ax, az) || 1;
    a.climbTimer += dt;
    switch (a.climbState) {
      case 'ground': {
        if (task === 'flee' || (a.climbTimer > 25 && Math.random() < dt * 0.05)) {
          // วิ่งไปที่โคนต้น
          const r = trunk(0);
          this.step(a, tree.x + (ax / al) * r, tree.z + (az / al) * r, a.s.speed, dt, true);
          if (al < r + 0.25) { a.climbState = 'up'; a.climbTimer = 0; }
          a.pose = 'walk';
        } else {
          // วิ่งเป็นช่วงสั้น ๆ สลับหยุดนั่งดมอากาศ
          const burst = Math.sin(a.climbTimer * 1.3 + a.id) > 0.3;
          if (!a.goal || Math.hypot(a.goal.x - a.x, a.goal.z - a.z) < 0.3) a.goal = { x: tree.x + (Math.random() - 0.5) * 12, z: tree.z + (Math.random() - 0.5) * 12 };
          this.step(a, a.goal.x, a.goal.z, burst ? a.s.speed * 0.6 : 0, dt);
          a.pose = burst ? 'walk' : 'alert';
        }
        a.climb = 0;
        break;
      }
      case 'up': {
        a.climb = Math.min(top, a.climb + 1.8 * dt);
        if (a.climb >= top) { a.climbState = 'top'; a.climbTimer = 0; }
        a.pose = 'climbUp';
        a.speed = 1.8;
        a.heading = Math.atan2(ax / al, az / al);
        break;
      }
      case 'top': {
        a.pose = 'climbUp';
        a.speed = 0;
        if (dPlayer > 18 && a.climbTimer > 8) { a.climbState = 'down'; a.climbTimer = 0; }
        break;
      }
      case 'down': {
        // ลงต้นเอาหัวลง หันหลังให้ลำต้น ท้องแนบลำต้น
        a.climb = Math.max(0, a.climb - 1.2 * dt);
        a.pose = 'climbDown';
        a.speed = 1.2;
        a.heading = Math.atan2(-ax / al, -az / al);
        if (task === 'flee') a.climbState = 'up';
        if (a.climb <= 0) { a.climbState = 'ground'; a.climbTimer = 0; a.goal = null; }
        break;
      }
    }
    if (a.climbState !== 'ground') {
      const r = trunk(a.climb);
      a.x = tree.x + (ax / al) * r;
      a.z = tree.z + (az / al) * r;
    }
    this.placeModel(a, f.time, dt);
  }

  /** ความสูงตัว แล้ววางโมเดล */
  private placeModel(a: Animal, time: number, dt: number): void {
    const s = a.s;
    const ground = this.t.heightAt(a.x, a.z);
    if (s.move === 'fly') {
      const target = a.landed ? ground : ground + a.alt + Math.sin(time * 0.6 + a.id) * 1.5;
      // ขึ้นลงนุ่ม ๆ (อีกาบินลงมาที่ซาก)
      a.y += (Math.max(ground, target) - a.y) * Math.min(1, dt * (a.landed ? 2.5 : 1));
    } else if (s.id === 'squirrel') a.y = ground + a.climb;
    else if (s.move === 'hop') a.y = Math.max(ground, s.id === 'frog' && a.hidden > 0 ? WORLD.waterLevel - 0.3 : ground) + Math.max(0, Math.sin(time * 9 + a.id)) * 0.25 * Math.min(1, a.speed);
    else a.y = Math.max(ground, s.id === 'bear' ? WORLD.waterLevel - 0.45 : ground);
    a.model.root.visible = a.hidden <= 0;
    a.model.root.position.set(a.x, a.y, a.z);
    a.model.root.rotation.y = a.heading;
    // โดนหมึกตัวเปื้อนดำ (ย่อตัวนิด ๆ ให้รู้ว่าเหนียว)
    a.model.root.scale.setScalar(a.mind.sticky > 0 ? 0.97 : 1);
    a.model.animate(dt, a.speed, time, a.pose);
  }

  update(f: AnimalFrame): void {
    const dt = f.dt;
    const part = dayPart(f.timeOfDay);
    this.frame++;
    this.popTimer -= dt;
    if (this.popTimer <= 0 && this.spawning) {
      this.popTimer = 0.4;
      this.population(f, part);
    }
    const iter = this.iter;
    iter.length = 0;
    for (const a of this.list) iter.push(a);
    for (const a of iter) {
      if (a.herd.members.indexOf(a) < 0) continue;
      if (a.hidden > 0 && Math.hypot(a.x - f.px, a.z - f.pz) > 12) a.hidden -= dt;
      // สัตว์ไกลคิดทุก 3 เฟรม (สะสมเวลาไว้)
      a.acc += dt;
      const far = Math.hypot(a.x - f.px, a.z - f.pz) > 90;
      if (far && (this.frame + a.id) % 3 !== 0) continue;
      const step = Math.min(0.2, a.acc);
      a.acc = 0;
      this.act(a, f, part, step);
    }
    // ซาก: ถูกกินจนเหลือแต่ซากสีคล้ำ อยู่ได้ระยะหนึ่งแล้วหาย
    for (let i = this.carcasses.length - 1; i >= 0; i--) {
      const c = this.carcasses[i];
      c.age += dt;
      c.model.tint?.(1 - c.meat);
      if (c.age > FOOD.carcassSeconds || Math.hypot(c.x - f.px, c.z - f.pz) > DESPAWN + 30) {
        disposeObject(c.model.root);
        this.carcasses.splice(i, 1);
      }
    }
    this.updateFireflies(f, part);
  }

  /** หิ่งห้อย: กลางคืน ลอยต่ำ ๆ ในทุ่งกับริมน้ำ (ไม่ออกตอนฝนตก ไม่ขึ้นในป่าทึบ) */
  private updateFireflies(f: AnimalFrame, part: DayPart): void {
    const on = (part === 'night' || part === 'dusk') && f.rain < 0.3 && groupsWanted(ECO_BY_ID.get('firefly')!, part, f.rain) > 0;
    this.fireflies.visible = on;
    if (!on) return;
    const feed = this.feedSets.get('firefly')!;
    const { dt, px, pz, time } = f;
    for (let i = 0; i < FIRE_COUNT; i++) {
      if (this.fireSeed[i] === 0 || Math.hypot(this.firePos[i * 3] - px, this.firePos[i * 3 + 2] - pz) > 40) {
        const a = Math.random() * 6.28;
        const d = 5 + Math.random() * 30;
        const x = px + Math.cos(a) * d;
        const z = pz + Math.sin(a) * d;
        this.firePos[i * 3] = x;
        this.firePos[i * 3 + 2] = z;
        this.fireSeed[i] = feed.has(this.t.biomeAt(x, z)) ? 1 + Math.random() * 100 : -1;
      }
      const sd = this.fireSeed[i];
      if (sd < 0) { this.firePos[i * 3 + 1] = -500; continue; }
      this.firePos[i * 3] += Math.sin(time * 0.5 + sd) * dt * 0.4;
      this.firePos[i * 3 + 2] += Math.cos(time * 0.4 + sd) * dt * 0.4;
      this.firePos[i * 3 + 1] = this.t.heightAt(this.firePos[i * 3], this.firePos[i * 3 + 2]) + 0.6 + Math.sin(time + sd) * 0.4;
    }
    (this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.fireflies.material as THREE.PointsMaterial).opacity = 0.5 + 0.4 * Math.sin(time * 2.3);
  }

  // ================= สแกน หมึก ตัวช่วยทดสอบ =================

  /** สัตว์กับซากที่สแกนได้ (ซากสแกนได้เป็นชนิดของสัตว์ตัวนั้น) */
  scanTargets(): { key: string; kind: string; x: number; y: number; z: number }[] {
    const out = this.list.filter((a) => a.hidden <= 0).map((a) => ({ key: `animal-${this.tag}-${a.id}`, kind: a.s.id, x: a.x, y: a.y + Math.max(0.15, a.s.height * (a.pose === 'rest' ? 0.5 : 1)), z: a.z }));
    for (const c of this.carcasses) out.push({ key: c.key, kind: c.s.id, x: c.x, y: c.y + 0.3, z: c.z });
    return out;
  }

  /** หมึกตกตรงนี้ · สัตว์ในรัศมีโดนหมึก */
  ink(x: number, y: number, z: number): string[] {
    const hit: string[] = [];
    for (const a of this.list) {
      if (Math.hypot(a.x - x, a.z - z) < 2.6 && Math.abs(a.y - y) < 4) {
        inkHit(a.mind, a.s);
        hit.push(a.s.id);
      }
    }
    return hit;
  }

  /** หิ่งห้อยที่ใกล้สุด (สแกน) */
  nearestFirefly(px: number, pz: number): { i: number; x: number; y: number; z: number } | null {
    if (!this.fireflies.visible) return null;
    let best = -1;
    let bd = 12;
    for (let i = 0; i < FIRE_COUNT; i++) {
      if (this.fireSeed[i] < 0) continue;
      const d = Math.hypot(this.firePos[i * 3] - px, this.firePos[i * 3 + 2] - pz);
      if (d < bd) { bd = d; best = i; }
    }
    return best < 0 ? null : { i: best, x: this.firePos[best * 3], y: this.firePos[best * 3 + 1], z: this.firePos[best * 3 + 2] };
  }

  /** ตัวช่วยทดสอบ: วางสัตว์ชนิดนั้นตรงจุดนั้น (ฝูงละตัวเดียว · n = จำนวนในฝูง) */
  place(id: string, x: number, z: number, n = 1): number {
    const s = SPECIES_BY_ID.get(id)!;
    const e = ECO_BY_ID.get(id)!;
    const herd = this.newHerd(s, e, x, z);
    if (id === 'squirrel') herd.tree = this.w.trees.nearest(x, z, 20);
    let first = -1;
    for (let i = 0; i < n; i++) {
      const a = this.makeAnimal(s, e, herd, i, x + i * 1.5, z);
      if (s.move === 'fly') { a.alt = 6; a.y = this.t.heightAt(a.x, a.z) + 6; }
      if (first < 0) first = a.id;
    }
    return first;
  }

  get(id: number): Animal | undefined {
    return this.list.find((a) => a.id === id);
  }

  /** ตัวช่วยทดสอบ: จำนวนต่อชนิด งานที่ทำ */
  census(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const a of this.list) (out[a.s.id] ??= []).push(a.mind.task);
    if (this.carcasses.length) out.carcass = this.carcasses.map((c) => `${c.s.id} ${Math.round(c.meat * 100)}%`);
    return out;
  }
}

/** หันหน้าเข้าหาจุด (ค่อย ๆ หมุน) */
function turnToward(a: { x: number; z: number; heading: number }, x: number, z: number, k: number): void {
  const target = Math.atan2(-(x - a.x), -(z - a.z));
  const d = Math.atan2(Math.sin(target - a.heading), Math.cos(target - a.heading));
  a.heading += d * Math.min(1, k);
}
