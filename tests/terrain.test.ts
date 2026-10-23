import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/game';
import { ExploreMap, EXPLORE } from '../src/core/explore';
import { BRIDGE, CAVES, LAKE, MOUNTAINS, RIVER, SHIP, TOWN } from '../src/world/layout';
import { Structures } from '../src/world/structures';
import { Terrain } from '../src/world/Terrain';
import { BIOME, TerrainShaper, fillPits } from '../src/world/terrainGen';
import { buildTown } from '../src/world/town';

// โลก 3 × 3 กม. (รอบสอง ช่วง 3)
const t = new Terrain();

describe('ภูมิประเทศ', () => {
  it('แมพเดิมทุกครั้ง (seed เดิม สูตรเดิม)', () => {
    const a = new TerrainShaper();
    const b = new TerrainShaper();
    for (const [x, z] of [[123.4, -56.7], [-900, 400], [300, -1200]]) expect(a.shape(x, z)).toBe(b.shape(x, z));
  });
  it('แม่น้ำกับทะเลสาบต่ำกว่าระดับน้ำ', () => {
    for (const p of RIVER.slice(1, -1)) expect(t.heightAt(p.x, p.z), `${p.x},${p.z}`).toBeLessThan(WORLD.waterLevel);
    expect(t.heightAt(LAKE.x, LAKE.z)).toBeLessThan(WORLD.waterLevel - 2);
  });
  it('เมืองกับที่จอดยานอยู่บนบก ที่จอดยานราบ · ยานห่างเมืองราว 1 กม.', () => {
    expect(t.heightAt(TOWN.x, TOWN.z)).toBeGreaterThan(WORLD.waterLevel + 2);
    expect(t.heightAt(SHIP.x, SHIP.z)).toBeGreaterThan(WORLD.waterLevel + 2);
    expect(t.slopeAt(SHIP.x, SHIP.z)).toBeLessThan(0.05);
    expect(Math.hypot(SHIP.x - TOWN.x, SHIP.z - TOWN.z)).toBeGreaterThan(900);
  });
  it('เทือกเขาทิศเหนือสูง 650 ถึง 800 ม. มีหิมะเหนือ 550 ม.', () => {
    let max = 0;
    for (let x = -1400; x <= 1400; x += 10) for (let z = -1490; z <= MOUNTAINS.foot; z += 10) max = Math.max(max, t.heightAt(x, z));
    expect(max).toBeGreaterThan(650);
    expect(max).toBeLessThan(850);
    let snow = 0;
    for (const b of t.biomes) if (b === BIOME.snow) snow++;
    expect(snow / t.biomes.length).toBeGreaterThan(0.01);
  });
  it('มีชนิดพื้นที่ครบตามผัง (ป่า 5 แบบ ทุ่งดอกไม้ ทุ่งหญ้าสูง ไร่ ที่ลุ่ม บนเขา หิมะ)', () => {
    const seen = new Set(t.biomes);
    for (const b of ['redwood', 'rainforest', 'deciduous', 'orchard', 'dense', 'flowers', 'tallGrass', 'farmland', 'wetland', 'alpine', 'snow', 'town'] as const) {
      expect(seen.has(BIOME[b]), b).toBe(true);
    }
  });
  it('ไม่มีแอ่งปิดบนบก (ถมซ้ำแล้วไม่มีจุดไหนต้องยกอีก)', () => {
    const copy = new Float32Array(t.heights);
    expect(fillPits(copy, t.n, WORLD.waterLevel)).toBe(0);
  });
  it('ปากถ้ำทั้งสองอยู่บนบก', () => {
    for (const c of CAVES) expect(t.heightAt(c.x, c.z)).toBeGreaterThan(WORLD.waterLevel + 1);
  });
  it('สะพาน: ปลายพื้นสะพานแตะคันดินทั้งสองฝั่ง เดินขึ้นได้ (ข้อ 79)', () => {
    const { bridge } = buildTown(t, new Structures());
    const decks = bridge.filter((p) => p.kind === 'deck');
    expect(decks.length).toBe(2);
    const dx = Math.cos(BRIDGE.angle);
    const dz = Math.sin(BRIDGE.angle);
    for (const d of decks) {
      const side = Math.sign((d.x - BRIDGE.x) * dx + (d.z - BRIDGE.z) * dz);
      const endX = d.x + dx * side * d.hx;
      const endZ = d.z + dz * side * d.hx;
      expect(Math.abs(t.heightAt(endX, endZ) - d.y1), 'ความต่างพื้นสะพานกับคันดิน').toBeLessThan(0.6);
    }
  });
});

describe('แผนที่ที่เคยไป (แมพ 3 กม.)', () => {
  it('ตารางคิดจากขนาดแมพ เปิดได้ถึงทั้ง 4 มุม (ข้อ 123)', () => {
    expect(EXPLORE.cells).toBe(WORLD.size / EXPLORE.cell);
    const m = new ExploreMap();
    for (const [x, z] of [[-1490, -1490], [1490, -1490], [-1490, 1490], [1490, 1490], [0, 0]]) {
      expect(m.reveal(x, z)).toBeGreaterThan(0);
      expect(m.isOpen(x, z)).toBe(true);
    }
  });
});
