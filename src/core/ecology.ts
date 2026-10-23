import { decide, type AnimalMind, type Species } from './animals';

// ระบบนิเวศ (รอบสอง ช่วง 12) · กติกาล้วน ไม่แตะภาพ ไม่แตะหน้าเว็บ
// สัตว์อยู่ตามชนิดพื้นที่ ออกหากินตามช่วงของวัน หลบฝน ลงกินน้ำ ห่วงโซ่อาหาร (หมาป่าล่ากวางกับกระต่าย จิ้งจอกล่ากระต่าย ซากมีอีกา หมีกินผลไม้และจับปลา)
// เป็นพฤติกรรมที่เห็นได้ ไม่จำลองประชากรทั้งแมพ สัตว์ไม่สูญพันธุ์ เกิดใหม่ตามถิ่นรอบผู้เล่น (แผนรอบสอง แคลร์ตัดสินเอง)
// ที่มาของนิสัยสัตว์ docs/REFERENCES-R2.md หัวข้อ 8 กับ 11

/** ชื่อชนิดพื้นที่ (ตรงกับ BIOME ใน world/terrainGen.ts · tests/ecology.test.ts ตรวจว่าตรงกัน) */
export type BiomeName =
  | 'water' | 'shore' | 'meadow' | 'flowers' | 'tallGrass' | 'farmland' | 'wetland' | 'town'
  | 'redwood' | 'rainforest' | 'deciduous' | 'orchard' | 'dense' | 'alpine' | 'rock' | 'snow';

export type DayPart = 'dawn' | 'day' | 'dusk' | 'night';

/** ช่วงของวัน · timeOfDay 0 ถึง 1 (0.5 = เที่ยง) · เช้ามืด 04:30 ถึง 07:30 · พลบค่ำ 17:30 ถึง 20:30 */
export function dayPart(timeOfDay: number): DayPart {
  const h = (((timeOfDay % 1) + 1) % 1) * 24;
  if (h >= 4.5 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 17.5) return 'day';
  if (h >= 17.5 && h < 20.5) return 'dusk';
  return 'night';
}

export type Diet = 'grass' | 'meat' | 'fruit' | 'carrion' | 'insect' | 'nectar' | 'seed';

export interface Eco {
  id: string;
  /** ชนิดพื้นที่ที่ออกหากิน */
  feed: BiomeName[];
  /** ชนิดพื้นที่ที่หลบพัก (ไม่มี = พักที่เดิม) · กวางกลางวันหลบในป่า */
  rest?: BiomeName[];
  /** ช่วงของวันที่ออกไปที่หากิน (นอกช่วงนี้อยู่ที่หลบพัก) · ไม่มี = ทุกช่วงที่ออกมา */
  feedAt?: DayPart[];
  /** อยู่เฉพาะเขตป่าลึก (สัตว์ดุ) */
  wild?: boolean;
  /** ความคึกคักต่อช่วงของวัน 0 ถึง 1 · 0 = ไม่ออกมาเลย ต่ำกว่า 0.4 = ออกมาแต่ส่วนใหญ่พัก */
  activity: Record<DayPart, number>;
  /** ขนาดฝูง ต่ำสุด สูงสุด */
  herd: [number, number];
  /** ฝูงรอบผู้เล่นได้มากสุด */
  groups: number;
  diet: Diet;
  /** เหยื่อ (ล่า) */
  prey?: string[];
  /** ฝนตกแล้วหลบ */
  shelter: boolean;
  /** ลงกินน้ำ */
  drinks: boolean;
}

const A = (dawn: number, day: number, dusk: number, night: number): Record<DayPart, number> => ({ dawn, day, dusk, night });
const OPEN: BiomeName[] = ['meadow', 'flowers', 'tallGrass', 'farmland'];
const WOODS: BiomeName[] = ['deciduous', 'dense', 'orchard', 'redwood', 'town'];

