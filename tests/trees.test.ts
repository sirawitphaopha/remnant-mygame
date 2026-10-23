import { describe, expect, it } from 'vitest';
import { treeModel } from '../src/render/models/trees';
import { CircleColliders } from '../src/world/colliders';
import { REGIONS } from '../src/world/layout';
import { scatterDebris, scatterTrees } from '../src/world/scatter';
import { Terrain } from '../src/world/Terrain';
import { BIOME } from '../src/world/terrainGen';
import { ALL_TREE_KINDS, ORCHARD_ROWS, TREE_SPECIES } from '../src/world/trees';

// ต้นไม้ 19 ชนิดกับป่า 5 แบบ (รอบสอง ช่วง 4)
const t = new Terrain();
const sets = scatterTrees(t);
const by = new Map(sets.map((s) => [s.kind, s.items]));

describe('ต้นไม้', () => {
  it('ครบ 19 ชนิดตามแผน และมีต้นตายทั้งสองแบบ', () => {
    expect(TREE_SPECIES.length).toBe(19);
    for (const k of ALL_TREE_KINDS) expect(by.get(k)!.length, k).toBeGreaterThan(0);
  });
  it('ความสูงตามชนิด: สนยักษ์ 55 ถึง 85 ม. แอปเปิลไม่เกิน 8 ม.', () => {
    for (const p of by.get('redwood')!) expect(p.scale * 10).toBeGreaterThanOrEqual(55);
    for (const p of by.get('apple')!) expect(p.scale * 10).toBeLessThanOrEqual(8);
  });
  it('ป่าแต่ละแบบมีชนิดของตัวเอง (สนยักษ์ในป่าสนยักษ์ ยางนาในหุบป่าดิบชื้น)', () => {
    const at = (k: string) => by.get(k)!.map((p) => t.biomeAt(p.x, p.z));
    expect(at('redwood').every((b) => b === BIOME.redwood)).toBe(true);
    expect(at('yangNa').filter((b) => b === BIOME.rainforest).length / at('yangNa').length).toBeGreaterThan(0.8);
  });
  it('ป่าที่เคยเป็นไร่: แอปเปิลเรียงเป็นแถวตามแนวปลูกเดิม', () => {
    const o = REGIONS.orchard;
    const ca = Math.cos(ORCHARD_ROWS.angle);
    const sa = Math.sin(ORCHARD_ROWS.angle);
    const apples = by.get('apple')!;
    expect(apples.length).toBeGreaterThan(50);
    // ระยะข้ามแถว (แกนตั้งฉากกับแถว) ตกบนแถว ห่างไม่เกินที่ขยับสุ่ม
    for (const p of apples) {
      const c = -(p.x - o.x) * sa + (p.z - o.z) * ca;
      const off = Math.abs(c / ORCHARD_ROWS.across - Math.round(c / ORCHARD_ROWS.across)) * ORCHARD_ROWS.across;
      expect(off).toBeLessThan(0.7);
    }
  });
  it('ขอนไม้ ตอไม้ ต้นล้มทั้งราก อยู่ในป่าเท่านั้น', () => {
    const d = scatterDebris(t);
    expect(d.log.length + d.stump.length + d.uprooted.length).toBeGreaterThan(500);
    for (const p of d.log.slice(0, 200)) expect([BIOME.meadow, BIOME.flowers, BIOME.town, BIOME.snow].includes(t.biomeAt(p.x, p.z) as never)).toBe(false);
  });
  it('ปั้นโมเดลได้ทุกชนิดทุกระดับ ระดับไกลมากเบาสุด', () => {
    for (const k of ALL_TREE_KINDS) {
      const tris = (['near', 'mid', 'far', 'distant'] as const).map((lod) => {
        const m = treeModel(k, lod);
        const n = (g: { index: { count: number } | null; getAttribute(n: string): { count: number } } | null) => (g ? (g.index ? g.index.count : g.getAttribute('position').count) / 3 : 0);
        return n(m.wood) + n(m.leaves);
      });
      expect(tris[3], k).toBeLessThan(tris[0]);
      expect(tris[3], k).toBeLessThan(60);
    }
  });
});

describe('ยืนบนหินกับขอนไม้', () => {
  it('เท้าถึงยอดแล้วยืนบนยอดได้ · เท้าต่ำกว่ายอดมากไม่นับ', () => {
    const c = new CircleColliders();
    c.add({ x: 0, z: 0, r: 1.2, top: 0.8, stand: true, y0: 10 });
    expect(c.standAt(0.2, 0, 10.7)).toBeCloseTo(10.8);
    expect(c.standAt(0.2, 0, 10.1)).toBe(-Infinity);
    expect(c.standAt(3, 0, 10.8)).toBe(-Infinity);
  });
});
