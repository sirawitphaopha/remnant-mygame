import { beforeEach, describe, expect, it } from 'vitest';
import { INK, SPECIES_BY_ID, decide, inkHit, newMind } from '../src/core/animals';
import { emptyLoadout, starterPack, type GearSlot } from '../src/core/gear';
import { carriedKg, carryLimit, depositAll, pickUp, takeFromRemains } from '../src/core/inventory';
import { ScanLog } from '../src/core/scanlog';
import { STAMINA, newStamina, stepStamina } from '../src/core/stamina';
import { SAVE_KEY, SAVE_VERSION, readSave, writeSave, type SaveData } from '../src/storage/save';
import { starterChoice } from '../src/core/gear';
import { Player, type SlopeGround } from '../src/player/Player';

// เทสของข้อที่แก้จากการตรวจทานรอบสอง (docs/BUGHUNT-2026-10-23.md)

describe('R1 R2 เก็บของจากซาก', () => {
  it('หยิบเท่าที่แบกไหว ที่เหลือค้างที่ซาก ไม่หาย', () => {
    const l = starterPack();
    while (pickUp(l, { itemId: 'book', kg: 0.5 }) !== 'full') { /* เก็บจนเต็ม */ }
    const before = carriedKg(l);
    const remains = [{ kind: 'item' as const, itemId: 'teddy', kg: 0.3 }, { kind: 'item' as const, itemId: 'bottle', kg: 0.4 }];
    const left = takeFromRemains(l, remains);
    expect(carriedKg(l)).toBeLessThanOrEqual(carryLimit(l) + 1e-9);
    expect(left.filter(Boolean).length + (carriedKg(l) > before ? 1 : 0)).toBeGreaterThanOrEqual(1);
  });
  it('ช่องเต็มแล้วยังรวมหมึกเข้าปืนเดิมได้', () => {
    const l = starterPack();
    const ink = l.belt.find((s) => s?.kind === 'gear' && s.id === 'inkGun') as GearSlot;
    ink.amount = 1;
    for (let i = 0; i < 9; i++) if (!l.belt[i]) l.belt[i] = { kind: 'item', itemId: 'coin', kg: 0.01 };
    const left = takeFromRemains(l, [{ kind: 'item', itemId: 'book', kg: 0.5 }, { kind: 'gear', id: 'inkGun', amount: 5 }]);
    expect(ink.amount).toBe(6);
    expect(left.filter(Boolean).length).toBe(1);
  });
});

describe('R6 ชิ้นพิเศษที่เก็บก่อนสแกน', () => {
  it('ฝากเข้ายานแล้วได้บันทึกส่วนตัว', () => {
    const l = emptyLoadout();
    l.belt[0] = { kind: 'gear', id: 'bag', bag: 'medium' };
    pickUp(l, { itemId: 'teddy', kg: 0.3, special: true });
    const log = new ScanLog();
    const items = depositAll(l);
    expect(items[0].special).toBe(true);
    expect(log.deposit(items[0].itemId, items[0].special)).toBe(true);
    expect(log.log('teddy')).toBe(true);
  });
});

describe('R7 R10 บันทึกสแกน', () => {
  it('ชนิดที่มีในโลกไม่ถึง 3 ชิ้น สแกนครบทุกชิ้นที่มีก็ได้ความจริง', () => {
    const log = new ScanLog();
    log.setAvailable({ bus: 1, painting: 2 });
    expect(log.scan('bus', 'bus-0').newTruth).toBe(true);
    log.scan('painting', 'p0');
    expect(log.truth('painting')).toBe(false);
    log.scan('painting', 'p1');
    expect(log.truth('painting')).toBe(true);
    expect(log.needFor('car')).toBe(3);
  });
  it('โหลดบันทึกที่เสีย ตัดรหัสซ้ำ จำนวนฝากไม่ติดลบ', () => {
    const log = new ScanLog();
    log.load(JSON.stringify([['car', { seen: ['a', 'a', 'a'], log: false, deposited: -5 }]]));
    expect(log.count('car')).toBe(1);
    expect(log.records.get('car')!.deposited).toBe(0);
  });
});

describe('R12 หมีโดนหมึก', () => {
  it('ดุมีเวลาหมด แล้วกลับมาเคารพระยะกลับบ้าน', () => {
    const bear = SPECIES_BY_ID.get('bear')!;
    const m = newMind();
    inkHit(m, bear);
    expect(m.enraged).toBe(true);
    for (let t = 0; t < INK.enragedSeconds + 1; t += 0.5) decide(m, bear, 0.5, 100, 0);
    expect(m.enraged).toBe(false);
  });
});

describe('R5 แบกหนัก', () => {
  it('แบกเกิน 70% เดินราบก็เหนื่อย แบกเบาเดินไม่เหนื่อย', () => {
    const light = newStamina();
    const heavy = newStamina();
    light.value = heavy.value = 50;
    stepStamina(light, 1, 'walk', 0, 0.3);
    stepStamina(heavy, 1, 'walk', 0, 1);
    expect(heavy.value).toBeLessThan(50);
    expect(light.value).toBeGreaterThanOrEqual(50);
    expect(STAMINA.heavyWalk).toBeGreaterThan(0);
  });
});

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('R14 R15 บันทึก', () => {
  beforeEach(() => { (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage(); });
  const good = (): SaveData => ({
    version: SAVE_VERSION, savedAt: 5, gameTime: 1, bodyNumber: 1, player: { x: 0, z: 0, heading: 0, y: 3 },
    loadout: starterPack(), shipChoice: starterChoice(), scanLog: '[]', explore: '', takenProps: [], corpses: [{ n: 1, x: 1, z: 2, y: 4, slots: [] }], droppedBags: [], body: { oxygen: 1, cracks: 0, warmth: 1 },
  });
  it('บันทึกที่ขาดช่อง ถือว่าเสีย ไม่โหลดครึ่ง ๆ กลาง ๆ', () => {
    const d = good() as unknown as Record<string, unknown>;
    delete (d.loadout as Record<string, unknown>).arms;
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    expect(readSave()).toBeNull();
  });
  it('เก็บความสูงได้ (ถ้ำ หลังคา)', () => {
    writeSave(good());
    expect(readSave()!.player.y).toBe(3);
    expect(readSave()!.corpses[0].y).toBe(4);
  });
  it('ไม่มีที่เก็บ = บอกว่าบันทึกไม่ได้', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined;
    expect(writeSave(good())).toBe(false);
  });
});

describe('W23 W24 ตัวละคร', () => {
  // พื้นลาดชันมากทั้งผืน (ไถลตลอด) ใช้ลองว่าไถลไม่เร็วไม่จำกัด
  const steep: SlopeGround = {
    contextY: Infinity,
    heightAt: (_x, z) => 400 - z * 1.4,
    waterAt: () => -Infinity,
    normalAt: () => { const n = Math.hypot(1.4, 1); return [0, 1 / n, 1.4 / n]; },
  };
  it('ไถลมีความเร็วสูงสุด และวางตัวใหม่แล้วไม่ค้างสถานะไถล', () => {
    const p = new Player(steep);
    p.place(0, -200, 0);
    let top = 0;
    for (let i = 0; i < 600; i++) {
      p.update(1 / 60, { x: 0, z: 0, run: false, jump: false, climbGear: false, loadRatio: 0 });
      top = Math.max(top, Math.hypot(p.vx, p.vz));
    }
    expect(p.sliding).toBe(true);
    expect(top).toBeLessThanOrEqual(12.01);
    p.place(0, 0, 0);
    expect(p.sliding).toBe(false);
    expect(p.lastFall).toBe(0);
  });
});