/**
 * นิสัยตามถิ่นและเวลา
 * กวาง: ออกทุ่งตอนเช้ามืดกับพลบค่ำ กลางวันหลบในป่า เป็นฝูงตัวเมียกับลูก · หมาป่า: ฝูง 3 ถึง 6 ตัว ล่ากวางกับกระต่าย
 * หมี: กินพืชเป็นหลัก ลูกไม้ จับปลาที่น้ำตก ออกหากินเช้ากับหัวค่ำ · กระรอก: กลางวัน · กบ: กลางวันหลบ กลางคืนออก
 * นกกิ้งโครง: ฝูงใหญ่เหนือทุ่ง ไร่ เมือง ตอนพลบค่ำ · ผีเสื้อ ผึ้ง: ทุ่งดอกไม้ตอนกลางวัน
 */
export const ECO: Eco[] = [
  { id: 'deer', feed: [...OPEN, 'alpine'], rest: ['deciduous', 'dense', 'orchard', 'redwood'], feedAt: ['dawn', 'dusk', 'night'], activity: A(1, 0.5, 1, 0.35), herd: [3, 6], groups: 2, diet: 'grass', shelter: true, drinks: true },
  { id: 'rabbit', feed: [...OPEN, 'orchard', 'shore'], activity: A(1, 0.6, 1, 0.5), herd: [1, 3], groups: 3, diet: 'grass', shelter: true, drinks: false },
  { id: 'fox', feed: [...OPEN, 'orchard', 'deciduous', 'dense', 'town'], activity: A(0.8, 0.3, 1, 1), herd: [1, 1], groups: 1, diet: 'meat', prey: ['rabbit'], shelter: true, drinks: true },
  { id: 'crow', feed: ['town', 'farmland', 'meadow', 'tallGrass'], activity: A(0.6, 1, 0.6, 0), herd: [2, 5], groups: 2, diet: 'carrion', shelter: true, drinks: false },
  { id: 'eagle', feed: ['alpine', 'rock', 'snow', 'meadow', 'flowers', 'tallGrass', 'redwood'], activity: A(0.3, 1, 0.3, 0), herd: [1, 1], groups: 1, diet: 'meat', shelter: true, drinks: false },
  { id: 'frog', feed: ['shore', 'wetland'], activity: A(0.6, 0.35, 1, 1), herd: [2, 4], groups: 3, diet: 'insect', shelter: false, drinks: false },
  { id: 'owl', feed: ['dense', 'deciduous', 'redwood', 'orchard', 'town'], activity: A(0.3, 0, 0.5, 1), herd: [1, 1], groups: 1, diet: 'meat', shelter: true, drinks: false },
  { id: 'wolf', feed: ['dense', 'redwood', 'deciduous', 'meadow', 'tallGrass', 'rainforest'], wild: true, activity: A(1, 0.6, 1, 1), herd: [3, 6], groups: 1, diet: 'meat', prey: ['deer', 'rabbit'], shelter: false, drinks: true },
  { id: 'bear', feed: ['dense', 'rainforest', 'redwood', 'deciduous', 'shore'], wild: true, activity: A(1, 0.6, 1, 0.25), herd: [1, 1], groups: 1, diet: 'fruit', shelter: true, drinks: true },
  { id: 'starling', feed: ['farmland', 'meadow', 'tallGrass', 'town', 'flowers', 'wetland'], activity: A(0.6, 1, 1, 0), herd: [18, 34], groups: 1, diet: 'insect', shelter: true, drinks: false },
  { id: 'squirrel', feed: [...WOODS, 'alpine'], activity: A(0.7, 1, 0.5, 0), herd: [1, 1], groups: 3, diet: 'seed', shelter: true, drinks: false },
  { id: 'butterfly', feed: ['flowers', 'meadow', 'tallGrass', 'farmland'], activity: A(0, 1, 0, 0), herd: [1, 1], groups: 1, diet: 'nectar', shelter: true, drinks: false },
  { id: 'bee', feed: ['flowers', 'meadow', 'farmland', 'orchard'], activity: A(0, 1, 0, 0), herd: [1, 1], groups: 1, diet: 'nectar', shelter: true, drinks: false },
  { id: 'firefly', feed: ['meadow', 'tallGrass', 'flowers', 'shore', 'wetland'], activity: A(0, 0, 0.4, 1), herd: [1, 1], groups: 1, diet: 'insect', shelter: true, drinks: false },
];

