import { kind } from './catalog';

// บันทึกการสแกนและคอลเลกชัน · ส่งเข้ายานทันทีที่สแกน ตายแล้วไม่หาย
// ชั้น 1 เดา (สแกนครั้งแรก) · ชั้น 2 ความจริง (ครบ 3 ชิ้น) · ชั้น 3 บันทึกส่วนตัว (สแกนชิ้นพิเศษ) แยกกัน ชั้น 3 ไม่ข้ามชั้น 2

/** สแกนของชนิดเดียวกันครบกี่ชิ้น ถึงปลดล็อกชั้นความจริง */
export const TRUTH_AFTER = 3;

export interface KindRecord {
  /** รหัสชิ้นที่เคยสแกน (ไม่นับซ้ำ) */
  seen: string[];
  /** ได้บันทึกส่วนตัวแล้ว */
  log: boolean;
  /** ของชิ้นเล็กที่เอากลับไปวางที่ยานแล้วกี่ชิ้น */
  deposited: number;
}

export interface ScanResult {
  kindId: string;
  firstTime: boolean;
  /** เพิ่งปลดล็อกความจริง */
  newTruth: boolean;
  /** เพิ่งปลดล็อกบันทึกส่วนตัว */
  newLog: boolean;
  /** ชิ้นนี้เพิ่งสแกนครั้งแรก (ชิ้นที่เคยสแกนแล้ว สแกนซ้ำไม่นับเพิ่ม ไม่เด้งข้อความ) */
  newObject: boolean;
  count: number;
}

export class ScanLog {
  readonly records = new Map<string, KindRecord>();
  /** จำนวนชิ้นที่มีอยู่จริงในโลกต่อชนิด · ชนิดที่มีไม่ถึง 3 ชิ้น ปลดความจริงเมื่อสแกนครบทุกชิ้นที่มี */
  private available = new Map<string, number>();

  setAvailable(counts: Record<string, number>): void {
    this.available = new Map(Object.entries(counts));
  }

  /** ต้องสแกนกี่ชิ้นถึงปลดความจริงของชนิดนี้ */
  needFor(kindId: string): number {
    const have = this.available.get(kindId);
    return have === undefined ? TRUTH_AFTER : Math.max(1, Math.min(TRUTH_AFTER, have));
  }

  private rec(kindId: string): KindRecord {
    let r = this.records.get(kindId);
    if (!r) {
      r = { seen: [], log: false, deposited: 0 };
      this.records.set(kindId, r);
    }
    return r;
  }

  /**
   * สแกนของหนึ่งชิ้น
   * @param special ชิ้นพิเศษที่ปลดล็อกบันทึกส่วนตัว (ชั้น 3)
   */
  scan(kindId: string, key: string, special = false): ScanResult {
    const firstTime = !this.records.has(kindId) || this.records.get(kindId)!.seen.length === 0;
    const r = this.rec(kindId);
    const need = this.needFor(kindId);
    const hadTruth = r.seen.length >= need;
    const newObject = !r.seen.includes(key);
    if (newObject) r.seen.push(key);
    const newTruth = !hadTruth && r.seen.length >= need;
    let newLog = false;
    if (special && !r.log && kind(kindId)?.log) {
      r.log = true;
      newLog = true;
    }
    return { kindId, firstTime, newTruth, newLog, newObject, count: r.seen.length };
  }

  /** สแกนแล้วหรือยัง */
  known(kindId: string): boolean {
    return (this.records.get(kindId)?.seen.length ?? 0) > 0 || (this.records.get(kindId)?.deposited ?? 0) > 0;
  }

  truth(kindId: string): boolean {
    return (this.records.get(kindId)?.seen.length ?? 0) >= this.needFor(kindId);
  }

  log(kindId: string): boolean {
    return this.records.get(kindId)?.log ?? false;
  }

  count(kindId: string): number {
    return this.records.get(kindId)?.seen.length ?? 0;
  }

  /** ชั้นที่ได้แล้วสูงสุด (ไว้แสดงสั้น ๆ) 0 ยังไม่เคยเจอ */
  layer(kindId: string): 0 | 1 | 2 | 3 {
    if (!this.known(kindId)) return 0;
    if (this.log(kindId) && this.truth(kindId)) return 3;
    return this.truth(kindId) ? 2 : 1;
  }

  /** ฝากของชิ้นเล็กเข้ายาน · ชิ้นพิเศษปลดบันทึกส่วนตัวให้ด้วย (เก็บก่อนสแกนก็ไม่พลาดชั้น 3) คืน true ถ้าเพิ่งได้ชั้น 3 */
  deposit(kindId: string, special = false): boolean {
    const r = this.rec(kindId);
    r.deposited++;
    if (special && !r.log && kind(kindId)?.log) {
      r.log = true;
      return true;
    }
    return false;
  }

  serialize(): string {
    return JSON.stringify([...this.records.entries()]);
  }

  load(s: string): void {
    this.records.clear();
    try {
      const arr = JSON.parse(s) as [string, KindRecord][];
      for (const [id, r] of arr) {
        if (typeof id !== 'string' || !r || !Array.isArray(r.seen)) continue;
        const seen = [...new Set(r.seen.filter((x) => typeof x === 'string'))];
        this.records.set(id, { seen, log: r.log === true, deposited: Math.max(0, Math.floor(Number(r.deposited) || 0)) });
      }
    } catch {
      // ข้อมูลเสีย เริ่มใหม่
    }
  }
}
