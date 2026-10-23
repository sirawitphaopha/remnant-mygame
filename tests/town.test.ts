import { describe, expect, it } from 'vitest';
import { HERO } from '../src/config/scale';
import { distToRoads } from '../src/world/layout';
import { Structures } from '../src/world/structures';
import { buildingParts, planExtras, planTown, rectsOverlap, toWorld, type Building } from '../src/world/townPlan';

// เมืองที่มีจริง เข้าตึกได้ทุกหลัง (รอบสอง ช่วง 8 และ 9)
const plan = planTown();
const asBuilt = (p: Omit<Building, 'y'>): Building => ({ ...p, y: 0 });

/**
 * เดินในตึกจริงด้วยกติกาเดียวกับตัวละคร (Structures.floorAt ก้าวขึ้นได้ 0.6 ม. · ชนกล่องที่อยู่ในช่วงลำตัว)
 * เริ่มจากหน้าประตู คืนจุดที่เดินถึงได้ทั้งหมด
 */
const walked = new Map<string, ReturnType<typeof walkOnce>>();
const walk = (b: Building) => walked.get(b.key) ?? walked.set(b.key, walkOnce(b)).get(b.key)!;

function walkOnce(b: Building): { reached: Set<string>; topFeet: number; s: Structures; cells: number } {
  const s = new Structures();
  const { boxes } = buildingParts(b);
  for (const bx of boxes) s.add({ x: bx.x, z: bx.z, hx: bx.hx, hz: bx.hz, rot: 0, y0: bx.y0, y1: bx.y1 });
  const STEP = 0.25;
  const r = HERO.radius;
  // ชนแบบเดียวกับ Structures.push ที่ตัวละครใช้ (นับจากความสูงเท้าก่อนก้าว)
  const blocked = (x: number, z: number, feet: number) =>
    s.near(x, z).some((q) => !(feet >= q.y1 - HERO.stepUp || feet + HERO.bodyHeight <= q.y0) && Structures.inside(q, x, z, r - 0.02));
  const ground = (x: number, z: number, feet: number) => Math.max(0, s.floorAt(x, z, feet));
  const key = (i: number, j: number, f: number) => `${i},${j},${Math.round(f * 20)}`;
  const reached = new Set<string>();
  const hw = b.w / 2 + 2;
  const hd = b.d / 2 + 2;
  const start = { i: 0, j: Math.round((-b.d / 2 - 1.2) / STEP), feet: 0 };
  const queue = [start];
  reached.add(key(start.i, start.j, 0));
  let topFeet = 0;
  while (queue.length) {
    const c = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = c.i + di;
      const j = c.j + dj;
      const x = i * STEP;
      const z = j * STEP;
      if (Math.abs(x) > hw || Math.abs(z) > hd) continue;
      // ชนกับกล่องดูจากเท้าก่อนก้าว (ตัวละครในเกมดันออกจากผนังก่อนหาพื้นที่จะยืน)
      if (blocked(x, z, c.feet)) continue;
      const feet = ground(x, z, c.feet);
      const k = key(i, j, feet);
      if (reached.has(k)) continue;
      reached.add(k);
      topFeet = Math.max(topFeet, feet);
      queue.push({ i, j, feet });
    }
  }
  // ช่องพื้นชั้นล่างที่ว่าง (ไม่ติดเฟอร์นิเจอร์หรือผนัง) ไว้เทียบว่าเดินถึงกี่ส่วน
  let cells = 0;
  for (let i = Math.ceil((-b.w / 2 + 0.5) / STEP); i <= Math.floor((b.w / 2 - 0.5) / STEP); i++) {
    for (let j = Math.ceil((-b.d / 2 + 0.5) / STEP); j <= Math.floor((b.d / 2 - 0.5) / STEP); j++) if (!blocked(i * STEP, j * STEP, 0.15) && ground(i * STEP, j * STEP, 0.15) <= 0.16) cells++;
  }
  return { reached, topFeet, s, cells };
}

