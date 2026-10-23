import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Animals, type AnimalFrame, type TreePoint } from '../src/app/Animals';
import { ATTACK_RANGE } from '../src/core/animals';
import { outOfView } from '../src/core/ecology';
import { WORLD } from '../src/config/game';
import { buildCaves } from '../src/world/caves';
import { CircleColliders } from '../src/world/colliders';
import { WildZones } from '../src/world/habitat';
import { PointGrid } from '../src/world/pointGrid';
import { scatterTrees } from '../src/world/scatter';
import { Structures } from '../src/world/structures';
import { Terrain } from '../src/world/Terrain';
import { trunkRadius } from '../src/world/trees';
import { waterfallSpot } from '../src/world/water';
import { Critters } from '../src/render/Critters';
import type { FlowerSpot } from '../src/world/flowers';

// ระบบนิเวศบนแมพจริง (รอบสอง ช่วง 12) · จำลองสัตว์ทีละ 1/30 วินาทีบนภูมิประเทศ ต้นไม้ ถ้ำ จริง (ไม่วาดภาพ)
// เลขสุ่มคงที่ ผลเดิมทุกครั้ง

const t = new Terrain();
const caves = buildCaves(t);
const fall = waterfallSpot(t);
const wild = new WildZones(t, fall);
const colliders = new CircleColliders();
const trees = new PointGrid<TreePoint>(32);
for (const set of scatterTrees(t)) {
  for (const it of set.items) {
    const h = it.scale * 10;
    colliders.add({ x: it.x, z: it.z, r: trunkRadius(set.kind, h), top: h });
    trees.add({ x: it.x, y: it.y, z: it.z, kind: set.kind, height: h });
  }
}

let seed = 12345;
beforeAll(() => {
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  });
});
afterAll(() => vi.restoreAllMocks());

function world(structures = new Structures()) {
  const a = new Animals({ terrain: t, colliders, structures, caves, wild, trees });
  a.spawning = false;
  return a;
}
const frame = (o: Partial<AnimalFrame> = {}): AnimalFrame => ({ dt: 1 / 30, px: 0, py: 0, pz: 0, reach: true, timeOfDay: 0.5, rain: 0, time: 0, fx: 0, fz: -1, ...o });
function run(a: Animals, f: AnimalFrame, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds * 30; i++) {
    f.time += f.dt;
    a.update(f);
    each?.();
  }
}
/** ไกลมาก ผู้เล่นไม่รบกวน */
const away = (x: number, z: number) => ({ px: x + 150, py: 0, pz: z, reach: false });

