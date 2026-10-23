import { BIOME, type BiomeId } from './terrainGen';

// ต้นไม้ 19 ชนิด (รอบสอง ช่วง 4) · ความสูงในเกมใช้ช่วงกลางของแต่ละชนิดจาก docs/REFERENCES-R2.md หัวข้อ 2
// กติกาล้วน ไม่แตะภาพ · รูปร่างจริงปั้นใน render/models/trees.ts ตาม form

/** แบบรูปร่าง (ตัวปั้นรูปร่างใช้ร่วมกันได้หลายชนิด) */
export type TreeForm =
  | 'pine' // ลำต้นยาวโล่ง ยอดเป็นก้อนใบ (สนสก็อต)
  | 'redwood' // ลำต้นตรงอวบมาก กิ่งสั้นเฉพาะช่วงบน
  | 'spruce' // กรวยแน่น กิ่งย่อยห้อย
  | 'fir' // กรวยสมมาตรเป็นชั้น
  | 'broad' // พุ่มแผ่กว้าง (โอ๊ก มะม่วง)
  | 'tallBroad' // ลำต้นสูง พุ่มแคบกว่า (เมเปิล บีช อัลเดอร์)
  | 'birch' // ลำต้นขาว พุ่มโปร่ง
  | 'weeping' // กิ่งห้อยเป็นม่าน (หลิว)
  | 'fig' // รากพันเป็นตาข่าย พุ่มใหญ่
  | 'emergent' // ลำต้นตรงสูงมาก พุ่มกลมบนยอด (ยางนา)
  | 'palm' // ใบรวมที่ยอด
  | 'treeFern' // ลำต้นเส้นใย ใบขนนกใหญ่
  | 'bamboo' // กอลำชิดกัน
  | 'blossom' // พุ่มกลางมีดอกเต็มต้น (นางพญาเสือโคร่ง จาคารันดา)
  | 'orchard'; // ต้นเตี้ยกิ่งรก มีผล (แอปเปิล)

export interface TreeSpecies {
  id: string;
  form: TreeForm;
  /** ความสูงในเกม ต่ำสุด สูงสุด (เมตร) */
  height: [number, number];
  /** รัศมีลำต้นที่โคนต่อความสูง 10 ม. (ใช้ทำตัวชน) */
  trunk: number;
  /** สีใบ (สีหลัก สีแซม) · ดอกหรือผลถ้ามี */
  leaf: [number, number];
  bloom?: number;
  fruit?: number;
  conifer: boolean;
  /** ชนิดในคอลเลกชันที่ใช้ข้อความสแกนไปก่อน (ช่วง 12 ทำข้อความสแกนของทุกชนิด) */
  scanKind: 'pine' | 'oak' | 'birch' | 'dead';
}

export const TREE_SPECIES: TreeSpecies[] = [
  { id: 'scotsPine', form: 'pine', height: [18, 30], trunk: 0.3, leaf: [0x2e4a2c, 0x3a5530], conifer: true, scanKind: 'pine' },
  { id: 'redwood', form: 'redwood', height: [55, 85], trunk: 0.42, leaf: [0x2a4228, 0x324c2c], conifer: true, scanKind: 'pine' },
  { id: 'spruce', form: 'spruce', height: [28, 42], trunk: 0.32, leaf: [0x1f3a26, 0x284430], conifer: true, scanKind: 'pine' },
  { id: 'fir', form: 'fir', height: [28, 42], trunk: 0.3, leaf: [0x23402c, 0x2c4b33], conifer: true, scanKind: 'pine' },
  { id: 'oak', form: 'broad', height: [15, 24], trunk: 0.55, leaf: [0x3c5a26, 0x47662c], conifer: false, scanKind: 'oak' },
  { id: 'birch', form: 'birch', height: [14, 22], trunk: 0.22, leaf: [0x6c8a35, 0x7d9940], conifer: false, scanKind: 'birch' },
  { id: 'maple', form: 'tallBroad', height: [18, 28], trunk: 0.4, leaf: [0x8a4a1e, 0x4a6a28], conifer: false, scanKind: 'oak' },
  { id: 'beech', form: 'tallBroad', height: [20, 30], trunk: 0.42, leaf: [0x4f6e2a, 0x5d7a30], conifer: false, scanKind: 'oak' },
  { id: 'willow', form: 'weeping', height: [12, 20], trunk: 0.5, leaf: [0x7a9a42, 0x8aa84c], conifer: false, scanKind: 'oak' },
  { id: 'alder', form: 'tallBroad', height: [14, 24], trunk: 0.36, leaf: [0x34502a, 0x3e5c2e], conifer: false, scanKind: 'oak' },
  { id: 'fig', form: 'fig', height: [24, 34], trunk: 0.9, leaf: [0x2a4a22, 0x335626], conifer: false, scanKind: 'oak' },
  { id: 'yangNa', form: 'emergent', height: [34, 50], trunk: 0.55, leaf: [0x35532a, 0x3f5e2e], conifer: false, scanKind: 'oak' },
  { id: 'palm', form: 'palm', height: [7, 13], trunk: 0.2, leaf: [0x3d6a2a, 0x4a7630], conifer: false, scanKind: 'oak' },
  { id: 'treeFern', form: 'treeFern', height: [3.5, 7], trunk: 0.18, leaf: [0x3f6e2c, 0x4c7a32], conifer: false, scanKind: 'oak' },
  { id: 'bamboo', form: 'bamboo', height: [14, 24], trunk: 1.0, leaf: [0x6a8a36, 0x7a9a40], conifer: false, scanKind: 'oak' },
  { id: 'cherry', form: 'blossom', height: [8, 15], trunk: 0.32, leaf: [0x4a6a2a, 0x557230], bloom: 0xe8a6c4, conifer: false, scanKind: 'oak' },
  { id: 'jacaranda', form: 'blossom', height: [8, 15], trunk: 0.3, leaf: [0x4e6e2c, 0x5a7832], bloom: 0x8a6ad0, conifer: false, scanKind: 'oak' },
  { id: 'apple', form: 'orchard', height: [4, 8], trunk: 0.3, leaf: [0x4a6a2a, 0x56742e], fruit: 0xb8322a, conifer: false, scanKind: 'oak' },
  { id: 'mango', form: 'broad', height: [10, 18], trunk: 0.5, leaf: [0x2c4a20, 0x365424], fruit: 0xb8b040, conifer: false, scanKind: 'oak' },
];
export const SPECIES_BY_ID = new Map(TREE_SPECIES.map((s) => [s.id, s]));

