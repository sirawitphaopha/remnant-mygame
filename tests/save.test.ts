import { beforeEach, describe, expect, it } from 'vitest';
import { starterChoice, starterPack } from '../src/core/gear';
import { DEFAULT_SETTINGS, SAVE_KEY, SAVE_VERSION, clearSave, readSave, readSettings, writeSave, writeSettings, type SaveData } from '../src/storage/save';
import { allKeys, tableFor } from '../src/ui/strings';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const sample = (): SaveData => ({
  version: SAVE_VERSION, savedAt: 1, gameTime: 5000, bodyNumber: 3, player: { x: 1, z: 2, heading: 0.5 },
  loadout: starterPack(), shipChoice: starterChoice(), scanLog: '[]', explore: '', takenProps: ['item-1'], corpses: [], droppedBags: [], body: { oxygen: 1, cracks: 1, warmth: 1 },
});

describe('บันทึกความคืบหน้า', () => {
  beforeEach(() => { (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage(); });
  it('บันทึกแล้วอ่านกลับได้เหมือนเดิม', () => {
    writeSave(sample());
    expect(readSave()).toEqual(sample());
  });
  it('ข้อมูลเสียหรือรุ่นไม่ตรง เริ่มใหม่ ไม่พัง', () => {
    localStorage.setItem(SAVE_KEY, '{oops');
    expect(readSave()).toBeNull();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...sample(), version: 99 }));
    expect(readSave()).toBeNull();
    clearSave();
    expect(readSave()).toBeNull();
  });
  it('ตั้งค่า: ค่าแปลกถูกแทนด้วยค่าเริ่มต้น', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    writeSettings({ ...DEFAULT_SETTINGS, lang: 'en', quality: 'low' });
    expect(readSettings()).toMatchObject({ lang: 'en', quality: 'low' });
    localStorage.setItem('remnant.settings.v1', JSON.stringify({ quality: 'ultra', nature: 7 }));
    expect(readSettings()).toMatchObject({ quality: 'medium', nature: DEFAULT_SETTINGS.nature });
  });
});

describe('สองภาษา', () => {
  it('ทุกคำบนจอมีครบทั้งไทยและอังกฤษ', () => {
    const th = tableFor('th');
    const en = tableFor('en');
    for (const k of allKeys()) {
      expect(th[k], k).toBeTruthy();
      // คำหน่วยบางคำภาษาอังกฤษไม่ต้องมี (เช่น 'ชิ้น' 'อย่าง') จึงยอมให้ว่างได้เฉพาะคำนั้น
      if (k === 'pieces' || k === 'things') expect(typeof en[k]).toBe('string');
      else expect(en[k], k).toBeTruthy();
    }
  });
  it('ฉบับอังกฤษไม่มีอักษรไทยปน (ยกเว้นชื่อภาษาในตัวเลือกภาษา)', () => {
    const en = tableFor('en');
    for (const k of allKeys()) if (k !== 'langThai') expect(/[฀-๿]/.test(en[k]), `${k}: ${en[k]}`).toBe(false);
  });
});
