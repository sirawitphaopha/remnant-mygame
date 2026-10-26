import { WORLD } from '../config/game';
import { MOUNTAINS, SHIP, TOWN } from './layout';
import { hash2, Simplex2 } from './noise';

// ภูเขายอดตัด (ที่ราบสูงขอบหน้าผา ไว้ปีนขึ้นดูวิว) ทั้งแมพ · กติกาล้วน ไม่แตะภาพ · seed เดิม ผลเดิมทุกครั้ง
// พี่กันขอ 26 ต.ค. 2569 *"ภูเขาตำแหน่งนี้ ขอสมจริงกว่านี้"* แล้ว *"ภูเขาทรงๆนี้ในเเมทพ เเก้ด้วยนะ วาดทีละภูเขาได้"*
// เดิมยกพื้นขึ้นทีเดียว 14 ม. ในระยะแนวนอนแค่ 2 ม. ผนังดิ่งเรียบรอบทั้งลูก ทุกลูกหน้าตาเหมือนกัน
// ตอนนี้แต่ละลูกมีชนิดหิน ความสูง ความชัน เพิงหิน ร่องหุบของตัวเอง · 10 ลูกที่ใหญ่สุดกำหนดชนิดหินทีละลูก (HAND)
// หน้าตัดเหมือนหน้าผาจริง (docs/REFERENCES-R2.md หัวข้อ 13): ขอบบนมน → ผนังหินชัน → ลาดกองหินร่วงที่ตีนผา (บนชัน ปลายลาดลง) → พื้นเดิม
// ผนังหินชันกว่าที่ตัวละครเดินได้ (ต้องใช้ที่ปีน หรือหาร่องหุบ) · ลาดกองหินร่วงเดินปีนขึ้นได้

export type MesaRock = 'sandstone' | 'limestone' | 'granite' | 'shale';
export const MESA_ROCKS: readonly MesaRock[] = ['sandstone', 'limestone', 'granite', 'shale'];

/** รูปทรงของภูเขาหนึ่งลูก (ค่าที่ผสมกันได้ระหว่างสองลูกที่อยู่ติดกัน) */
export interface MesaShape {
  /** ความสูงชั้นล่าง · ชั้นบน (ม.) */
  h1: number;
  h2: number;
  /** ผนังหิน: ระยะแนวนอนต่อความสูง 1 ม. (น้อย = ชัน · 0.25 ≈ 76 องศา) */
  cot: number;
  /** ส่วนของความสูงที่เป็นลาดกองหินร่วง · ส่วนที่เป็นขอบบนมน */
  talus: number;
  crest: number;
  /** เพิงหินคั่นกลางผนัง: ตำแหน่ง 0 ถึง 1 จากตีนผนัง (0 = ไม่มีเพิง) · กว้าง (ม.) */
  bench: number;
  benchW: number;
  /** ขอบผาหยักในแนวราบ (ม.) กับช่วงคลื่น (ม.) */
  jag: number;
  jagScale: number;
  /** ร่องหุบกัดเข้าไปในผา 0 ถึง 1 (1 = ลึกราว 10 ม.) · ผิวผนังขรุขระ (ม.) */
  gully: number;
  rough: number;
  /** ชั้นหินแนวนอนบนผนัง 0 ถึง 1 (ให้ภาพใช้) */
  strata: number;
}

export interface Mesa extends MesaShape {
  id: number;
  /** กลางลูก (พิกัดในโค้ด) · พื้นที่ยอด (ตร.ม. ที่ความละเอียด 10 ม.) */
  x: number;
  z: number;
  area: number;
  /** กรอบที่ลูกนี้คลุม รวมลาดหินร่วง [x0, z0, x1, z1] */
  box: [number, number, number, number];
  rock: MesaRock;
  /** ลูกที่แคลร์กำหนดเอง (คำอธิบายสั้น) · ว่าง = เลือกตามถิ่น */
  note: string;
}