export const ECO_BY_ID = new Map(ECO.map((e) => [e.id, e]));

/** ระยะ ความเร็ว เวลา ของห่วงโซ่อาหาร */
export const FOOD = {
  /** เห็นเหยื่อในระยะนี้ถึงเริ่มล่า */
  huntRange: 70,
  /** เหยื่อเห็นผู้ล่าในระยะนี้แล้ววิ่งหนี (ทั้งฝูง) */
  alarm: 30,
  /** ไล่ได้นานสุด แล้วหมดแรงเลิกไล่ (ล่าไม่สำเร็จ) */
  chaseSeconds: 22,
  /** ย่องเข้าหาเหยื่อจนใกล้เท่านี้ แล้วค่อยวิ่งไล่ · ความเร็วตอนย่อง */
  rushFrom: 20,
  stalkSpeed: 2.2,
  /** ผู้ล่าที่ย่องอยู่ เหยื่อเห็นช้ากว่า (ระยะที่เห็นหารด้วยค่านี้) */
  stalkHidden: 1.7,
  /** ความเร็วตอนล่า (เร็วกว่าตอนไล่คน) */
  huntSpeed: 8,
  /** ถึงตัวเหยื่อแล้ว โอกาสล้มเหยื่อได้ (ที่เหลือเหยื่อดิ้นหลุดวิ่งต่อ) */
  catchChance: 0.4,
  /** ล่าเสร็จหรือพลาดแล้ว พักก่อนล่าใหม่ */
  huntRest: 45,
  /** กินซากนานเท่าไร */
  eatSeconds: 70,
  /** ซากอยู่ได้นานเท่าไร (วินาทีจริง) แล้วหาย · ราว 8 ชั่วโมงในเกม */
  carcassSeconds: 480,
  /** อีกามาที่ซากได้มากสุด */
  carcassCrows: 5,
  /** หิวขึ้นต่อวินาที (เต็ม 1) · กระหายน้ำขึ้นต่อวินาที */
  hungerRate: 1 / 300,
  thirstRate: 1 / 360,
  /** กินน้ำนานเท่าไร · หาที่กินน้ำไกลสุด */
  drinkSeconds: 9,
  drinkSearch: 160,
} as const;

/** งานที่สัตว์ทำอยู่ · flee chase return มาจากการเห็นผู้เล่น (core/animals.ts decide) */
export type Task = 'wander' | 'graze' | 'rest' | 'drink' | 'hunt' | 'eat' | 'forage' | 'fish' | 'shelter' | 'flee' | 'chase' | 'return';

export interface EcoMind extends AnimalMind {
  task: Task;
  /** ทำงานนี้มานานเท่าไร */
  taskTime: number;
  hunger: number;
  thirst: number;
  /** พักก่อนล่าครั้งถัดไป */
  huntRest: number;
  /** ล่า: วิ่งไล่มาแล้วกี่วินาที · -1 = ยังย่องเข้าหาเหยื่ออยู่ (หมาป่าย่องเข้าใกล้ก่อน แล้วค่อยวิ่งไล่) */
  rush: number;
}

export function newEcoMind(hunger = 0.5, thirst = 0.5): EcoMind {
  return { mode: 'wander', sticky: 0, scared: 0, enraged: false, rage: 0, cooldown: 0, task: 'wander', taskTime: 0, hunger, thirst, huntRest: 0, rush: -1 };
}

