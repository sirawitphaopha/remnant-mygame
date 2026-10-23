import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/game';
import { flowersInTile } from '../src/world/flowers';
import { LAKE, RIVER } from '../src/world/layout';
import { Terrain } from '../src/world/Terrain';
import { fishCanSwim, flowField, schoolSpots, waterfallSpot } from '../src/world/water';

// แม่น้ำมีชีวิต (รอบสอง ช่วง 6)
const t = new Terrain();
const N = 192;
const flow = flowField(N);
const at = (x: number, z: number) => {
  const i = Math.floor(((x + WORLD.half) / WORLD.size) * N);
  const j = Math.floor(((z + WORLD.half) / WORLD.size) * N);
  return [flow[(j * N + i) * 3], flow[(j * N + i) * 3 + 1], flow[(j * N + i) * 3 + 2]];
};

describe('แม่น้ำ', () => {
  it('แม่น้ำไหลจากเหนือลงใต้ ทะเลสาบนิ่ง', () => {
    const p = RIVER[5];
    const [, dz, s] = at(p.x, p.z);
    expect(s).toBeGreaterThan(0.5);
    expect(dz).toBeGreaterThan(0.5);
    expect(at(LAKE.x, LAKE.z)[2]).toBe(0);
  });
  it('น้ำตกตกจากผาสูงกว่า 25 ม. ลงระดับน้ำ', () => {
    const w = waterfallSpot(t);
    expect(w.top - w.bottom).toBeGreaterThan(25);
  });
  it('ฝูงปลาเทราต์ในแม่น้ำ ปลาไนในทะเลสาบ อยู่ในน้ำลึกพอ', () => {
    const s = schoolSpots(t);
    expect(s.filter((x) => x.kind === 'trout').length).toBeGreaterThan(3);
    expect(s.filter((x) => x.kind === 'carp').length).toBeGreaterThan(2);
    for (const x of s) expect(fishCanSwim(t, x.x, x.z)).toBe(true);
  });
  it('ริมแม่น้ำมีธูปฤาษี อ้อ หญ้าหางม้า หินท้องน้ำ · ทะเลสาบมีบัวสาย', () => {
    const kinds = new Set<string>();
    for (const p of RIVER.slice(3, 9)) for (let dx = -40; dx <= 40; dx += 16) for (const s of flowersInTile(t, p.x + dx, p.z, 16)) kinds.add(s.kind);
    for (let a = 0; a < 6.28; a += 0.3) for (const s of flowersInTile(t, LAKE.x + Math.cos(a) * (LAKE.radius + 5), LAKE.z + Math.sin(a) * (LAKE.radius + 5), 16)) kinds.add(s.kind);
    for (const k of ['cattail', 'reed', 'horsetail', 'stone', 'waterLily']) expect(kinds.has(k), k).toBe(true);
  });
});