type Range = [number, number];
interface RockLook { h: Range; top: Range; cot: Range; talus: Range; crest: Range; bench: Range; jag: Range; jagScale: number; gully: Range; rough: number; strata: number }

/**
 * ลักษณะตามชนิดหิน (ช่วงค่า แต่ละลูกสุ่มในช่วง)
 * หินทราย: ผนังตั้งเกือบดิ่ง ชั้นหินแนวนอนชัด ยอดราบ ขอบคม ร่องหุบลึก (แบบ Caprock Escarpment)
 * หินปูน: ผนังชันมีเพิงหินคั่นกลาง ขอบหยักถี่ สีครีมเทา
 * หินแกรนิต: ไม่มีชั้น ผนังลาดกว่า ขอบบนมนกว้างเหมือนหลังเต่า ขอบหยักเป็นพูใหญ่
 * หินดินดาน: แตกร่วนง่าย ไม่มีผนังตั้ง ลาดเศษหินยาวเกินครึ่งความสูง ชั้นบางถี่ สีเข้ม
 */
const LOOK: Record<MesaRock, RockLook> = {
  sandstone: { h: [13, 18], top: [0.55, 0.8], cot: [0.2, 0.3], talus: [0.3, 0.42], crest: [0.04, 0.08], bench: [0, 0], jag: [2, 4], jagScale: 40, gully: [0.5, 0.9], rough: 0.5, strata: 1 },
  limestone: { h: [12, 17], top: [0.5, 0.75], cot: [0.18, 0.3], talus: [0.24, 0.34], crest: [0.05, 0.1], bench: [0.35, 0.6], jag: [1.5, 3], jagScale: 30, gully: [0.3, 0.6], rough: 0.6, strata: 0.6 },
  granite: { h: [9, 14], top: [0.4, 0.6], cot: [0.5, 0.7], talus: [0.18, 0.28], crest: [0.18, 0.3], bench: [0, 0], jag: [3, 5], jagScale: 70, gully: [0.1, 0.3], rough: 0.35, strata: 0.12 },
  shale: { h: [8, 12], top: [0.5, 0.7], cot: [0.8, 0.97], talus: [0.5, 0.6], crest: [0.14, 0.24], bench: [0, 0], jag: [1, 2], jagScale: 40, gully: [0.6, 1], rough: 0.4, strata: 0.8 },
};

/**
 * 10 ลูกที่ใหญ่สุดในแมพ แคลร์กำหนดเองทีละลูก (X Y ตามพิกัดบนจอ · Y เหนือบวก = −z ในโค้ด)
 * จับคู่กับลูกที่กลางลูกห่างไม่เกิน 40 ม.
 */
const HAND: { X: number; Y: number; rock: MesaRock; note: string }[] = [
  { X: -935, Y: -594, rock: 'sandstone', note: 'ลูกที่พี่กันชี้ ห่างยานราว 200 ม. หินทรายสองชั้น' },
  { X: 541, Y: 298, rock: 'limestone', note: 'กลางแมพฝั่งตะวันออก หินปูนมีเพิง' },
  { X: -1146, Y: -1166, rock: 'shale', note: 'มุมตะวันตกเฉียงใต้ในป่าทึบ หินดินดานลาดยาว' },
  { X: 231, Y: -276, rock: 'granite', note: 'กลางทุ่งหญ้า หินแกรนิตมนโดดเดี่ยว' },
  { X: 843, Y: 716, rock: 'granite', note: 'ตีนเขาตะวันออกเฉียงเหนือ หินแกรนิต' },
  { X: -501, Y: -1278, rock: 'sandstone', note: 'ใต้สุดฝั่งตะวันตก หินทราย' },
  { X: 762, Y: -938, rock: 'limestone', note: 'ฝั่งตะวันออกเฉียงใต้ หินปูน' },
  { X: -51, Y: -315, rock: 'shale', note: 'ใต้เมือง หินดินดาน' },
  { X: 492, Y: -721, rock: 'sandstone', note: 'ทุ่งหญ้าสูงตะวันออก หินทราย' },
  { X: -388, Y: -908, rock: 'limestone', note: 'ป่าที่เคยเป็นไร่ หินปูน' },
];

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** ขอบชั้นล่าง · ชั้นบน (ค่าสัญญาณรบกวนที่เป็นแนวหน้าผา เท่าเดิม) */
export const MESA_TIERS = [0.39, 0.545] as const;
/** ช่องตารางหาภูเขาแต่ละลูก (ม.) */
export const MESA_CELL = 10;
/** แผ่ป้ายชื่อลูกออกรอบยอดอีกกี่ช่อง (คลุมลาดกองหินร่วงกับร่องหุบ) */
const SPREAD = 5;
/** ความชันของสัญญาณรบกวนต่ำสุดที่ใช้คิดระยะถึงแนวผา (ต่อเมตร) · กันลูกที่ยอดแค่เฉียดเส้นกลายเป็นเสาดิ่ง */
const GMIN = 0.004;

