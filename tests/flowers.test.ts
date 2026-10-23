import { describe, expect, it } from 'vitest';
import { flowerGeometry } from '../src/render/models/flowers';
import { FLOWER_IDS, flowersInTile, grassHeightAt, type FlowerId } from '../src/world/flowers';
import { REGIONS } from '../src/world/layout';
import { Terrain } from '../src/world/Terrain';
import { BIOME } from '../src/world/terrainGen';

// หญ้าสูง ทุ่งดอกไม้ 13 ชนิด (รอบสอง ช่วง 5)
const t = new Terrain();

describe('ดอกไม้กับหญ้าสูง', () => {
  it('ดอกไม้ 13 ชนิด ปั้นโมเดลได้ทุกชนิด', () => {
    expect(FLOWER_IDS.length).toBe(13);
    for (const id of FLOWER_IDS) expect(flowerGeometry(id).getAttribute('position').count, id).toBeGreaterThan(10);
  });
  it('ทุ่งดอกไม้ขึ้นเป็นดงหนาแน่น ดงละชนิด และพบหลายชนิดทั่วทุ่ง', () => {
    const r = REGIONS.flowers;
    const kinds = new Set<FlowerId>();
    let total = 0;
    let mono = 0;
    let tiles = 0;
    for (let x = r.x - 300; x < r.x + 300; x += 48) {
      for (let z = r.z - 140; z < r.z + 140; z += 48) {
        if (t.biomeAt(x + 8, z + 8) !== BIOME.flowers) continue;
        const spots = flowersInTile(t, x, z, 16);
        if (spots.length < 40) continue;
        tiles++;
        total += spots.length;
        const c = new Map<FlowerId, number>();
        for (const s of spots) { kinds.add(s.kind); c.set(s.kind, (c.get(s.kind) ?? 0) + 1); }
        if (Math.max(...c.values()) / spots.length > 0.7) mono++;
      }
    }
    expect(tiles).toBeGreaterThan(5);
    expect(total / tiles).toBeGreaterThan(80);
    expect(mono / tiles).toBeGreaterThan(0.6);
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });
  it('ทานตะวันหันทิศตะวันออก (ดอกแก่ตามแหล่งอ้างอิง)', () => {
    const r = REGIONS.flowers;
    let found = 0;
    for (let x = r.x - 400; x < r.x + 400 && found < 30; x += 16) for (let z = r.z - 200; z < r.z + 200 && found < 30; z += 16) {
      for (const s of flowersInTile(t, x, z, 16)) if (s.kind === 'sunflower') { found++; expect(Math.abs(s.rot + Math.PI / 2)).toBeLessThan(0.3); }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('ทุ่งหญ้าสูงถึงอกเอเลี่ยน (0.75 ม. ขึ้นไป) · บนเขาหญ้าเตี้ย', () => {
    const r = REGIONS.tallGrass;
    for (let k = 0; k < 40; k++) {
      const x = r.x + (k % 8) * 20 - 80;
      const z = r.z + Math.floor(k / 8) * 15 - 30;
      if (t.biomeAt(x, z) === BIOME.tallGrass) expect(grassHeightAt(t, x, z, 0.5)).toBeGreaterThan(0.75);
    }
    expect(grassHeightAt(t, 0, -1300, 0.5)).toBeLessThan(0.4);
  });
});
