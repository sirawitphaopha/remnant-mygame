import { describe, expect, it } from 'vitest';
import { buildCaves, caveAt } from '../src/world/caves';
import { Terrain } from '../src/world/Terrain';

const t = new Terrain();
const caves = buildCaves(t);

describe('ถ้ำ', () => {
  it('อุโมงค์อยู่ใต้ภูเขาจริง เพดานต่ำกว่าผิวภูเขาอย่างน้อย 3 ม. ตลอดทาง (ยกเว้นช่วงปากถ้ำ)', () => {
    for (const c of caves) {
      for (const p of c.points.slice(3)) {
        expect(t.heightAt(p.x, p.z) - (p.y + p.r * 1.6), `ถ้ำ ${c.id}`).toBeGreaterThan(3);
      }
    }
  });
  it('หาตำแหน่งในถ้ำได้ ปลายถ้ำแรกมีก๊าซพิษ', () => {
    const c = caves[0];
    const deep = c.points[c.points.length - 1];
    const at = caveAt(caves, deep.x, deep.z)!;
    expect(at.cave.id).toBe(0);
    expect(at.f).toBeGreaterThan(c.gasFrom);
    expect(caveAt(caves, 0, 0)).toBeNull();
  });
});