/** ยอมให้มีภูเขายอดตัดตรงนั้นแค่ไหน (0 ถึง 1) · ไม่ขึ้นบนเทือกเขา ใกล้เมือง ใกล้ยาน */
export function mesaAway(x: number, z: number): number {
  const north = smooth(MOUNTAINS.foot, MOUNTAINS.crest, z);
  const edge = Math.max(smooth(-1120, -1460, x), smooth(1120, 1460, x), smooth(1290, 1480, z));
  return (1 - smooth(0.15, 0.6, north + edge)) * smooth(250, 420, Math.hypot(x - TOWN.x, z - TOWN.z)) * smooth(120, 220, Math.hypot(x - SHIP.x, z - SHIP.z));
}

/** ความกว้างแนวนอนของผนังหิน (ม.) รวมเพิง */
export function faceWidth(H: number, p: MesaShape): number {
  const faceH = H * (1 - p.talus - p.crest);
  return Math.max(3.2, faceH * p.cot) + (p.bench > 0 ? p.benchW : 0);
}

/** ระยะแนวนอนจากตีนผนังเข้าไป ที่ความสูง w (0 ตีนผนัง ถึง 1 ขอบบน) · ตรงกับหน้าตัดใน escarpment (รวมเพิงหิน) */
export function faceOffset(w: number, H: number, p: MesaShape): number {
  const Fw = faceWidth(H, p);
  if (!(p.bench > 0)) return w * Fw;
  const faceW = Fw - p.benchW;
  const lowW = faceW * p.bench;
  if (w < p.bench) return (w / p.bench) * lowW;
  if (w < p.bench + 0.03) return lowW + ((w - p.bench) / 0.03) * p.benchW;
  return lowW + p.benchW + ((w - p.bench - 0.03) / (1 - p.bench - 0.03)) * (faceW - lowW);
}

/** จุดหนึ่งบนแนวตีนผนังหิน: ตำแหน่ง · ทิศออกนอกภูเขา · ความกว้างผนัง · หน้าตาของลูกตรงนั้น */
export interface FacePoint { x: number; z: number; nx: number; nz: number; fw: number; H: number; shape: MesaShape }