describe('ระบบนิเวศบนแมพจริง', () => {
  it('สัตว์ไม่เดินทะลุลำต้นไม้ (รายงานตรวจข้อ 98)', () => {
    const a = world();
    // ป่าทึบตะวันตก ให้คนไล่กวางวิ่งผ่านป่า
    const x = -700;
    const z = -150;
    const id = a.place('deer', x, z);
    const f = frame({ px: x + 6, py: t.heightAt(x + 6, z), pz: z, timeOfDay: 0.25 });
    let worst = 0;
    run(a, f, 25, () => {
      const d = a.get(id);
      if (!d) return;
      for (const c of colliders.near(d.x, d.z, 2)) worst = Math.max(worst, c.r + 0.4 - Math.hypot(d.x - c.x, d.z - c.z));
      // คนเดินตามไล่ไปเรื่อย ๆ
      f.px = d.x + 6 * Math.sign(f.px - d.x || 1);
      f.pz = d.z;
    });
    expect(worst).toBeLessThan(0.08);
    expect(Math.hypot(a.get(id)!.x - x, a.get(id)!.z - z)).toBeGreaterThan(20);
  }, 60000);

  it('หมาป่าไล่คนขึ้นหน้าผาชันไม่ได้ (รายงานตรวจข้อ 98)', () => {
    const a = world();
    // ตีนผาน้ำตก (เขตป่าลึกที่สอง) คนยืนบนขอบผา
    const bx = wild.fishing.x;
    const bz = wild.fishing.z;
    const id = a.place('wolf', bx, bz);
    const top = { x: fall.x + 6, z: fall.z };
    const f = frame({ px: top.x, py: t.heightAt(top.x, top.z), pz: top.z, timeOfDay: 0.25 });
    let maxY = -Infinity;
    run(a, f, 20, () => { maxY = Math.max(maxY, a.get(id)!.y); });
    expect(t.heightAt(top.x, top.z) - maxY).toBeGreaterThan(15);
  }, 60000);

  it('สัตว์ไม่เข้าตึก (รายงานตรวจข้อ 98)', () => {
    const st = new Structures();
    // กล่องตึก 10 × 10 ม. ขวางทางหนี
    const x = -1040;
    const z = -200;
    const y = t.heightAt(x, z);
    st.add({ x: x + 14, z, hx: 5, hz: 5, rot: 0, y0: y - 1, y1: y + 6, kind: 'building' } as never);
    const a = world(st);
    const id = a.place('deer', x + 6, z);
    const f = frame({ px: x - 2, py: y, pz: z, timeOfDay: 0.25 });
    let inside = 0;
    run(a, f, 12, () => {
      const d = a.get(id)!;
      if (Math.abs(d.x - (x + 14)) < 5 && Math.abs(d.z - z) < 5) inside++;
    });
    expect(inside).toBe(0);
  }, 60000);

  it('หนีไปทางขอบแมพ วิ่งเลียบขอบแทนการวิ่งชนขอบอยู่กับที่ (รายงานตรวจข้อ 102)', () => {
    const a = world();
    // หาจุดบกเรียบริมขอบตะวันออก
    let x = WORLD.half - 40;
    let z = -200;
    for (let k = 0; k < 200 && (t.slopeAt(x, z) > 0.15 || t.heightAt(x, z) < WORLD.waterLevel + 1); k++) z += 7;
    const id = a.place('deer', x, z);
    const f = frame({ px: x - 8, py: t.heightAt(x - 8, z), pz: z, timeOfDay: 0.25 });
    run(a, f, 10, () => {
      const d = a.get(id)!;
      f.px = d.x - 8;
      f.pz = d.z;
    });
    const d = a.get(id)!;
    expect(d.x).toBeLessThanOrEqual(WORLD.half - 5);
    expect(Math.abs(d.z - z)).toBeGreaterThan(25);
  }, 60000);

  it('หมาป่าไล่ถึงระยะตีแล้วหยุด ไม่วิ่งทับตัวผู้เล่น (รายงานตรวจข้อ 100)', () => {
    const a = world();
    const x = -1040;
    const z = -200;
    const id = a.place('wolf', x + 12, z);
    const f = frame({ px: x, py: t.heightAt(x, z), pz: z, timeOfDay: 0.25 });
    let attacks = 0;
    a.onAttack = () => attacks++;
    let minD = Infinity;
    run(a, f, 8, () => { const w = a.get(id)!; minD = Math.min(minD, Math.hypot(w.x - x, w.z - z)); });
    expect(minD).toBeGreaterThan(ATTACK_RANGE * 0.5);
    expect(attacks).toBeGreaterThan(0);
  }, 60000);

  it('ผู้เล่นอยู่ในถ้ำหรือบนหลังคา หมาป่าเลิกไล่ (รายงานตรวจข้อ 99)', () => {
    const a = world();
    const x = -1040;
    const z = -200;
    const id = a.place('wolf', x + 10, z);
    const f = frame({ px: x, py: t.heightAt(x, z) + 6, pz: z, reach: false, timeOfDay: 0.25 });
    run(a, f, 4);
    expect(a.get(id)!.mind.task).not.toBe('chase');
  }, 60000);

  it('ฝูงใหม่เกิดนอกสายตาเท่านั้น (รายงานตรวจข้อ 101)', () => {
    const a = world();
    a.spawning = true;
    // ทุ่งในเขตป่าลึก เช้ามืด กวาง หมาป่า กระต่าย ออกมา
    const f = frame({ px: -1020, py: t.heightAt(-1020, -150), pz: -150, timeOfDay: 0.24, fx: 0, fz: -1 });
    const seen = new Set<number>();
    let bad = 0;
    let made = 0;
    run(a, f, 30, () => {
      for (const an of a.list) {
        if (seen.has(an.id)) continue;
        seen.add(an.id);
        made++;
        // ตัวในฝูงกระจายรอบจุดเกิดไม่กี่เมตร นับจากจุดเกิดของฝูง
        if (!outOfView(an.herd.hx - f.px, an.herd.hz - f.pz, f.fx, f.fz)) bad++;
      }
    });
    expect(made).toBeGreaterThan(3);
    expect(bad).toBe(0);
  }, 60000);

  it('หมาป่าหิวย่องเข้าหาฝูงกวางแล้ววิ่งไล่ กวางวิ่งหนีทั้งฝูง ล่าได้แล้วกินซาก กลางวันอีกามารุมซาก', () => {
    const a = world();
    const x = -1040;
    const z = -200;
    const deer: number[] = [];
    const herdFirst = a.place('deer', x, z, 5);
    for (let i = 0; i < 5; i++) deer.push(herdFirst + i);
    const w0 = a.place('wolf', x - 45, z + 4, 4);
    for (let i = 0; i < 4; i++) a.get(w0 + i)!.mind.hunger = 0.9;
    const f = frame({ ...away(x, z), timeOfDay: 0.8 });
    const tasks = new Set<string>();
    let fled = false;
    let ate = false;
    // ล่าไม่สำเร็จบ่อย ให้เวลาหลายรอบ
    for (let k = 0; k < 8 && !ate; k++) {
      run(a, f, 30, () => {
        for (let i = 0; i < 4; i++) { const w = a.get(w0 + i); if (w) tasks.add(w.mind.task); }
        for (const id of deer) if (a.get(id)?.mind.task === 'flee') fled = true;
        if (a.carcasses.length && [0, 1, 2, 3].some((i) => a.get(w0 + i)?.mind.task === 'eat')) ate = true;
      });
      // กวางหนีไปหมดแล้ว วางฝูงใหม่ข้างหมาป่า (หมาป่ากลับที่อยู่แล้วพักก่อนล่าใหม่)
      if (!ate && !a.list.some((an) => an.s.id === 'deer' && Math.hypot(an.x - a.get(w0)!.x, an.z - a.get(w0)!.z) < 60)) {
        const wv = a.get(w0)!;
        const first = a.place('deer', wv.x + 35, wv.z, 5);
        for (let i = 0; i < 5; i++) deer.push(first + i);
        for (let i = 0; i < 4; i++) { const w = a.get(w0 + i); if (w) { w.mind.huntRest = 0; w.mind.hunger = 0.9; } }
      }
    }
    expect(tasks.has('hunt')).toBe(true);
    expect(fled).toBe(true);
    expect(ate).toBe(true);
    expect(a.carcasses[0].s.id).toBe('deer');
    // กลางวัน อีกาบินมารุมซาก
    a.spawning = true;
    f.timeOfDay = 0.5;
    const c = a.carcasses[0];
    let crowEats = false;
    run(a, f, 90, () => { if (a.list.some((an) => an.s.id === 'crow' && an.mind.task === 'eat' && an.landed && Math.hypot(an.x - c.x, an.z - c.z) < 5)) crowEats = true; });
    expect(crowEats).toBe(true);
  }, 120000);

  it('หมีหิวในหุบน้ำตก ลงไปจับปลาที่ตีนน้ำตก', () => {
    const a = world();
    const g = wild.fishing;
    const id = a.place('bear', g.x + 25, g.z + 18);
    a.get(id)!.mind.hunger = 0.9;
    a.get(id)!.mind.thirst = 0;
    const f = frame({ ...away(g.x, g.z), timeOfDay: 0.25 });
    let fishing = false;
    run(a, f, 60, () => { if (a.get(id)!.pose === 'fish') fishing = true; });
    expect(fishing).toBe(true);
    expect(Math.hypot(a.get(id)!.x - g.x, a.get(id)!.z - g.z)).toBeLessThan(3);
  }, 60000);

  it('หมีในป่าลึกหิว ไปยืนสองขากินลูกไม้ที่ต้นโอ๊ก บีช', () => {
    const a = world();
    const x = -700;
    const z = -150;
    const id = a.place('bear', x, z);
    a.get(id)!.mind.hunger = 0.9;
    a.get(id)!.mind.thirst = 0;
    const f = frame({ ...away(x, z), timeOfDay: 0.25 });
    let reared = false;
    run(a, f, 60, () => { if (a.get(id)!.pose === 'rear') reared = true; });
    expect(reared).toBe(true);
  }, 60000);

  it('กระรอกเห็นคนแล้ววิ่งขึ้นต้นไม้ คนไปแล้วลงต้นเอาหัวลง', () => {
    const a = world();
    const t0 = trees.nearest(-700, -150, 40, (p) => p.height > 12)!;
    const id = a.place('squirrel', t0.x + 1.5, t0.z);
    const sq = a.get(id)!;
    const tp = sq.herd.tree!;
    const f = frame({ px: tp.x + 8, py: tp.y, pz: tp.z, timeOfDay: 0.4 });
    run(a, f, 8);
    expect(sq.y - t.heightAt(sq.x, sq.z)).toBeGreaterThan(2);
    expect(Math.hypot(sq.x - tp.x, sq.z - tp.z)).toBeLessThan(trunkRadius(tp.kind, tp.height) + 0.3);
    f.px += 200;
    f.reach = false;
    let down = false;
    run(a, f, 25, () => { if (sq.pose === 'climbDown') down = true; });
    expect(down).toBe(true);
    expect(sq.climbState).toBe('ground');
  }, 60000);

  it('กวางกระหายน้ำ เดินลงไปกินน้ำที่ตลิ่ง', () => {
    const a = world();
    // ริมทะเลสาบทิศใต้
    let x = 560;
    const z = 1180 - 210;
    for (let k = 0; k < 100 && t.heightAt(x, z) < WORLD.waterLevel + 2; k++) x += 3;
    const id = a.place('deer', x, z);
    a.get(id)!.mind.thirst = 0.95;
    a.get(id)!.mind.hunger = 0;
    const f = frame({ ...away(x, z), timeOfDay: 0.25 });
    let drank = false;
    run(a, f, 60, () => { if (a.get(id)!.pose === 'drink') drank = true; });
    expect(drank).toBe(true);
    expect(a.get(id)!.mind.thirst).toBeLessThan(0.5);
  }, 60000);

  it('กลางวันกวางในทุ่งเดินเข้าไปหลบในป่า', () => {
    const a = world();
    const x = -1040;
    const z = -200;
    const id = a.place('deer', x, z, 3);
    for (let i = 0; i < 3; i++) { a.get(id + i)!.mind.thirst = 0; }
    const f = frame({ ...away(x, z), timeOfDay: 0.5 });
    run(a, f, 90);
    const d = a.get(id)!;
    expect(['dense', 'deciduous', 'orchard', 'redwood']).toContain(['water', 'shore', 'meadow', 'flowers', 'tallGrass', 'farmland', 'wetland', 'town', 'redwood', 'rainforest', 'deciduous', 'orchard', 'dense', 'alpine', 'rock', 'snow'][t.biomeAt(d.x, d.z)]);
  }, 60000);
});

