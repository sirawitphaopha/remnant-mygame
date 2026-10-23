import { GEAR, SUIT_CARRY_KG, slotKg, type BagSize, type GearSlot, type Loadout } from './gear';

// กระเป๋า น้ำหนัก เก็บของ วางกระเป๋า ฝากของเข้ายาน · กติกาล้วน
// พี่กันเคาะ: ทุกอย่างมีน้ำหนักเป็นกิโลกรัม · ใส่กระเป๋าซ้อนกระเป๋าได้ · วางกระเป๋าที่เต็มไว้ที่ไหนก็ได้ ขากลับค่อยมาหยิบ

export interface CarriedItem { itemId: string; kg: number }
export interface NestedBag { size: BagSize; contents: BagContents }
export interface BagContents { items: CarriedItem[]; bags: NestedBag[] }

export function emptyContents(): BagContents {
  return { items: [], bags: [] };
}

function contentsOf(s: GearSlot): BagContents {
  const g = s as GearSlot & { contents?: BagContents };
  if (!g.contents) g.contents = emptyContents();
  return g.contents;
}

/** น้ำหนักของในกระเป๋า (รวมกระเป๋าที่ซ้อนอยู่ข้างใน) */
export function contentsKg(c: BagContents): number {
  let kg = 0;
  for (const it of c.items) kg += it.kg;
  for (const b of c.bags) kg += GEAR.bag[b.size].kg + contentsKg(b.contents);
  return kg;
}

export function bagCap(size: BagSize): number {
  return GEAR.bag[size].capKg;
}

export function isBag(s: unknown): s is GearSlot & { contents?: BagContents } {
  return !!s && (s as GearSlot).kind === 'gear' && (s as GearSlot).id === 'bag';
}

/** น้ำหนักที่แบกทั้งหมด (อุปกรณ์ กระเป๋า ของในกระเป๋า ของที่ถือในมือ) */
export function carriedKg(l: Loadout): number {
  let kg = 0;
  for (const s of l.belt) {
    kg += slotKg(s);
    if (isBag(s)) kg += contentsKg(contentsOf(s));
  }
  return kg;
}

/** แบกได้มากสุดเท่าไร = ชุดอวกาศ + ความจุกระเป๋าที่สะพายอยู่ */
export function carryLimit(l: Loadout): number {
  let cap = SUIT_CARRY_KG;
  for (const s of l.belt) if (isBag(s)) cap += bagCap(s.bag ?? 'medium');
  return cap;
}

/** สัดส่วนน้ำหนัก ใช้คิดแรง */
export function loadRatio(l: Loadout): number {
  return carriedKg(l) / carryLimit(l);
}

export type PickResult = 'bag' | 'hand' | 'full';

/** เก็บของชิ้นเล็ก: ใส่กระเป๋าใบแรกที่ยังรับได้ ไม่งั้นถือในช่องว่างของแถบ · เกินที่รับได้ = เก็บไม่ได้ */
export function pickUp(l: Loadout, item: CarriedItem): PickResult {
  if (carriedKg(l) + item.kg > carryLimit(l) + 1e-9) return 'full';
  for (const s of l.belt) {
    if (!isBag(s)) continue;
    const c = contentsOf(s);
    if (contentsKg(c) + item.kg <= bagCap(s.bag ?? 'medium') + 1e-9) {
      c.items.push(item);
      return 'bag';
    }
  }
  const free = l.belt.indexOf(null);
  if (free >= 0) {
    l.belt[free] = { kind: 'item', itemId: item.itemId, kg: item.kg };
    return 'hand';
  }
  return 'full';
}

/** ฝากของทั้งหมดเข้ายาน (ทั้งในกระเป๋าทุกชั้นและที่ถือในมือ) · คืนรายการที่ฝาก */
export function depositAll(l: Loadout): CarriedItem[] {
  const out: CarriedItem[] = [];
  const drain = (c: BagContents) => {
    out.push(...c.items);
    c.items = [];
    for (const b of c.bags) drain(b.contents);
  };
  l.belt.forEach((s, i) => {
    if (!s) return;
    if (s.kind === 'item') {
      out.push({ itemId: s.itemId, kg: s.kg });
      l.belt[i] = null;
      const a = l.arms.indexOf(i);
      if (a >= 0) l.arms[a] = null;
    } else if (isBag(s)) drain(contentsOf(s));
  });
  return out;
}