/** ความสูงตามหน้าตัดหน้าผา ที่ระยะ s ม. จากขอบบนของผนัง (บวก = เข้าไปบนยอด) · face = ความเป็นผนังหิน 0 ถึง 1 (ไว้ใส่ผิวขรุขระ) */
export function escarpment(s: number, H: number, p: MesaShape): { h: number; face: number } {
  const tau = p.talus;
  const delta = p.crest;
  const faceH = H * (1 - tau - delta);
  const benchW = p.bench > 0 ? p.benchW : 0;
  const faceW = Math.max(3.2, faceH * p.cot);
  const Fw = faceW + benchW;
  // ลาดกองหินร่วงเฉลี่ยราว 35 องศา · ขอบบนมนเฉลี่ยราว 17 องศา
  const Tw = (tau * H) / 0.7;
  const Cw = (delta * H) / 0.3 + 1;
  if (s >= Cw) return { h: H, face: 0 };
  if (s >= 0) {
    const u = 1 - s / Cw;
    return { h: H - delta * H * u * u, face: u };
  }
  if (s >= -Fw) {
    const x = s + Fw;
    let w: number;
    if (benchW > 0) {
      // ผนังสองช่วงคั่นด้วยเพิงหินเกือบราบ (ยก 3% ของผนัง)
      const lowW = faceW * p.bench;
      if (x < lowW) w = p.bench * (x / lowW);
      else if (x < lowW + benchW) w = p.bench + 0.03 * ((x - lowW) / benchW);
      else w = p.bench + 0.03 + (1 - p.bench - 0.03) * ((x - lowW - benchW) / (faceW - lowW));
    } else w = x / Fw;
    return { h: tau * H + faceH * w, face: 0.6 + 0.4 * (x / Fw) };
  }
  if (s >= -Fw - Tw) {
    // ลาดเว้า: ชิดผาชัน ปลายลาดลงเข้าหาพื้น
    const v = (s + Fw + Tw) / Tw;
    return { h: tau * H * Math.pow(v, 1.5), face: 0.6 * v };
  }
  return { h: 0, face: 0 };
}

const DEFAULT_ROCK: MesaRock = 'sandstone';

/** ค่ากลางของชนิดหิน (ไว้ใช้ตรงที่ไม่มีลูกไหนคลุม เช่น ใกล้เมือง ใกล้ยาน ที่ภูเขายุบเหลือนิดเดียว) */
function middle(rock: MesaRock, sf: number): MesaShape {
  const L = LOOK[rock];
  const mid = (r: Range) => (r[0] + r[1]) / 2;
  const h1 = mid(L.h) * sf;
  return { h1, h2: h1 * mid(L.top), cot: mid(L.cot), talus: mid(L.talus), crest: mid(L.crest), bench: mid(L.bench), benchW: 3, jag: mid(L.jag), jagScale: L.jagScale, gully: mid(L.gully), rough: L.rough, strata: L.strata };
}

/** ภูเขายอดตัดทั้งแมพ: หาแต่ละลูก กำหนดหน้าตา แล้วคิดความสูงตามหน้าตัดหน้าผา */
export class MesaMap {
  readonly mesas: Mesa[] = [];
  private noise = new Simplex2(WORLD.seed);
  private detail = new Simplex2(WORLD.seed + 404);
  private n = Math.floor(WORLD.size / MESA_CELL) + 1;
  /** ค่าสัญญาณรบกวนกับความชันของมันทุกช่อง · ป้ายชื่อลูก (แผ่ออกรอบยอดแล้ว · −1 = ไม่มีลูกไหนคลุม) */
  private val: Float32Array;
  private grad: Float32Array;
  private label: Int16Array;
  private fallback = middle(DEFAULT_ROCK, 0.7);
  private mix: MesaShape = { ...this.fallback };