describe('สัตว์เล็กเป็นกลุ่ม (นกกิ้งโครง ผีเสื้อ ผึ้ง)', () => {
  const x = -1040;
  const z = -200;
  const gy = t.heightAt(x, z);
  const flowers: FlowerSpot[] = [];
  for (let i = 0; i < 120; i++) flowers.push({ kind: (['poppy', 'daisy', 'lupin', 'buttercup'] as const)[i % 4], x: x + 10 + (i % 12) * 1.3, y: gy, z: z + Math.floor(i / 12) * 1.3, rot: 0, scale: 0.5 });
  const tick = (c: Critters, seconds: number, part: 'day' | 'dusk' | 'night', rain = 0, px = x, pz = z, each?: () => void) => {
    for (let i = 0; i < seconds * 30; i++) { c.update(1 / 30, i / 30, px, pz, part, rain, flowers, 0, -1); each?.(); }
  };

  it('กลางวันมีฝูงนกกิ้งโครงในทุ่ง เกิดนอกสายตา บินอยู่เหนือพื้น', () => {
    const c = new Critters(t);
    let firstSeen: { x: number; z: number } | null = null;
    tick(c, 60, 'day', 0, x, z, () => {
      if (!firstSeen) { const b = c.targets(x, z, 400).find((v) => v.kind === 'starling'); if (b) firstSeen = { x: b.x, z: b.z }; }
    });
    expect(c.census().starling).toBeGreaterThanOrEqual(18);
    expect(firstSeen).not.toBeNull();
    expect(outOfView(firstSeen!.x - x, firstSeen!.z - z, 0, -1)).toBe(true);
    for (const b of c.targets(x, z, 400).filter((v) => v.kind === 'starling')) expect(b.y).toBeGreaterThan(t.heightAt(b.x, b.z) - 0.05);
  }, 60000);

  it('กลางคืนไม่มีนกกิ้งโครง ผีเสื้อ ผึ้ง · ฝนตกผีเสื้อกับผึ้งไม่ออก', () => {
    const c = new Critters(t);
    tick(c, 30, 'night');
    expect(c.census()).toMatchObject({ starling: 0, butterfly: 0, bee: 0 });
    tick(c, 30, 'day', 0.8);
    expect(c.census().butterfly).toBe(0);
    expect(c.census().bee).toBe(0);
  }, 60000);

  it('กลางวันผีเสื้อกับผึ้งบินอยู่รอบดอกไม้', () => {
    const c = new Critters(t);
    tick(c, 30, 'day');
    const cen = c.census();
    expect(cen.butterfly).toBeGreaterThan(3);
    expect(cen.bee).toBeGreaterThan(3);
    for (const b of c.targets(x, z, 60).filter((v) => v.kind !== 'starling')) {
      const near = flowers.some((f) => Math.hypot(f.x - b.x, f.z - b.z) < 9);
      expect(near).toBe(true);
    }
  }, 60000);

  it('ฝูงนกลงหากินบนพื้น เห็นคนเดินเข้าใกล้แล้วบินขึ้นพร้อมกัน', () => {
    const c = new Critters(t);
    let landed = false;
    for (let k = 0; k < 40 && !landed; k++) tick(c, 10, 'day', 0, x, z, () => { if (c.census().mode === 'land') landed = true; });
    expect(landed).toBe(true);
    const birds = c.targets(x, z, 400).filter((v) => v.kind === 'starling');
    const cx = birds.reduce((a, b) => a + b.x, 0) / birds.length;
    const cz = birds.reduce((a, b) => a + b.z, 0) / birds.length;
    tick(c, 2, 'day', 0, cx + 6, cz);
    expect(c.census().mode).toBe('fly');
  }, 60000);
});