/** สิ่งที่สัตว์รับรู้ได้ในเฟรมนี้ */
export interface Sense {
  part: DayPart;
  /** ฝน 0 ถึง 1 */
  rain: number;
  /** ระยะถึงผู้เล่น · Infinity เมื่อผู้เล่นอยู่คนละชั้น (ในถ้ำ บนหลังคา) ไล่ไม่ถึง */
  player: number;
  /** ระยะถึงผู้ล่าที่ใกล้สุด (ไม่มี = Infinity) */
  predator: number;
  /** ระยะถึงเหยื่อที่ใกล้สุด */
  prey: number;
  /** ระยะถึงซากที่ใกล้สุด */
  carcass: number;
  /** ระยะถึงอาหารพิเศษ (หมี: ต้นผลไม้ หรือน้ำตก) */
  food: number;
  /** อาหารพิเศษนั้นคือน้ำตกที่จับปลาได้ */
  fishing: boolean;
  /** ระยะจากที่อยู่ */
  fromHome: number;
  /** ตอนนี้อยู่ในที่หลบพักแล้ว */
  inRest: boolean;
}

/** หิว กระหาย ตัวนับเวลา เดินไปทุกเฟรม */
function tick(m: EcoMind, dt: number): void {
  m.hunger = Math.min(1, m.hunger + FOOD.hungerRate * dt);
  m.thirst = Math.min(1, m.thirst + FOOD.thirstRate * dt);
  m.huntRest = Math.max(0, m.huntRest - dt);
  m.taskTime += dt;
  if (m.rush >= 0) m.rush += dt;
}

function set(m: EcoMind, t: Task): Task {
  if (m.task !== t) { m.task = t; m.taskTime = 0; m.rush = -1; }
  return t;
}

/**
 * ตัดสินใจหนึ่งก้าวของสัตว์ใหญ่
 * ลำดับ: ผู้เล่น (หนี ไล่ กลับบ้าน) → ผู้ล่าใกล้ (หนี) → งานที่ทำค้างอยู่ (กิน ดื่ม) → หิวแล้วล่า → ฝนตกหลบ → กระหายน้ำ → ตามเวลา (พัก หากิน)
 */
export function think(m: EcoMind, s: Species, e: Eco, sense: Sense, dt: number): Task {
  tick(m, dt);
  const mode = decide(m, s, dt, sense.player, sense.fromHome);
  if (mode === 'flee' || mode === 'chase') return set(m, mode);
  // เหยื่อเห็นผู้ล่าใกล้ วิ่งหนีทั้งฝูง (App ส่งความตกใจต่อให้ทั้งฝูง)
  if (sense.predator < FOOD.alarm) {
    m.scared = Math.max(m.scared, 4);
    return set(m, 'flee');
  }
  // งานที่ยังไม่เสร็จ (ทำต่อได้แม้ออกห่างที่อยู่ ล่าเสร็จแล้วค่อยกลับ) · ความหิวกับความกระหายลดลงตอนกินหรือดื่มอยู่ที่จุดนั้น (App ลดให้ด้วย eatAt drinkAt)
  if (m.task === 'eat') {
    if (m.hunger > 0.03 && sense.carcass < 45) return 'eat';
    m.huntRest = FOOD.huntRest;
  }
  if (m.task === 'drink' && m.thirst > 0.03 && m.taskTime < 70) return 'drink';
  if ((m.task === 'forage' || m.task === 'fish') && m.hunger > 0.03 && m.taskTime < 120 && sense.food < 80) return m.task;
  if (m.task === 'hunt') {
    // ย่องได้นานสุดนาทีหนึ่ง · วิ่งไล่ได้ไม่เกิน chaseSeconds แล้วหมดแรง
    if (sense.prey < FOOD.huntRange && (m.rush < 0 ? m.taskTime < 60 : m.rush < FOOD.chaseSeconds)) return 'hunt';
    m.huntRest = FOOD.huntRest; // หมดแรงหรือเหยื่อหนีพ้น = ล่าพลาด
    m.rush = -1;
  }
  // ซากอยู่ใกล้ ผู้ล่ากับอีกาเข้าไปกินได้แม้อยู่นอกเขต
  if ((e.diet === 'meat' || e.diet === 'carrion') && sense.carcass < 45 && m.hunger > 0.15) return set(m, 'eat');
  if (mode === 'return') return set(m, 'return');
  // หิวแล้วออกล่า
  if (e.prey && m.hunger > 0.45 && m.huntRest <= 0 && sense.prey < FOOD.huntRange && e.activity[sense.part] >= 0.4) return set(m, 'hunt');
  if (sense.rain > 0.4 && e.shelter) return set(m, sense.inRest || !e.rest ? 'rest' : 'shelter');
  if (e.drinks && m.thirst > 0.85) return set(m, 'drink');
  const act = e.activity[sense.part];
  if (act < 0.4) return set(m, e.rest && !sense.inRest ? 'shelter' : 'rest');
  // ช่วงไม่ออกหากิน (กวางตอนกลางวัน) อยู่ในที่หลบ เดินช้า ๆ เล็มอยู่ที่นั่น
  if (e.feedAt && !e.feedAt.includes(sense.part) && e.rest && !sense.inRest) return set(m, 'shelter');
  if (e.diet === 'fruit' && m.hunger > 0.35 && sense.food < 80) return set(m, sense.fishing ? 'fish' : 'forage');
  if (e.diet === 'grass') {
    // สลับเดินกับเล็มหญ้า ช่วงละไม่กี่วินาที
    if (m.task === 'graze' && m.taskTime < 9) return 'graze';
    if (m.task === 'wander' && m.taskTime > 5) return set(m, 'graze');
    if (m.task !== 'graze' && m.task !== 'wander') return set(m, 'wander');
    return m.task;
  }
  return set(m, 'wander');
}

