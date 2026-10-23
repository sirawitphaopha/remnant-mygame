import { BIOME, type BiomeId } from './terrainGen';

// พุ่มไม้ 6 ชนิด (รอบสอง · พี่กันทักว่าพุ่มไม้เป็นก้อนกลมเขียว ๆ ชนิดเดียว อยากให้หลายชนิด ต่างกัน และละเอียด)
// กติกาล้วน ไม่แตะภาพ · ชนิดเลือกตามป่าแต่ละแบบ · โมเดลอยู่ใน render/models/shrubs.ts

export const SHRUB_IDS = ['hazel', 'elder', 'dogRose', 'juniper', 'bramble', 'rhododendron'] as const;
export type ShrubId = (typeof SHRUB_IDS)[number];

/** สัดส่วนชนิดพุ่มไม้ในแต่ละชนิดพื้นที่ (ไม่อยู่ในตาราง = ทุ่งทั่วไป) */
const MIX: Partial<Record<BiomeId, [ShrubId, number][]>> = {
  [BIOME.rainforest]: [['rhododendron', 60], ['elder', 25], ['bramble', 15]],
  [BIOME.redwood]: [['rhododendron', 45], ['hazel', 30], ['elder', 25]],
  [BIOME.dense]: [['hazel', 35], ['elder', 25], ['bramble', 25], ['juniper', 15]],
  [BIOME.deciduous]: [['hazel', 40], ['elder', 25], ['dogRose', 20], ['bramble', 15]],
  [BIOME.alpine]: [['juniper', 85], ['dogRose', 15]],
  [BIOME.town]: [['bramble', 40], ['elder', 30], ['dogRose', 20], ['hazel', 10]],
  [BIOME.farmland]: [['bramble', 35], ['dogRose', 30], ['hazel', 20], ['elder', 15]],
  [BIOME.wetland]: [['elder', 50], ['bramble', 30], ['hazel', 20]],
};
const OPEN: [ShrubId, number][] = [['dogRose', 30], ['bramble', 30], ['hazel', 25], ['juniper', 15]];

/** เลือกชนิดพุ่มไม้ตามชนิดพื้นที่ · r = เลขสุ่ม 0 ถึง 1 ของจุดนั้น */
export function pickShrub(biome: BiomeId, r: number): number {
  const mix = MIX[biome] ?? OPEN;
  let total = 0;
  for (const [, w] of mix) total += w;
  let x = r * total;
  for (const [id, w] of mix) {
    x -= w;
    if (x <= 0) return SHRUB_IDS.indexOf(id);
  }
  return SHRUB_IDS.indexOf(mix[mix.length - 1][0]);
}
