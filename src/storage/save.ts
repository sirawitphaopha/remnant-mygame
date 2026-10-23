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
  player: { x: number; z: number; heading: number };
  loadout: { belt: Slot[]; arms: (number | null)[] };
  shipChoice: ShipChoice;
  scanLog: string;
  explore: string;
  takenProps: string[];
  corpses: { n: number; x: number; z: number; slots: Slot[] }[];
  droppedBags: { x: number; z: number; bag: NestedBag; beacon: boolean }[];
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

export function writeSave(d: SaveData): boolean {
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** อ่านบันทึก · ข้อมูลเสียหรือรุ่นไม่ตรง คืน null (เริ่มใหม่) */
export function readSave(): SaveData | null {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || d.version !== SAVE_VERSION || typeof d.gameTime !== 'number' || !d.player || !Array.isArray(d.loadout?.belt)) return null;
    return d;
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
