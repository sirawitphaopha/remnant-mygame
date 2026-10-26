import { describe, expect, it } from 'vitest';
import { MESA_ROCKS, MesaMap, escarpment, mesaAway } from '../src/world/mesas';
import { TerrainShaper } from '../src/world/terrainGen';

// ภูเขายอดตัดทั้งแมพ (พี่กันขอ 26 ต.ค. 2569 ให้สมจริงขึ้นทุกลูก แต่ละลูกหน้าตาของตัวเอง)
const map = new MesaMap();
/** ตัวละครเดินขึ้นลาดได้ถ้าเส้นตั้งฉากชี้ขึ้นอย่างน้อยเท่านี้ (player/Player.ts) */
const WALKABLE_NY = 0.72;
const ny = (rise: number, run: number) => run / Math.hypot(rise, run);

describe('ภูเขายอดตัด', () => {
  it('หาเจอทุกลูก ผลเดิมทุกครั้ง · 10 ลูกที่ใหญ่สุดได้ชนิดหินตามที่กำหนดเอง', () => {
    const again = new MesaMap();
    expect(map.mesas.length).toBeGreaterThan(150);
    expect(again.mesas.map((m) => `${m.rock}:${m.h1}`)).toEqual(map.mesas.map((m) => `${m.rock}:${m.h1}`));
    expect(map.mesas.filter((m) => m.note).length).toBe(10);
    // ลูกที่พี่กันชี้ (X -935 · Y -594) เป็นหินทราย
    const theOne = map.mesaAt(-935, 594);
    expect(theOne?.rock).toBe('sandstone');
    for (const rock of MESA_ROCKS) expect(map.mesas.some((m) => m.rock === rock), rock).toBe(true);
  });

  it('หน้าตัดต่อกันเนียนทุกชนิดหิน ไม่มีขั้นกระโดด · ลาดหินร่วงตอนล่างเดินได้ · ผนังชันกว่าที่เดินได้ (ต้องปีน)', () => {
    for (const m of map.mesas.slice(0, 60)) {
      const H = m.h1;
      let prev = escarpment(-80, H, m).h;
      let walkTalus = 0;
      let talusSteps = 0;
      let steepest = 1;
      for (let s = -80; s <= 40; s += 0.25) {
        const e = escarpment(s, H, m);
        // ขึ้นอย่างเดียว ไม่มีหลุม · ไม่กระโดดเกินที่ผนังชันสุดจะไปถึงใน 0.25 ม.
        expect(e.h).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(e.h - prev).toBeLessThan(H * 0.25);
        const n = ny(e.h - prev, 0.25);
        steepest = Math.min(steepest, n);
        if (e.h > 0.02 * H && e.h < m.talus * H * 0.6) {
          talusSteps++;
          if (n >= WALKABLE_NY) walkTalus++;
        }
        prev = e.h;
      }
      expect(prev).toBeCloseTo(H, 5);
      expect(walkTalus / talusSteps, `${m.rock} ลาดหินร่วง`).toBeGreaterThan(0.8);
      // ลูกจิ๋วเตี้ยกว่า 8 ม. เป็นเนินหินที่เดินขึ้นได้ตามจริง · หินดินดานไม่มีผนังตั้ง
      if (m.rock !== 'shale' && H >= 8) expect(steepest, `${m.rock} ผนัง สูง ${H.toFixed(1)}`).toBeLessThan(WALKABLE_NY);
    }
  });

  it('ตรงที่พี่กันยืนดู (X -920 · Y -689 มองไปทางเหนือ) มีลาดหินร่วงก่อนถึงผนัง ไม่ใช่กำแพงตั้งจากพื้นทันที', () => {
    const t = new TerrainShaper();
    const prof: number[] = [];
    for (let d = 0; d <= 70; d += 2) prof.push(t.shape(-920, 689 - d));
    const steps = prof.slice(1).map((h, i) => +(h - prof[i]).toFixed(1));
    console.log('หน้าตัดทุก 2 ม. ไปทางเหนือ:', prof.map((h) => h.toFixed(1)).join(' '));
    console.log('ขึ้นต่อ 2 ม.:', steps.join(' '));
    console.log('ชนิดหินแต่ละแบบ:', MESA_ROCKS.map((r) => `${r} ${map.mesas.filter((m) => m.rock === r).length}`).join(' · '));
    // เดิมขึ้นจากพื้นทันที 8.6 ม. ใน 2 ม. · ตอนนี้ก่อนถึงช่วงชัน มีตีนลาดขึ้นทีละไม่เกิน 1.9 ม. (ราว 44 องศา เดินได้) อย่างน้อย 2 ช่วงติดกัน
    const steep = steps.findIndex((s) => s > 2);
    expect(steep).toBeGreaterThan(1);
    expect(steps.slice(steep - 2, steep).every((s) => s > 0.2 && s <= 1.9)).toBe(true);
  });

  it('ไม่ขึ้นใกล้เมือง ใกล้ยาน และบนเทือกเขา', () => {
    expect(mesaAway(40, 820)).toBe(0);
    expect(mesaAway(-1000, 860)).toBe(0);
    expect(mesaAway(0, -1300)).toBe(0);
  });
});
