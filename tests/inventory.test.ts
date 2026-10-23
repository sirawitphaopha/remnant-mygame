import { describe, expect, it } from 'vitest';
import { KINDS } from '../src/core/catalog';
import { emptyLoadout, starterPack } from '../src/core/gear';
import { carriedKg, carryLimit, depositAll, dropBag, nestBag, pickUp, takeBag, takeFromRemains } from '../src/core/inventory';
import { ScanLog } from '../src/core/scanlog';

describe('ข้อความสแกน', () => {
  it('ทุกชนิดมีครบทั้งไทยและอังกฤษ ทั้งชื่อ คำเดา ความจริง', () => {
    for (const k of KINDS) {
      for (const f of [k.name, k.alienName, k.guess, k.truth, ...(k.log ? [k.log] : [])]) {
        expect(f.th.length, k.id).toBeGreaterThan(0);
        expect(f.en.length, k.id).toBeGreaterThan(0);
      }
      if (k.small) expect(k.kg, k.id).toBeGreaterThan(0);
    }
    expect(KINDS.length).toBeGreaterThanOrEqual(40);
  });
});

describe('สแกน 3 ชั้น', () => {
  it('ครั้งแรกได้ชั้น 1 ครบ 3 ชิ้นได้ชั้น 2 สแกนชิ้นเดิมซ้ำไม่นับ', () => {
    const s = new ScanLog();
    expect(s.scan('car', 'a').firstTime).toBe(true);
    expect(s.scan('car', 'a').count).toBe(1);
    s.scan('car', 'b');
    const r = s.scan('car', 'c');
    expect(r.newTruth).toBe(true);
    expect(s.truth('car')).toBe(true);
  });
  it('ชิ้นพิเศษปลดล็อกบันทึกส่วนตัว แต่ไม่ข้ามชั้นความจริง', () => {
    const s = new ScanLog();
    const r = s.scan('car', 'x', true);
    expect(r.newLog).toBe(true);
    expect(s.truth('car')).toBe(false);
    expect(s.scan('bus', 'y', true).newLog).toBe(false);
  });
  it('บันทึกแล้วโหลดกลับได้', () => {
    const s = new ScanLog();
    s.scan('teddy', 'a');
    s.deposit('teddy');
    const s2 = new ScanLog();
    s2.load(s.serialize());
    expect(s2.records.get('teddy')).toEqual(s.records.get('teddy'));
  });
});

describe('กระเป๋าและน้ำหนัก', () => {
  it('เก็บของใส่กระเป๋า น้ำหนักเพิ่ม', () => {
    const l = starterPack();
    const before = carriedKg(l);
    expect(pickUp(l, { itemId: 'teddy', kg: 0.3 })).toBe('bag');
    expect(carriedKg(l)).toBeCloseTo(before + 0.3);
  });
  it('กระเป๋าเต็มแล้วถือในช่องว่าง เกินที่แบกได้เก็บไม่ได้', () => {
    const l = starterPack();
    for (let i = 0; i < 8; i++) pickUp(l, { itemId: 'book', kg: 1.4 }); // 11.2 กก. ในกระเป๋าใบกลาง 12
    expect(pickUp(l, { itemId: 'book', kg: 1.4 })).toBe('hand');
    let r = pickUp(l, { itemId: 'book', kg: 1.4 });
    while (r !== 'full') r = pickUp(l, { itemId: 'book', kg: 1.4 });
    expect(carriedKg(l)).toBeLessThanOrEqual(carryLimit(l));
  });
  it('ไม่มีกระเป๋า ถือได้แค่ช่องว่างในแถบ', () => {
    const l = emptyLoadout();
    expect(pickUp(l, { itemId: 'coin', kg: 0.01 })).toBe('hand');
    expect(l.belt[0]).toMatchObject({ kind: 'item', itemId: 'coin' });
  });
  it('ฝากของเข้ายาน เอาออกจากกระเป๋าทุกชั้นและจากมือ', () => {
    const l = starterPack();
    pickUp(l, { itemId: 'teddy', kg: 0.3 });
    l.belt[8] = { kind: 'gear', id: 'bag', bag: 'small' };
    pickUp(l, { itemId: 'coin', kg: 0.01 });
    expect(nestBag(l, 8, 6)).toBe(true);
    l.belt[7] = { kind: 'item', itemId: 'watch', kg: 0.1 };
    const out = depositAll(l).map((x) => x.itemId).sort();
    expect(out).toEqual(['coin', 'teddy', 'watch']);
    expect(l.belt[7]).toBeNull();
  });
  it('วางกระเป๋าแล้วหยิบคืน ของข้างในอยู่ครบ', () => {
    const l = starterPack();
    pickUp(l, { itemId: 'frame', kg: 0.9 });
    const bag = dropBag(l, 6)!;
    expect(l.belt[6]).toBeNull();
    expect(bag.contents.items).toHaveLength(1);
    expect(takeBag(l, bag)).toBe(true);
    expect(carriedKg(l)).toBeGreaterThan(9.5);
  });
});

describe('เก็บของจากซาก', () => {
  it('ของที่เก็บกับกระเป๋าก่อน อุปกรณ์ซ้ำไม่เก็บ หมึกรวมกับของเดิม', () => {
    const corpse = starterPack();
    pickUp(corpse, { itemId: 'teddy', kg: 0.3 });
    corpse.belt[7] = { kind: 'item', itemId: 'book', kg: 1.4 };
    const mine = starterPack();
    const left = takeFromRemains(mine, corpse.belt);
    expect(left.filter(Boolean)).toHaveLength(0);
    expect(mine.belt.filter((s) => s && s.kind === 'gear' && s.id === 'scanner')).toHaveLength(1);
    expect(mine.belt.find((s) => s && s.kind === 'gear' && s.id === 'inkGun')).toMatchObject({ amount: 10 });
    expect(mine.belt.filter((s) => s && s.kind === 'item')).toHaveLength(1);
    expect(mine.belt.filter((s) => s && s.kind === 'gear' && s.id === 'bag')).toHaveLength(2);
  });
});