/** ต้นตายยืนต้น 2 แบบ (สนตาย กิ่งหักเป็นตอ · ไม้ใบกว้างตาย กิ่งเปล่า) */
export const DEAD_KINDS = ['deadConifer', 'deadBroad'] as const;
export type DeadKind = (typeof DEAD_KINDS)[number];
export type TreeKind = string;

/** ทุกชนิดที่มีชุดวาดของตัวเอง (19 ชนิด + ต้นตาย 2 แบบ) */
export const ALL_TREE_KINDS: TreeKind[] = [...TREE_SPECIES.map((s) => s.id), ...DEAD_KINDS];

/** ชนิดที่ขึ้นในแต่ละพื้นที่ พร้อมน้ำหนัก (ป่า 5 แบบตามแผน) */
const MIX: Partial<Record<BiomeId, [string, number][]>> = {
  [BIOME.redwood]: [['redwood', 70], ['spruce', 14], ['fir', 10], ['treeFern', 6]],
  [BIOME.rainforest]: [['yangNa', 14], ['fig', 15], ['palm', 20], ['treeFern', 16], ['bamboo', 14], ['mango', 9], ['jacaranda', 6], ['cherry', 6]],
  [BIOME.deciduous]: [['oak', 30], ['maple', 25], ['beech', 25], ['birch', 14], ['cherry', 6]],
  [BIOME.orchard]: [['birch', 45], ['oak', 25], ['scotsPine', 20], ['maple', 10]],
  [BIOME.dense]: [['scotsPine', 24], ['spruce', 20], ['oak', 20], ['birch', 14], ['beech', 12], ['maple', 10]],
  [BIOME.alpine]: [['fir', 50], ['spruce', 30], ['scotsPine', 20]],
  [BIOME.wetland]: [['willow', 40], ['alder', 45], ['birch', 15]],
  [BIOME.shore]: [['willow', 45], ['alder', 45], ['birch', 10]],
  [BIOME.town]: [['birch', 35], ['maple', 25], ['jacaranda', 22], ['cherry', 18]],
  [BIOME.farmland]: [['oak', 50], ['birch', 30], ['cherry', 20]],
};
const OPEN: [string, number][] = [['oak', 38], ['birch', 22], ['cherry', 14], ['jacaranda', 6], ['maple', 12], ['scotsPine', 8]];

/** เลือกชนิดจากเลขสุ่ม 0 ถึง 1 · ใกล้น้ำเป็นไม้ริมน้ำ */
export function pickSpecies(biome: BiomeId, r: number, nearWater: boolean): TreeSpecies {
  const mix = nearWater && biome !== BIOME.rainforest && biome !== BIOME.redwood ? MIX[BIOME.shore]! : MIX[biome] ?? OPEN;
  let total = 0;
  for (const [, w] of mix) total += w;
  let x = r * total;
  for (const [id, w] of mix) {
    x -= w;
    if (x <= 0) return SPECIES_BY_ID.get(id)!;
  }
  return SPECIES_BY_ID.get(mix[mix.length - 1][0])!;
}

/** สวนผลไม้ร้าง: แถวปลูกเดิม แอปเปิลกับมะม่วง (แถวหันตามมุมนี้ ระยะในแถว ระยะระหว่างแถว) */
export const ORCHARD_ROWS = { angle: 0.32, along: 6.5, across: 8 } as const;

/** ชนิดของต้นตาย ตามชนิดต้นเดิม */
export const deadKindOf = (s: TreeSpecies): DeadKind => (s.conifer ? 'deadConifer' : 'deadBroad');

/** ชนิดในคอลเลกชันที่ใช้ข้อความสแกน */
export function scanKindOf(kind: TreeKind): 'pine' | 'oak' | 'birch' | 'dead' {
  if (kind === 'deadConifer' || kind === 'deadBroad') return 'dead';
  return SPECIES_BY_ID.get(kind)?.scanKind ?? 'oak';
}

/** รัศมีตัวชนลำต้นที่โคน (เมตร) ตามความสูงจริงของต้น */
export function trunkRadius(kind: TreeKind, height: number): number {
  if (kind === 'deadConifer' || kind === 'deadBroad') return 0.03 * height;
  const s = SPECIES_BY_ID.get(kind)!;
  return Math.min(1.6, (s.trunk * height) / 10 + 0.08);
}