/** ใส่กระเป๋าช่อง from เข้าไปในกระเป๋าช่อง into */
export function nestBag(l: Loadout, from: number, into: number): boolean {
  const a = l.belt[from];
  const b = l.belt[into];
  if (from === into || !isBag(a) || !isBag(b)) return false;
  const inner: NestedBag = { size: a.bag ?? 'medium', contents: contentsOf(a) };
  const add = GEAR.bag[inner.size].kg + contentsKg(inner.contents);
  if (contentsKg(contentsOf(b)) + add > bagCap(b.bag ?? 'medium') + 1e-9) return false;
  contentsOf(b).bags.push(inner);
  l.belt[from] = null;
  const arm = l.arms.indexOf(from);
  if (arm >= 0) l.arms[arm] = null;
  return true;
}

/** เอากระเป๋าที่ซ้อนอยู่ออกมาไว้ในช่องว่างของแถบ */
export function unnestBag(l: Loadout, parent: number, index: number): boolean {
  const p = l.belt[parent];
  const free = l.belt.indexOf(null);
  if (!isBag(p) || free < 0) return false;
  const c = contentsOf(p);
  const inner = c.bags[index];
  if (!inner) return false;
  c.bags.splice(index, 1);
  l.belt[free] = { kind: 'gear', id: 'bag', bag: inner.size, contents: inner.contents } as GearSlot;
  return true;
}

/** วางกระเป๋าช่องนั้นลงพื้น · คืนกระเป๋าพร้อมของข้างใน */
export function dropBag(l: Loadout, index: number): NestedBag | null {
  const s = l.belt[index];
  if (!isBag(s)) return null;
  l.belt[index] = null;
  const a = l.arms.indexOf(index);
  if (a >= 0) l.arms[a] = null;
  return { size: s.bag ?? 'medium', contents: contentsOf(s) };
}

/** หยิบกระเป๋าที่วางไว้กลับมา · ต้องมีช่องว่างและแบกไหว */
export function takeBag(l: Loadout, bag: NestedBag): boolean {
  const free = l.belt.indexOf(null);
  if (free < 0) return false;
  const add = GEAR.bag[bag.size].kg + contentsKg(bag.contents);
  const newLimit = carryLimit(l) + bagCap(bag.size);
  if (carriedKg(l) + add > newLimit + 1e-9) return false;
  l.belt[free] = { kind: 'gear', id: 'bag', bag: bag.size, contents: bag.contents } as GearSlot;
  return true;
}

/** ของทุกชิ้นในกระเป๋าช่องนั้น (รวมที่ซ้อน) ไว้แสดงในหน้ากระเป๋า */
export function bagContents(l: Loadout, index: number): BagContents | null {
  const s = l.belt[index];
  return isBag(s) ? contentsOf(s) : null;
}

/**
 * เก็บของจากซาก · ของที่เก็บมากับกระเป๋าก่อน แล้วค่อยอุปกรณ์
 * อุปกรณ์ที่มีอยู่แล้ว (ยานจำลองให้ใหม่) ไม่เก็บซ้ำ แต่หมึก กาว ถังออกซิเจน รวมเข้ากับของเดิมจนเต็ม
 * คืนของที่ยังเหลืออยู่ที่ซาก
 */
export function takeFromRemains(l: Loadout, slots: (Loadout['belt'][number])[]): (Loadout['belt'][number])[] {
  const left = slots.slice();
  const order = left.map((s, i) => ({ s, i })).filter((x) => x.s).sort((a, b) => rank(a.s) - rank(b.s));
  for (const { s, i } of order) {
    if (!s) continue;
    if (s.kind === 'gear' && s.id !== 'bag') {
      const mine = l.belt.find((x) => x && x.kind === 'gear' && x.id === s.id) as GearSlot | undefined;
      if (mine) {
        if (s.id === 'inkGun' || s.id === 'glueGun' || s.id === 'oxygenTank') {
          const max = s.id === 'inkGun' ? GEAR.inkGun.max : s.id === 'glueGun' ? GEAR.glueGun.max : GEAR.oxygenTank.max;
          mine.amount = Math.min(max, (mine.amount ?? 0) + (s.amount ?? 0));
        }
        left[i] = null;
        continue;
      }
    }
    const free = l.belt.indexOf(null);
    if (free < 0) break;
    l.belt[free] = s;
    left[i] = null;
  }
  return left;
}

function rank(s: Loadout['belt'][number]): number {
  if (!s) return 9;
  if (s.kind === 'item') return 0;
  if (s.id === 'bag') return 1;
  return 2;
}