/** ความคึกคักตอนนี้ (ฝนตกสัตว์ที่หลบฝนออกมาน้อยลง · กบชอบฝน) */
export function activityNow(e: Eco, part: DayPart, rain: number): number {
  let a = e.activity[part];
  if (rain > 0.3) a *= e.shelter ? 0.35 : 1.3;
  return Math.min(1, a);
}

/** จำนวนฝูงที่ควรมีรอบผู้เล่นตอนนี้ */
export function groupsWanted(e: Eco, part: DayPart, rain: number): number {
  const a = activityNow(e, part, rain);
  if (a <= 0.05) return 0;
  return Math.max(1, Math.round(e.groups * Math.min(1, a + 0.2)));
}

/** ขนาดฝูงจากเลขสุ่ม 0 ถึง 1 · นกกิ้งโครงตอนพลบค่ำรวมฝูงใหญ่ขึ้น */
export function herdSize(e: Eco, r: number, part: DayPart = 'day'): number {
  const [lo, hi] = e.herd;
  const n = Math.round(lo + (hi - lo) * r);
  return e.id === 'starling' && part === 'dusk' ? Math.round(n * 1.6) : n;
}

/**
 * เลือกเหยื่อตัวหลงฝูง · หมาป่าแยกตัวที่อยู่ห่างกลางฝูงที่สุดออกมา (ตัวที่อ่อนแอหรือหลงฝูง)
 * @returns ลำดับในรายการ (-1 = ไม่มี)
 */
export function pickStraggler(xs: number[], zs: number[], hunterX: number, hunterZ: number): number {
  const n = xs.length;
  if (!n) return -1;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) { cx += xs[i]; cz += zs[i]; }
  cx /= n;
  cz /= n;
  let best = -1;
  let score = -Infinity;
  for (let i = 0; i < n; i++) {
    // ห่างกลางฝูงมาก + ใกล้ผู้ล่า = เป้าหมาย
    const s = Math.hypot(xs[i] - cx, zs[i] - cz) * 2 - Math.hypot(xs[i] - hunterX, zs[i] - hunterZ) * 0.5;
    if (s > score) { score = s; best = i; }
  }
  return best;
}

/**
 * ทิศวิ่งหนี · ถ้าเลยขอบแมพ หักขนานกับขอบแทน ไม่วิ่งชนขอบอยู่กับที่ (รายงานตรวจข้อ 102)
 * @returns ทิศหนึ่งหน่วย [x, z]
 */
