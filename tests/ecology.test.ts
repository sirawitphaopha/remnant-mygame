import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_BY_ID } from '../src/core/animals';
import { ECO, ECO_BY_ID, FOOD, dayPart, fleeDir, flockStep, groupsWanted, herdSize, newEcoMind, outOfView, pickStraggler, think, type Sense } from '../src/core/ecology';
import { BIOME_NAMES } from '../src/world/terrainGen';

const sp = (id: string) => SPECIES_BY_ID.get(id)!;
const eco = (id: string) => ECO_BY_ID.get(id)!;
const sense = (o: Partial<Sense> = {}): Sense => ({ part: 'dawn', rain: 0, player: Infinity, predator: Infinity, prey: Infinity, carcass: Infinity, food: Infinity, fishing: false, fromHome: 0, inRest: false, ...o });

describe('ระบบนิเวศ (รอบสอง ช่วง 12)', () => {
  it('สัตว์ทุกชนิดมีนิสัยตามถิ่น ชื่อชนิดพื้นที่ตรงกับภูมิประเทศ', () => {
    expect(ECO.map((e) => e.id).sort()).toEqual(SPECIES.map((s) => s.id).sort());
    for (const e of ECO) for (const b of [...e.feed, ...(e.rest ?? [])]) expect(BIOME_NAMES, `${e.id} ${b}`).toContain(b);
  });
  it('ช่วงของวัน', () => {
    expect(dayPart(5 / 24)).toBe('dawn');
    expect(dayPart(0.5)).toBe('day');
    expect(dayPart(18.5 / 24)).toBe('dusk');
    expect(dayPart(23 / 24)).toBe('night');
    expect(dayPart(1.5)).toBe('day');
  });
  it('กวางออกทุ่งตอนเช้ามืด กลางวันหลบเข้าป่า เข้าป่าแล้วเล็มหญ้าอยู่ในนั้น', () => {
    const m = newEcoMind(0, 0);
    expect(['wander', 'graze']).toContain(think(m, sp('deer'), eco('deer'), sense({ part: 'dawn' }), 0.1));
    expect(think(m, sp('deer'), eco('deer'), sense({ part: 'day' }), 0.1)).toBe('shelter');
    expect(['wander', 'graze']).toContain(think(m, sp('deer'), eco('deer'), sense({ part: 'day', inRest: true }), 0.1));
  });
  it('เดินสักพักแล้วเล็มหญ้า เล็มสักพักแล้วเดินต่อ', () => {
    const m = newEcoMind(0, 0);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(think(m, sp('deer'), eco('deer'), sense(), 0.1));
    expect(seen).toEqual(new Set(['wander', 'graze']));
  });
  it('เหยื่อเห็นผู้ล่าใกล้แล้วหนี', () => {
    expect(think(newEcoMind(), sp('deer'), eco('deer'), sense({ predator: FOOD.alarm - 5 }), 0.1)).toBe('flee');
    expect(think(newEcoMind(), sp('rabbit'), eco('rabbit'), sense({ predator: FOOD.alarm - 5 }), 0.1)).toBe('flee');
  });
  it('หมาป่าหิวเห็นเหยื่อแล้วล่า ย่องเข้าหาแล้ววิ่งไล่ ไล่นานเกินแล้วเลิก (ล่าพลาด) พักก่อนล่าใหม่', () => {
    const m = newEcoMind(0.8, 0);
    const s = sense({ part: 'night', prey: 40 });
    expect(think(m, sp('wolf'), eco('wolf'), s, 0.1)).toBe('hunt');
    // ย่องเข้าไปใกล้แล้ววิ่งไล่ (App ตั้งค่านี้ตอนเริ่มวิ่ง)
    m.rush = 0;
    let t = 'hunt';
    for (let i = 0; i < (FOOD.chaseSeconds + 1) * 10; i++) t = think(m, sp('wolf'), eco('wolf'), s, 0.1);
    expect(t).not.toBe('hunt');
    expect(m.huntRest).toBeGreaterThan(0);
    expect(think(m, sp('wolf'), eco('wolf'), s, 0.1)).not.toBe('hunt');
  });
  it('หมาป่าอิ่มไม่ล่า · ไม่หิวพอก็ไม่ล่า', () => {
    expect(think(newEcoMind(0.1, 0), sp('wolf'), eco('wolf'), sense({ part: 'night', prey: 20 }), 0.1)).not.toBe('hunt');
  });
  it('ซากใกล้ หมาป่ากับอีกาเข้าไปกิน อิ่มแล้วเลิกกิน', () => {
    const w = newEcoMind(0.6, 0);
    expect(think(w, sp('wolf'), eco('wolf'), sense({ carcass: 10 }), 0.1)).toBe('eat');
    w.hunger = 0;
    expect(think(w, sp('wolf'), eco('wolf'), sense({ carcass: 3 }), 0.1)).not.toBe('eat');
    expect(w.huntRest).toBeGreaterThan(0);
    expect(think(newEcoMind(0.5, 0), sp('crow'), eco('crow'), sense({ part: 'day', carcass: 20 }), 0.1)).toBe('eat');
  });
  it('ฝนตก กวางหลบเข้าป่า กบยังออกมา', () => {
    expect(think(newEcoMind(0, 0), sp('deer'), eco('deer'), sense({ rain: 0.8 }), 0.1)).toBe('shelter');
    expect(think(newEcoMind(0, 0), sp('frog'), eco('frog'), sense({ part: 'night', rain: 0.8 }), 0.1)).toBe('wander');
  });
  it('กระหายน้ำแล้วลงกินน้ำ ดื่มจนหายแล้วเลิก', () => {
    const m = newEcoMind(0, 0.95);
    expect(think(m, sp('deer'), eco('deer'), sense(), 0.1)).toBe('drink');
    m.thirst = 0;
    expect(think(m, sp('deer'), eco('deer'), sense(), 0.1)).not.toBe('drink');
  });
  it('หมีหิวไปกินผลไม้ ใกล้น้ำตกไปจับปลา', () => {
    expect(think(newEcoMind(0.6, 0), sp('bear'), eco('bear'), sense({ food: 30 }), 0.1)).toBe('forage');
    expect(think(newEcoMind(0.6, 0), sp('bear'), eco('bear'), sense({ food: 30, fishing: true }), 0.1)).toBe('fish');
  });
  it('ผีเสื้อกับผึ้งไม่ออกตอนกลางคืน หิ่งห้อยออกกลางคืน นกกิ้งโครงตอนพลบค่ำรวมฝูงใหญ่ขึ้น', () => {
    expect(groupsWanted(eco('butterfly'), 'night', 0)).toBe(0);
    expect(groupsWanted(eco('bee'), 'day', 0)).toBeGreaterThan(0);
    expect(groupsWanted(eco('firefly'), 'night', 0)).toBeGreaterThan(0);
    expect(herdSize(eco('starling'), 0.5, 'dusk')).toBeGreaterThan(herdSize(eco('starling'), 0.5, 'day'));
  });
  it('หมาป่าเลือกตัวหลงฝูง', () => {
    const xs = [0, 1, -1, 0, 14];
    const zs = [0, 1, 0, -1, 2];
    expect(pickStraggler(xs, zs, 30, 0)).toBe(4);
    expect(pickStraggler([], [], 0, 0)).toBe(-1);
  });
  it('หนีไปทางขอบแมพ หักขนานกับขอบ ไม่วิ่งชนขอบอยู่กับที่ (รายงานตรวจข้อ 102)', () => {
    const [ux, uz] = fleeDir(1480, 10, 1460, 8, 1500);
    expect(ux).toBe(0);
    expect(Math.abs(uz)).toBeCloseTo(1);
    const [cx, cz] = fleeDir(1490, 1490, 1470, 1470, 1500);
    expect(cx).toBeLessThan(0);
    expect(cz).toBeLessThan(0);
    const [fx] = fleeDir(0, 0, -10, 0, 1500);
    expect(fx).toBeCloseTo(1);
  });
  it('จุดเกิดอยู่นอกสายตา: หลังกล้องได้ ข้างหน้าใกล้ไม่ได้ ข้างหน้าไกลหมอกบังได้ (รายงานตรวจข้อ 101)', () => {
    expect(outOfView(0, 60, 0, -1)).toBe(true);
    expect(outOfView(0, -60, 0, -1)).toBe(false);
    expect(outOfView(5, -60, 0, -1)).toBe(false);
    expect(outOfView(60, -10, 0, -1)).toBe(true);
    expect(outOfView(0, -200, 0, -1)).toBe(true);
  });
  it('ฝูงนกบินตามเป้า ไม่แตกฝูง ไม่ชนกันเป็นก้อนเดียว', () => {
    const n = 24;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (i % 5) * 1.5; pos[i * 3 + 1] = 20 + (i % 3); pos[i * 3 + 2] = Math.floor(i / 5) * 1.5; vel[i * 3] = 5; }
    const p = { sep: 1.2, see: 8, minSpeed: 6, maxSpeed: 12, pull: 0.06, cohesion: 0.5 };
    const centroid = () => { let x = 0, z = 0; for (let i = 0; i < n; i++) { x += pos[i * 3]; z += pos[i * 3 + 2]; } return [x / n, z / n]; };
    for (let k = 0; k < 600; k++) flockStep(pos, vel, n, 200, 25, 0, 1 / 30, p);
    const [cx, cz] = centroid();
    expect(Math.hypot(cx - 200, cz)).toBeLessThan(60);
    let spread = 0;
    let minD = Infinity;
    for (let i = 0; i < n; i++) {
      spread = Math.max(spread, Math.hypot(pos[i * 3] - cx, pos[i * 3 + 2] - cz));
      for (let j = i + 1; j < n; j++) minD = Math.min(minD, Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]));
    }
    expect(spread).toBeLessThan(40);
    expect(minD).toBeGreaterThan(0.15);
  });
});
