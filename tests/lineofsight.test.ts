import { describe, expect, it } from 'vitest';
import { buildCaves, caveCenter } from '../src/world/caves';
import { inSight } from '../src/world/lineOfSight';
import { PointGrid } from '../src/world/pointGrid';
import { Structures } from '../src/world/structures';
import { Terrain } from '../src/world/Terrain';
import { MOUNTAINS } from '../src/world/layout';

// เป้าสแกนต้องมองเห็นจริง (รอบสอง ช่วง 12 · รายงานตรวจข้อ 121 132)
const t = new Terrain();

describe('มองเห็นเป้าสแกน', () => {
  it('ทุ่งโล่งเห็น · ผนังตึกบังไม่เห็น · ตึกเองไม่บังตัวเอง', () => {
    const st = new Structures();
    const x = -1040;
    const z = -200;
    const y = t.heightAt(x, z);
    const eye = { x, y: y + 1.6, z };
    expect(inSight(t, st, eye, x + 10, y + 0.5, z)).toBe(true);
    st.add({ x: x + 5, z, hx: 0.2, hz: 4, rot: 0, y0: y - 1, y1: y + 4 });
    expect(inSight(t, st, eye, x + 10, y + 0.5, z)).toBe(false);
    expect(inSight(t, st, eye, x + 10, y + 0.5, z, false)).toBe(true);
  });
  it('ภูเขาบัง: มองข้ามสันเขาไม่เห็นของอีกฝั่ง', () => {
    const st = new Structures();
    // หาสันเนินที่สูงกว่าสองฝั่งชัด ๆ ตามแนวเหนือใต้ที่ตีนเทือกเขา
    let found = false;
    for (let x = -1200; x <= 1200 && !found; x += 40) {
      for (let z = MOUNTAINS.foot; z > MOUNTAINS.crest && !found; z -= 20) {
        const a = t.heightAt(x, z + 30);
        const m = t.heightAt(x, z);
        const b = t.heightAt(x, z - 30);
        if (m - a > 12 && m - b > 12) {
          expect(inSight(t, st, { x, y: a + 1.6, z: z + 30 }, x, b + 0.5, z - 30)).toBe(false);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });
  it('อยู่ในถ้ำเห็นแต่ของในถ้ำ อยู่ข้างนอกไม่เห็นของในถ้ำผ่านภูเขา', () => {
    const st = new Structures();
    const [lime] = buildCaves(t);
    const a = caveCenter(lime, 0.6);
    const b = caveCenter(lime, 0.63);
    const eye = { x: a.x, y: a.y + 1.4, z: a.z };
    expect(inSight(t, st, eye, b.x, b.y + 0.4, b.z)).toBe(true);
    // ผิวเขาเหนือถ้ำ
    expect(inSight(t, st, eye, b.x, t.heightAt(b.x, b.z) + 0.3, b.z)).toBe(false);
    expect(inSight(t, st, { x: b.x, y: t.heightAt(b.x, b.z) + 1.6, z: b.z }, a.x, a.y + 0.4, a.z)).toBe(false);
  });
  it('ตารางช่องหาของในรัศมีได้ครบเท่ากับวนทั้งหมด', () => {
    const g = new PointGrid<{ x: number; z: number; i: number }>(32);
    const all: { x: number; z: number; i: number }[] = [];
    for (let i = 0; i < 4000; i++) { const p = { x: Math.sin(i * 12.9898) * 1400, z: Math.cos(i * 78.233) * 1400, i }; all.push(p); g.add(p); }
    for (const [x, z, r] of [[0, 0, 30], [-700, 300, 45], [1390, -1390, 60]]) {
      const want = all.filter((p) => Math.hypot(p.x - x, p.z - z) <= r).map((p) => p.i).sort();
      expect(g.near(x, z, r).map((p) => p.i).sort()).toEqual(want);
    }
  });
});