  constructor() {
    const n = this.n;
    const S = MESA_CELL;
    this.val = new Float32Array(n * n);
    this.grad = new Float32Array(n * n);
    this.label = new Int16Array(n * n).fill(-1);
    const away = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -WORLD.half + i * S;
        const z = -WORLD.half + j * S;
        this.val[j * n + i] = this.field(x, z);
        away[j * n + i] = mesaAway(x, z);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = this.val;
        const gx = (v[j * n + Math.min(n - 1, i + 1)] - v[j * n + Math.max(0, i - 1)]) / (2 * S);
        const gz = (v[Math.min(n - 1, j + 1) * n + i] - v[Math.max(0, j - 1) * n + i]) / (2 * S);
        this.grad[j * n + i] = Math.hypot(gx, gz);
      }
    }
    // แต่ละลูก = จุดที่ยอดพ้นแนวผาชั้นล่างติดกันเป็นผืน (ไม่นับที่ถูกเทือกเขา เมือง ยาน กดไว้)
    const inside = (k: number) => this.val[k] > MESA_TIERS[0] && away[k] > 0.2;
    const queue: number[] = [];
    for (let k = 0; k < n * n; k++) {
      if (this.label[k] >= 0 || !inside(k)) continue;
      const id = this.mesas.length;
      const stack = [k];
      this.label[k] = id;
      let cnt = 0;
      let sx = 0;
      let sz = 0;
      while (stack.length) {
        const q = stack.pop()!;
        queue.push(q);
        const i = q % n;
        const j = (q - i) / n;
        cnt++;
        sx += -WORLD.half + i * S;
        sz += -WORLD.half + j * S;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          const m = jj * n + ii;
          if (this.label[m] < 0 && inside(m)) {
            this.label[m] = id;
            stack.push(m);
          }
        }
      }
      this.mesas.push(this.design(id, sx / cnt, sz / cnt, cnt * S * S));
    }
    // แผ่ป้ายชื่อลูกออกไปรอบยอด (ลาดกองหินร่วงกับร่องหุบอยู่นอกแนวยอด) · ช่องที่ไปถึงก่อนได้ลูกนั้น
    for (let step = 0; step < SPREAD; step++) {
      const next: number[] = [];
      for (const q of queue) {
        const i = q % n;
        const j = (q - i) / n;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          const m = jj * n + ii;
          if (this.label[m] < 0) {
            this.label[m] = this.label[q];
            next.push(m);
          }
        }
      }
      queue.length = 0;
      queue.push(...next);
    }
    // กรอบของแต่ละลูก (รวมช่องที่แผ่ออกไป)
    for (let k = 0; k < n * n; k++) {
      const id = this.label[k];
      if (id < 0) continue;
      const i = k % n;
      const j = (k - i) / n;
      const x = -WORLD.half + i * S;
      const z = -WORLD.half + j * S;
      const b = this.mesas[id].box;
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], z);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], z);
    }
  }

  /** สัญญาณรบกวนของแนวผา (สูตรเดิม ตำแหน่งภูเขาเดิมทุกลูก) */
  field(x: number, z: number): number {
    return this.noise.fbm(x / 230 - 5, z / 230 + 9, 3);
  }

  /** กำหนดหน้าตาของลูกหนึ่ง: ชนิดหินจาก HAND หรือตามถิ่น · ค่าอื่นสุ่มในช่วงของชนิดหิน · ลูกเล็กเตี้ยกว่า */
  private design(id: number, x: number, z: number, area: number): Mesa {
    const hand = HAND.find((h) => Math.hypot(h.X - x, -h.Y - z) < 40);
    const r = (k: number) => hash2(Math.round(x), Math.round(z), 700 + k);
    let rock: MesaRock;
    if (hand) rock = hand.rock;
    else {
      // ตะวันตกหินทรายกับหินดินดาน · ตะวันออกหินปูน · ใกล้เทือกเขาเหนือหินแกรนิต
      const w: Record<MesaRock, number> = {
        sandstone: 1 + smooth(-200, -800, x),
        limestone: 1 + smooth(200, 800, x),
        granite: 0.7 + 1.5 * smooth(-300, -900, z),
        shale: 0.6 + 0.6 * smooth(300, 900, z),
      };
      const total = MESA_ROCKS.reduce((s, k) => s + w[k], 0);
      let pick = r(0) * total;
      rock = MESA_ROCKS.find((k) => (pick -= w[k]) < 0) ?? DEFAULT_ROCK;
    }
    const L = LOOK[rock];
    const inR = (range: Range, k: number) => lerp(range[0], range[1], r(k));
    // ลูกเล็กเตี้ยกว่า (ยอดกว้างราว 110 ม. ขึ้นไปสูงเต็มที่ · ลูกจิ๋วเหลือเนินหินราวหนึ่งในสาม)
    const sf = Math.max(0.35, Math.min(1.15, Math.sqrt(area) / 110));
    const h1 = inR(L.h, 1) * sf;
    return {
      id, x, z, area, rock, note: hand?.note ?? '', box: [Infinity, Infinity, -Infinity, -Infinity],
      h1, h2: h1 * inR(L.top, 2), cot: inR(L.cot, 3), talus: inR(L.talus, 4), crest: inR(L.crest, 5),
      bench: inR(L.bench, 6), benchW: 2.5 + r(7) * 1.5, jag: inR(L.jag, 8), jagScale: L.jagScale * (0.8 + 0.4 * r(9)),
      gully: inR(L.gully, 10), rough: L.rough, strata: L.strata,
    };
  }

  private cell(x: number, z: number): { i: number; j: number; tx: number; tz: number } {
    const fx = Math.max(0, Math.min(this.n - 1.001, (x + WORLD.half) / MESA_CELL));
    const fz = Math.max(0, Math.min(this.n - 1.001, (z + WORLD.half) / MESA_CELL));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    return { i, j, tx: fx - i, tz: fz - j };
  }

  /** ลูกที่คลุมจุดนั้น (ช่องใกล้สุด) · null = ไม่มี */
  mesaAt(x: number, z: number): Mesa | null {
    const i = Math.round(Math.max(0, Math.min(this.n - 1, (x + WORLD.half) / MESA_CELL)));
    const j = Math.round(Math.max(0, Math.min(this.n - 1, (z + WORLD.half) / MESA_CELL)));
    const id = this.label[j * this.n + i];
    return id >= 0 ? this.mesas[id] : null;
  }

  /** หน้าตาที่จุดนั้น ผสมสี่ช่องรอบตัว (ขอบระหว่างสองลูกต่อกันเนียน ไม่เป็นขั้น) */
  shapeAt(x: number, z: number): MesaShape {
    const { i, j, tx, tz } = this.cell(x, z);
    const n = this.n;
    const ids = [this.label[j * n + i], this.label[j * n + i + 1], this.label[(j + 1) * n + i], this.label[(j + 1) * n + i + 1]];
    if (ids[0] === ids[1] && ids[0] === ids[2] && ids[0] === ids[3]) return ids[0] >= 0 ? this.mesas[ids[0]] : this.fallback;
    const w = [(1 - tx) * (1 - tz), tx * (1 - tz), (1 - tx) * tz, tx * tz];
    const out = this.mix;
    const keys = Object.keys(this.fallback) as (keyof MesaShape)[];
    for (const key of keys) out[key] = 0;
    for (let k = 0; k < 4; k++) {
      const s = ids[k] >= 0 ? this.mesas[ids[k]] : this.fallback;
      for (const key of keys) out[key] += w[k] * s[key];
    }
    return out;
  }

  /** ความชันของสัญญาณรบกวนแนวผา (ต่อเมตร) จากตาราง · ใช้แปลงค่าสัญญาณเป็นระยะถึงแนวผา */
  private gradAt(x: number, z: number): number {
    const { i, j, tx, tz } = this.cell(x, z);
    const n = this.n;
    const g = this.grad;
    const a = g[j * n + i] + (g[j * n + i + 1] - g[j * n + i]) * tx;
    const b = g[(j + 1) * n + i] + (g[(j + 1) * n + i + 1] - g[(j + 1) * n + i]) * tx;
    return a + (b - a) * tz;
  }

  /** ความสูงที่ภูเขายอดตัดยกพื้นขึ้นที่จุดนั้น (ม.) ก่อนคูณ mesaAway */
  heightAt(x: number, z: number): number {
    const m = this.field(x, z);
    if (m < MESA_TIERS[0] - 0.3) return 0;
    const g = Math.max(GMIN, this.gradAt(x, z));
    const p = this.shapeAt(x, z);
    let out = 0;
    let face = 0;
    for (let tier = 0; tier < MESA_TIERS.length; tier++) {
      const H = tier === 0 ? p.h1 : p.h2;
      const s0 = (m - MESA_TIERS[tier]) / g;
      if (s0 < -80) continue;
      if (s0 > 80) {
        out += H;
        continue;
      }
      const e = escarpment(this.edge(x, z, tier, s0, p), H, p);
      out += e.h;
      face = Math.max(face, e.face);
    }
    // ผิวผนังกับลาดหินร่วงขรุขระเป็นก้อน (เดิมผนังเรียบ เห็นแต่ร่องตั้งเรียงซ้ำ)
    if (face > 0) out += face * p.rough * this.detail.fbm(x / 5.5, z / 5.5, 2);
    return out;
  }

  /**
   * ระยะถึงขอบบนผนัง (ม. บวก = เข้าไปบนยอด) จากระยะตามเส้นโค้งของสัญญาณรบกวน s0
   * ขอบผาหยักเป็นสันกับเว้า · ร่องหุบกัดเข้าไปเป็นช่วง ๆ ลึกถึง 5 ม.
   * หยักกับร่องต้องกว้างพอ: เลื่อนแนวผาได้ไม่เกินราวครึ่งเมตรต่อเมตร (แคบกว่านี้ผนังถูกบีบชันกว่าเดิมสองเท่าและเกิดหลุมแคบ ลองแล้ว 26 ต.ค. 2569)
   */
  private edge(x: number, z: number, tier: number, s0: number, p: MesaShape): number {
    return s0 + p.jag * this.detail.fbm(x / p.jagScale + tier * 17, z / p.jagScale - tier * 9, 2) - 5 * p.gully * smooth(0.35, 0.8, this.detail.noise(x / 80 + tier * 5, z / 80 - 3));
  }

  /**
   * แนวตีนผนังหินของลูกนั้นทีละชั้น (ให้ภาพปั้นผนังหินวางทับ) · เส้นต่อเนื่อง จุดห่างราว 1.8 ม.
   * หาแบบเส้นชั้นความสูงบนตารางทุก 2 ม. · ข้ามช่วงที่ภูเขาถูกกดเตี้ย (ใกล้เมือง ยาน เทือกเขา) กับช่วงที่เตี้ยกว่า minH
   */
  faceLines(mesa: Mesa, tier: number, minH = 6): FacePoint[][] {
    const step = 2;
    const [bx0, bz0, bx1, bz1] = mesa.box;
    const x0 = bx0 - MESA_CELL;
    const z0 = bz0 - MESA_CELL;
    const nx = Math.floor((bx1 - bx0 + 2 * MESA_CELL) / step) + 1;
    const nz = Math.floor((bz1 - bz0 + 2 * MESA_CELL) / step) + 1;
    // ค่าที่ตีนผนังเป็น 0 · บวกเข้าไปในภูเขา · NaN = ไม่ใช่ของลูกนี้หรือเตี้ยเกิน
    const F = (x: number, z: number): number => {
      if (this.mesaAt(x, z)?.id !== mesa.id) return NaN;
      // ใกล้ยาน เมือง เทือกเขา ภูเขาถูกกดเตี้ยลง ปั้นผนังเฉพาะช่วงที่ยังสูงพอ
      const away = mesaAway(x, z);
      const p = this.shapeAt(x, z);
      const H = tier === 0 ? p.h1 : p.h2;
      if (away < 0.4 || H * away < minH) return NaN;
      const fw = faceWidth(H, p);
      const s0 = (this.field(x, z) - MESA_TIERS[tier]) / Math.max(GMIN, this.gradAt(x, z));
      // ไกลแนวผาแน่ ๆ ไม่ต้องคิดหยักกับร่อง (ประหยัดเวลา)
      if (Math.abs(s0 + fw) > 18) return s0 + fw;
      return this.edge(x, z, tier, s0, p) + fw;
    };
    const v = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = F(x0 + i * step, z0 + j * step);
    // เส้นชั้นแบบสี่เหลี่ยมเดินทีละช่อง (มุม a บนซ้าย b บนขวา c ล่างขวา d ล่างซ้าย · ขอบ 0 a-b 1 b-c 2 c-d 3 d-a)
    const segs: number[][] = [];
    const cut = (p: number, q: number) => p / (p - q);
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = v[j * nx + i];
        const b = v[j * nx + i + 1];
        const c = v[(j + 1) * nx + i + 1];
        const d = v[(j + 1) * nx + i];
        if (Number.isNaN(a + b + c + d)) continue;
        const k = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
        if (k === 0 || k === 15) continue;
        const X = x0 + i * step;
        const Z = z0 + j * step;
        const e = (n: number): [number, number] =>
          n === 0 ? [X + step * cut(a, b), Z] : n === 1 ? [X + step, Z + step * cut(b, c)] : n === 2 ? [X + step - step * cut(c, d), Z + step] : [X, Z + step - step * cut(d, a)];
        const centre = (a + b + c + d) / 4 > 0;
        const pairs: number[][] =
          k === 5 ? (centre ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]) : k === 10 ? (centre ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]) : [EDGE_PAIRS[k]];
        for (const [p, q] of pairs) segs.push([...e(p), ...e(q)]);
      }
    }
    // ต่อชิ้นเป็นเส้นยาว
    const key = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`;
    const ends = new Map<string, number[]>();
    segs.forEach((s, i) => {
      for (const k of [key(s[0], s[1]), key(s[2], s[3])]) {
        const l = ends.get(k);
        if (l) l.push(i);
        else ends.set(k, [i]);
      }
    });
    const used = new Uint8Array(segs.length);
    const lines: [number, number][][] = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const line: [number, number][] = [[segs[i][0], segs[i][1]], [segs[i][2], segs[i][3]]];
      // ต่อไปทางปลาย แล้วกลับมาต่อทางต้น
      for (let dir = 0; dir < 2; dir++) {
        for (;;) {
          const tip = dir === 0 ? line[line.length - 1] : line[0];
          const next = (ends.get(key(tip[0], tip[1])) ?? []).find((s) => !used[s]);
          if (next === undefined) break;
          used[next] = 1;
          const s = segs[next];
          const far: [number, number] = key(s[0], s[1]) === key(tip[0], tip[1]) ? [s[2], s[3]] : [s[0], s[1]];
          if (dir === 0) line.push(far);
          else line.unshift(far);
        }
      }
      lines.push(line);
    }
    // เก็บจุดห่างราว 1.8 ม. พร้อมทิศออกนอกภูเขา
    const out: FacePoint[][] = [];
    for (const line of lines) {
      const pts: FacePoint[] = [];
      let carry = 0;
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i];
        const [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = carry; t < len; t += 1.8) {
          const x = ax + ((bx - ax) * t) / len;
          const z = az + ((bz - az) * t) / len;
          const gx = F(x + 0.6, z) - F(x - 0.6, z);
          const gz = F(x, z + 0.6) - F(x, z - 0.6);
          const gl = Math.hypot(gx, gz);
          if (!(gl > 0)) continue;
          const shape = { ...this.shapeAt(x, z) };
          const H = tier === 0 ? shape.h1 : shape.h2;
          pts.push({ x, z, nx: -gx / gl, nz: -gz / gl, fw: faceWidth(H, shape), H, shape });
        }
        carry = Math.max(0, carry + Math.ceil((len - carry) / 1.8) * 1.8 - len);
      }
      if (pts.length >= 3) out.push(pts);
    }
    return out;
  }
}

/** คู่ขอบที่เส้นชั้นตัดผ่าน ตามแบบของมุมที่สูงกว่าแนว (ไม่รวมแบบกำกวม 5 กับ 10) */
const EDGE_PAIRS: number[][] = [[], [3, 0], [0, 1], [3, 1], [1, 2], [], [0, 2], [3, 2], [2, 3], [0, 2], [], [1, 2], [1, 3], [0, 1], [0, 3], []];

let shared: MesaMap | null = null;
/** ภูเขายอดตัดชุดเดียวใช้ร่วมกันทั้งเธรดหลัก (วาดพื้น ปั้นผนังหิน) · สร้างครั้งแรกที่เรียก */
export function sharedMesaMap(): MesaMap {
  return (shared ??= new MesaMap());
}
