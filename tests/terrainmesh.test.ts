import { describe, expect, it } from 'vitest';
import { CACHE_LIMIT, TerrainMesh } from '../src/render/TerrainMesh';
import type { Terrain } from '../src/world/Terrain';

// แผ่นพื้นหลายระดับ (รอบสอง ช่วง 3) · ใช้พื้นจำลองราบ ไม่ต้องสร้างโลกจริง 5 วินาที
const flat = {
  heightAt: () => 10,
  biomeAt: () => 2,
  normalAt: () => [0, 1, 0],
} as unknown as Terrain;

describe('แผ่นพื้นหลายระดับ', () => {
  it('ใกล้กล้องใช้แผ่นเล็กละเอียด และเดินอยู่กับที่แล้วไม่สร้างแผ่นใหม่วนไม่จบ', () => {
    const m = new TerrainMesh(flat);
    m.update(100, 200, true);
    const drawn = m.drawn;
    expect(drawn).toBeGreaterThan(10);
    expect(drawn).toBeLessThan(140);
    const cached = m.cached;
    for (let i = 0; i < 60; i++) m.update(100, 200);
    expect(m.drawn).toBe(drawn);
    expect(m.cached).toBe(cached);
  });
  it('เดินไกลแล้วแผ่นเก่าถูกคืนหน่วยความจำ ไม่เก็บเกินเพดาน', () => {
    const m = new TerrainMesh(flat);
    for (let x = -1400; x <= 1400; x += 100) m.update(x, 0, true);
    expect(m.cached).toBeLessThanOrEqual(CACHE_LIMIT + 1);
    expect(m.drawn).toBeGreaterThan(10);
  });
});
