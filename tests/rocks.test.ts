import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/game';
import { RIVER, RIVER_WIDTH, LAKE, distToPolyline } from '../src/world/layout';
import { ROCK_TYPES, rockTypeOf, scatterRocks } from '../src/world/rocks';
import { BIOME } from '../src/world/terrainGen';
import { Terrain } from '../src/world/Terrain';

// ก้อนหินตามที่เกิดจริง (docs/REFERENCES-R2.md หัวข้อ 10)
const t = new Terrain();
const rocks = scatterRocks(t);
const of = (type: string) => rocks.filter((r) => rockTypeOf(r.variant) === type);

describe('ก้อนหิน', () => {
  it('มีครบ 6 ชนิด จำนวนไม่เกินที่วาดไหว', () => {
    for (const type of ROCK_TYPES) expect(of(type).length, type).toBeGreaterThan(50);
    expect(rocks.length).toBeLessThan(25000);
  });
  it('ไม่มีหินในเมือง บนหิมะ หรือในน้ำ', () => {
    for (const r of rocks) {
      const b = t.biomeAt(r.x, r.z);
      expect(b === BIOME.town || b === BIOME.snow).toBe(false);
      expect(r.y).toBeGreaterThan(WORLD.waterLevel);
    }
  });
  it('ก้อนกลมเกลี้ยงอยู่ริมแม่น้ำหรือทะเลสาบ', () => {
    for (const r of of('river')) {
      const near = distToPolyline(r.x, r.z, RIVER) < RIVER_WIDTH + 12 || Math.hypot(r.x - LAKE.x, r.z - LAKE.z) < LAKE.radius + 36;
      expect(near).toBe(true);
    }
  });
  it('เศษหินร่วงส่วนใหญ่อยู่ใต้หน้าผา ลานหินคัดขนาด ห่างผาก้อนใหญ่กว่า', () => {
    const scree = of('scree');
    let underCliff = 0;
    for (const r of scree) {
      const n = t.normalAt(r.x, r.z);
      const hl = Math.hypot(n[0], n[2]) || 1;
      const ux = -n[0] / hl;
      const uz = -n[2] / hl;
      if ([8, 17, 27, 35].some((d) => t.slopeAt(r.x + ux * d, r.z + uz * d) > 0.6)) underCliff++;
    }
    expect(underCliff / scree.length).toBeGreaterThan(0.6);
  });
});
