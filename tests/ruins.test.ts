import { describe, expect, it } from 'vitest';
import { HERO } from '../src/config/scale';
import { distToRoads } from '../src/world/layout';
import { planRuins } from '../src/world/ruins';
import { Structures } from '../src/world/structures';
import { toWorld } from '../src/world/townPlan';

// อารยธรรมที่ถูกป่ากลืน (รอบสอง ช่วง 10)
const ruins = planRuins();
const kinds = (k: string) => ruins.extras.filter((e) => e.kind === k);

describe('อารยธรรมที่ถูกป่ากลืน', () => {
  it('มีครบทุกจุด หมู่บ้าน ปั๊ม โรงเลื่อย อุทยาน หอดูไฟ ทางรถไฟ ขบวนรถ สถานี เสาไฟฟ้า', () => {
    expect(ruins.buildings.filter((b) => b.type === 'house').length).toBeGreaterThan(8);
    for (const k of ['gasCanopy', 'lookout', 'campsite', 'platform', 'sawyard']) expect(kinds(k).length, k).toBe(1);
    expect(kinds('train').length).toBe(5);
    expect(kinds('railway').length).toBeGreaterThan(150);
    expect(kinds('pylon').length).toBeGreaterThan(2);
    expect(ruins.buildings.some((b) => b.sign === 'RANGER STATION' && b.decay === 0)).toBe(true);
  });
  it('ต้นไม้ขึ้นทะลุตู้รถไฟสองตู้ มีซากรถในป่า', () => {
    expect(ruins.trees.length).toBeGreaterThanOrEqual(2);
    expect(ruins.wrecks.length).toBeGreaterThan(4);
  });
  it('ตึกนอกเมืองไม่ล้ำถนน', () => {
    for (const b of ruins.buildings) {
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = toWorld(b, (a * b.w) / 2, (c * b.d) / 2);
        expect(distToRoads(p.x, p.z), `${b.key} ${b.type}`).toBeGreaterThan(4);
      }
    }
  });
  it('เดินขึ้นบันไดหอดูไฟป่าถึงห้องบนยอดได้ (ราว 27 ม.)', () => {
    const tower = kinds('lookout')[0];
    const s = new Structures();
    for (const bx of tower.boxes) s.add({ x: bx.x, z: bx.z, hx: bx.hx, hz: bx.hz, rot: 0, y0: bx.y0, y1: bx.y1 });
    const top = Math.max(...tower.boxes.filter((b) => b.kind === 'floor').map((b) => b.y1));
    const STEP = 0.25;
    const blocked = (x: number, z: number, feet: number) =>
      s.near(x, z).some((q) => !(feet >= q.y1 - HERO.stepUp || feet + HERO.bodyHeight <= q.y0) && Structures.inside(q, x, z, HERO.radius - 0.02));
    const seen = new Set<string>();
    const queue = [{ i: -14, j: -14, feet: 0 }];
    let best = 0;
    while (queue.length) {
      const c = queue.pop()!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = c.i + di;
        const j = c.j + dj;
        if (Math.abs(i) > 16 || Math.abs(j) > 16) continue;
        const x = i * STEP;
        const z = j * STEP;
        if (blocked(x, z, c.feet)) continue;
        const feet = Math.max(0, s.floorAt(x, z, c.feet));
        const k = `${i},${j},${Math.round(feet * 20)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        best = Math.max(best, feet);
        queue.push({ i, j, feet });
      }
    }
    expect(top).toBeGreaterThan(25);
    expect(best).toBeGreaterThan(top - 0.05);
  });
});
