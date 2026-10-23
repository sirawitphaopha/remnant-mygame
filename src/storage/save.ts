// บันทึกความคืบหน้าในเบราว์เซอร์เครื่องนี้ (พี่กันเคาะ) · ล้างแคชแล้วหาย
// อ่านเขียนห่อ try/catch ทุกครั้ง เปิดแบบส่วนตัวหรือเบราว์เซอร์ห้ามเก็บ เกมยังเล่นได้ แค่ไม่บันทึก

import type { Slot, ShipChoice } from '../core/gear';
import type { NestedBag } from '../core/inventory';

export const SAVE_KEY = 'remnant.save.v1';
export const SETTINGS_KEY = 'remnant.settings.v1';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  savedAt: number;
  gameTime: number;
  bodyNumber: number;
  /** y = ความสูงเท้าตอนบันทึก (อยู่ในถ้ำหรือบนหลังคาจะได้โหลดกลับที่เดิม) */
  player: { x: number; z: number; heading: number; y?: number };
  loadout: { belt: Slot[]; arms: (number | null)[] };
  shipChoice: ShipChoice;
  scanLog: string;
  explore: string;
  takenProps: string[];
  corpses: { n: number; x: number; z: number; y?: number; slots: Slot[] }[];
  droppedBags: { x: number; z: number; y?: number; bag: NestedBag; beacon: boolean }[];
  body: { oxygen: number; cracks: number; warmth: number };
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  lang: 'th' | 'en';
  nature: number;
  gear: number;
  sensitivity: number;
  viewDistance: number;
}

export const DEFAULT_SETTINGS: Settings = { quality: 'medium', lang: 'th', nature: 0.8, gear: 0.65, sensitivity: 0.45, viewDistance: 0.6 };

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** เขียนบันทึก · คืน false ถ้าเบราว์เซอร์ไม่ให้เก็บหรือที่เก็บเต็ม (ผู้เรียกต้องบอกคนเล่น) */
export function writeSave(d: SaveData): boolean {
  const st = storage();
  if (!st) return false;
  try {
    st.setItem(SAVE_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** เวลาที่บันทึกในเครื่องถูกเขียนล่าสุด (ไว้ดูว่ามีแท็บอื่นเขียนทับหรือไม่) · ไม่มีบันทึก = 0 */
export function storedSavedAt(): number {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return 0;
    const m = /"savedAt":(\d+)/.exec(raw);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const arr = Array.isArray;

/** ตรวจทุกช่องของบันทึก ช่องไหนผิดรูป = ถือว่าบันทึกเสีย (เริ่มใหม่ ไม่โหลดครึ่ง ๆ กลาง ๆ) */
function valid(d: SaveData): boolean {
  if (!d || d.version !== SAVE_VERSION || !num(d.gameTime) || !num(d.bodyNumber) || !num(d.savedAt)) return false;
  if (!d.player || !num(d.player.x) || !num(d.player.z) || !num(d.player.heading)) return false;
  if (!d.loadout || !arr(d.loadout.belt) || !arr(d.loadout.arms)) return false;
  if (!d.shipChoice || typeof d.shipChoice !== 'object') return false;
  if (typeof d.scanLog !== 'string' || typeof d.explore !== 'string' || !arr(d.takenProps)) return false;
  if (!arr(d.corpses) || !d.corpses.every((c) => c && num(c.n) && num(c.x) && num(c.z) && arr(c.slots))) return false;
  if (!arr(d.droppedBags) || !d.droppedBags.every((b) => b && num(b.x) && num(b.z) && b.bag && typeof b.bag === 'object')) return false;
  if (!d.body || !num(d.body.oxygen) || !num(d.body.cracks) || !num(d.body.warmth)) return false;
  return true;
}

/** อ่านบันทึก · ข้อมูลเสียหรือรุ่นไม่ตรง คืน null (เริ่มใหม่) */
export function readSave(): SaveData | null {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return valid(d) ? d : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // ไม่ได้ก็ไม่เป็นไร
  }
}

export function readSettings(): Settings {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<Settings>;
    const num = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    return {
      quality: s.quality === 'low' || s.quality === 'high' ? s.quality : 'medium',
      lang: s.lang === 'en' ? 'en' : 'th',
      nature: num(s.nature, DEFAULT_SETTINGS.nature),
      gear: num(s.gear, DEFAULT_SETTINGS.gear),
      sensitivity: num(s.sensitivity, DEFAULT_SETTINGS.sensitivity),
      viewDistance: num(s.viewDistance, DEFAULT_SETTINGS.viewDistance),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(s: Settings): void {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ไม่ได้ก็ไม่เป็นไร
  }
}