export function fleeDir(x: number, z: number, fromX: number, fromZ: number, half: number, margin = 25, look = 20): [number, number] {
  let ux = x - fromX;
  let uz = z - fromZ;
  const l = Math.hypot(ux, uz) || 1;
  ux /= l;
  uz /= l;
  if (Math.abs(x + ux * look) > half - margin) ux = 0;
  if (Math.abs(z + uz * look) > half - margin) uz = 0;
  if (ux === 0 && uz === 0) {
    // อยู่มุมแมพ หนีเข้ากลางแมพ
    ux = -Math.sign(x) || 1;
    uz = -Math.sign(z) || 1;
  } else if (ux === 0) uz = uz >= 0 ? 1 : -1;
  else if (uz === 0) ux = ux >= 0 ? 1 : -1;
  const k = Math.hypot(ux, uz);
  return [ux / k, uz / k];
}

/**
 * จุดเกิดอยู่นอกสายตาไหม (รายงานตรวจข้อ 101) · หลังกล้องหรือข้าง ๆ เลยมุมมอง หรือไกลจนหมอกบัง
 * @param fx fz ทิศกล้องตามแนวนอน (หนึ่งหน่วย)
 */
export function outOfView(dx: number, dz: number, fx: number, fz: number, far = 160): boolean {
  const d = Math.hypot(dx, dz);
  if (d > far) return true;
  if (d < 1e-6) return false;
  // มุมมองแนวนอนของจอกว้างราว ±50° · เผื่อหัวหมุนอีกหน่อย ใช้ ±62°
  return (dx * fx + dz * fz) / d < 0.47;
}

/** ฝูงนกแบบ boids หนึ่งก้าว · pos vel เป็นอาร์เรย์ x y z ต่อตัว · บินตามเป้าหมาย ไม่ชนกัน รวมกลุ่ม */
export interface FlockParams {
  /** ระยะที่เริ่มหลบเพื่อนข้าง ๆ */
  sep: number;
  /** ระยะที่มองเห็นเพื่อนในฝูง */
  see: number;
  /** ความเร็วต่ำสุด สูงสุด */
  minSpeed: number;
  maxSpeed: number;
  /** แรงดึงเข้าหาเป้า */
  pull: number;
  /** ความแน่นของฝูง (พลบค่ำบินแน่นขึ้น เป็นรูปร่าง) */
  cohesion: number;
}

export function flockStep(pos: Float32Array, vel: Float32Array, n: number, tx: number, ty: number, tz: number, dt: number, p: FlockParams): void {
  const see2 = p.see * p.see;
  const sep2 = p.sep * p.sep;
  for (let i = 0; i < n; i++) {
    const ix = i * 3;
    let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0, k = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const jx = j * 3;
      const dx = pos[jx] - pos[ix];
      const dy = pos[jx + 1] - pos[ix + 1];
      const dz = pos[jx + 2] - pos[ix + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > see2) continue;
      k++;
      cx += dx; cy += dy; cz += dz;
      ax += vel[jx]; ay += vel[jx + 1]; az += vel[jx + 2];
      if (d2 < sep2 && d2 > 1e-6) { const w = 1 / d2; sx -= dx * w; sy -= dy * w; sz -= dz * w; }
    }
    let fx = 0, fy = 0, fz = 0;
    if (k) {
      fx += (cx / k) * p.cohesion + (ax / k - vel[ix]) * 0.9 + sx * 2.2;
      fy += (cy / k) * p.cohesion + (ay / k - vel[ix + 1]) * 0.9 + sy * 2.2;
      fz += (cz / k) * p.cohesion + (az / k - vel[ix + 2]) * 0.9 + sz * 2.2;
    }
    fx += (tx - pos[ix]) * p.pull;
    fy += (ty - pos[ix + 1]) * p.pull * 1.6;
    fz += (tz - pos[ix + 2]) * p.pull;
    vel[ix] += fx * dt;
    vel[ix + 1] += fy * dt;
    vel[ix + 2] += fz * dt;
    const v = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]) || 1;
    const c = v > p.maxSpeed ? p.maxSpeed / v : v < p.minSpeed ? p.minSpeed / v : 1;
    vel[ix] *= c;
    vel[ix + 1] *= c;
    vel[ix + 2] *= c;
  }
  for (let i = 0; i < n * 3; i++) pos[i] += vel[i] * dt;
}