describe('ผังเมือง', () => {
  it('เมืองราว 80 ถึง 120 หลัง มีตึกครบทุกชนิด', () => {
    expect(plan.length).toBeGreaterThanOrEqual(80);
    expect(plan.length).toBeLessThanOrEqual(120);
    const types = new Set(plan.map((b) => b.type));
    for (const t of ['house', 'townhouse', 'shop', 'diner', 'grocery', 'hardware', 'postOffice', 'clinic', 'police', 'fireStation', 'school', 'church', 'warehouse', 'motel', 'gasStation']) expect(types.has(t as never), t).toBe(true);
  });
  it('ไม่มีตึกล้ำถนน ไม่มีตึกทับกัน ไม่ทับสวน สุสาน สนามเด็กเล่น หอส่งน้ำ', () => {
    const extras = planExtras();
    for (const b of plan) {
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = toWorld(b, (a * b.w) / 2, (c * b.d) / 2);
        expect(distToRoads(p.x, p.z), b.key).toBeGreaterThan(5.5);
      }
      for (const o of plan) if (o !== b) expect(rectsOverlap(o, b, 0), `${b.key} ${o.key}`).toBe(false);
      for (const e of extras) expect(rectsOverlap(e, b, 0), `${b.key} ${e.key}`).toBe(false);
    }
    expect(extras.map((e) => e.kind).sort()).toEqual(['cemetery', 'park', 'playground', 'waterTower']);
  });
  it('ตึกริมถนนหันประตูหน้าเข้าถนน · ผังไม่เป็นตาราง (ตึกหันหลายทิศ)', () => {
    let street = 0;
    for (const b of plan) {
      const front = toWorld(b, 0, -b.d / 2 - 1);
      const back = toWorld(b, 0, b.d / 2 + 1);
      if (!b.street) continue; // ซากบ้านกลางป่า ถนนเก่าจมดินไปแล้ว หันไปทางไหนก็ได้
      street++;
      expect(distToRoads(front.x, front.z), b.key).toBeLessThan(distToRoads(back.x, back.z));
    }
    expect(street).toBeGreaterThan(60);
    // ทิศของตึกกระจายหลายทิศ ไม่ได้มีแค่สองทิศแบบผังตาราง
    const dirs = new Set(plan.map((b) => Math.round(((b.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 8))));
    expect(dirs.size).toBeGreaterThan(6);
  });
  it('พันปีผ่านไป ตึกผุพังสามระดับ ซากบ้านกระจายในป่ารอบนอก', () => {
    const by = [0, 1, 2].map((k) => plan.filter((b) => b.decay === k).length);
    for (const n of by) expect(n).toBeGreaterThan(8);
    expect(plan.filter((b) => b.zone === 'forest').length).toBeGreaterThan(15);
    // ตึกที่ยังมีหลังคามีหลายชั้นให้ขึ้นบันได
    expect(plan.filter((b) => b.decay < 2 && b.floors > 1).length).toBeGreaterThan(10);
  });
});

describe('เข้าตึกได้ทุกหลัง', () => {
  // ทุกหลังในเมือง
  const sample = plan.map(asBuilt);
  it('เดินจากหน้าประตูเข้าไปถึงพื้นชั้นล่างเกือบทั้งหมด (ทุกห้องมีประตู)', () => {
    for (const b of sample) {
      const { reached, cells } = walk(b);
      let inside = 0;
      for (const k of reached) {
        const [i, j, f] = k.split(',').map(Number);
        if (f <= 3 && Math.abs(i * 0.25) < b.w / 2 - 0.5 && Math.abs(j * 0.25) < b.d / 2 - 0.5) inside++;
      }
      expect(inside / cells, `${b.key} ${b.type}`).toBeGreaterThan(0.85);
    }
  }, 30000); // เดินทุกหลังในเมือง ราว 2 ถึง 6 วินาทีตามเครื่อง
  it('ขึ้นบันไดถึงชั้นบนสุดได้ทุกหลังที่มีหลายชั้น', () => {
    for (const b of sample.filter((x) => x.floors > 1)) {
      const { topFeet } = walk(b);
      expect(topFeet, `${b.key} ${b.type} ${b.floors} ชั้น`).toBeGreaterThan((b.floors - 1) * b.storey - 0.05);
    }
  });
  it('บันไดขั้นละ 0.25 ม. ไม่เกินที่ก้าวขึ้นได้ หลังคากับพื้นชั้นบนกันฝน', () => {
    for (const b of sample.filter((x) => x.floors > 1)) {
      const { stairs, boxes } = buildingParts(b);
      expect(stairs.length).toBe(b.floors - 1);
      const steps = boxes.filter((x) => x.kind === 'stair');
      for (const st of steps) expect(st.y1 - st.y0 <= b.storey + 0.01).toBe(true);
      const heights = [0.15, ...new Set(steps.map((x) => Math.round(x.y1 * 100) / 100))].sort((a, c) => a - c);
      for (let k = 1; k < heights.length; k++) expect(heights[k] - heights[k - 1]).toBeLessThan(HERO.stepUp);
      expect(heights[heights.length - 1]).toBeCloseTo((b.floors - 1) * b.storey, 2);
    }
    // ชั้นล่างของตึกสองชั้นมีพื้นชั้นบนเหนือหัว
    const b = asBuilt(plan.find((x) => x.floors === 2 && !x.ruined)!);
    const s = walk(b).s;
    expect(s.roofOver(-b.w / 4, 0.15, 0)).toBe(true);
  });
});
