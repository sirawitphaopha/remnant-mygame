import { describe, expect, it } from 'vitest';
import { MOVE } from '../src/config/game';
import { Player, type SlopeGround } from '../src/player/Player';

// การเคลื่อนที่ที่พี่กันลองเล่นแล้วทัก (26 ต.ค. 2569) · เดินอืด · วิ่งแล้วกระโดดไม่ได้
const ground = (h: (x: number, z: number) => number): SlopeGround => ({
  contextY: Infinity,
  heightAt: h,
  waterAt: () => -Infinity,
  normalAt: (x, z) => {
    const e = 0.2;
    const dx = (h(x + e, z) - h(x - e, z)) / (2 * e);
    const dz = (h(x, z + e) - h(x, z - e)) / (2 * e);
    const n = Math.hypot(dx, 1, dz);
    return [-dx / n, 1 / n, -dz / n];
  },
});
const flat = ground(() => 10);
// เนินคลื่นแบบพื้นป่า สูงต่ำราวครึ่งเมตร
const rolling = ground((x, z) => 10 + 0.5 * Math.sin(x * 0.35) + 0.4 * Math.sin(z * 0.27));

const step = (p: Player, s: number, run: boolean, jumpAt = -1) => {
  let jumped = false;
  let top = p.y;
  for (let i = 0; i < Math.round(s * 60); i++) {
    p.update(1 / 60, { x: 0, z: -1, run, jump: i === jumpAt, climbGear: false, loadRatio: 0 });
    if (p.state === 'air' && p.vy > 0) jumped = true;
    top = Math.max(top, p.y);
  }
  return { jumped, top };
};

describe('การเคลื่อนที่', () => {
  it('เดินเร็วกว่าเดิม (เดิม 1.5 ม./วิ พี่กันว่าอืด) แต่ยังช้ากว่าวิ่ง', () => {
    expect(MOVE.walkSpeed).toBeGreaterThanOrEqual(2.5);
    expect(MOVE.runSpeed).toBeGreaterThan(MOVE.walkSpeed * 1.4);
    const p = new Player(flat);
    p.place(0, 0, 0);
    step(p, 2, false);
    expect(p.speed).toBeGreaterThan(MOVE.walkSpeed * 0.95);
  });

  it('วิ่งจนแรงหมดแล้วยังกระโดดได้ (เดิมแรงหมดกดกระโดดไม่เกิดอะไร)', () => {
    const p = new Player(flat);
    p.place(0, 0, 0);
    step(p, 25, true);
    expect(p.stamina.exhausted).toBe(true);
    const before = p.y;
    const r = step(p, 1.5, true, 1);
    expect(r.jumped).toBe(true);
    expect(r.top - before).toBeGreaterThan(0.5);
  });

  for (const [name, g] of [['พื้นเรียบ', flat], ['พื้นเนินคลื่น', rolling]] as const) {
    it(`วิ่งแล้วกดกระโดดได้ทุกจังหวะ (${name})`, () => {
      for (let at = 30; at < 150; at += 7) {
        const p = new Player(g);
        p.place(0, 0, 0);
        const before = p.y;
        const r = step(p, 3, true, at);
        expect(r.jumped, `${name} กดกระโดดที่เฟรม ${at}`).toBe(true);
        expect(r.top - before).toBeGreaterThan(0.6);
      }
    });
  }
});
