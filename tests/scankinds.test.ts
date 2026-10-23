import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/core/animals';
import { KINDS, KIND_BY_ID } from '../src/core/catalog';
import { NEW_ANIMALS, NEW_FLOWERS, NEW_ROCKS, NEW_SHRUBS, NEW_TREES, WATER_PLANTS } from '../src/core/catalogNature';
import { FLOWER_IDS, RIVER_PLANT_IDS, plantScanKind } from '../src/world/flowers';
import { ROCK_SCAN, ROCK_TYPES } from '../src/world/rocks';
import { SHRUB_IDS } from '../src/world/shrubs';
import { ALL_TREE_KINDS, scanKindOf } from '../src/world/trees';

// ข้อความสแกนของทุกชนิดในโลก (รอบสอง ช่วง 12) · ทุกอย่างที่สแกนได้ต้องมีข้อความสามชั้นสองภาษา
const cat = (id: string) => KIND_BY_ID.get(id)?.category;

describe('ข้อความสแกนครบทุกชนิดในโลก', () => {
  it('ต้นไม้ 19 ชนิดกับต้นตาย มีข้อความของตัวเอง', () => {
    const ids = new Set(ALL_TREE_KINDS.map(scanKindOf));
    expect(ids.size).toBe(20);
    for (const id of ids) expect(cat(id), id).toBe('plant');
  });
  it('ดอกไม้ 13 ชนิด พืชริมน้ำ พุ่มไม้ 6 ชนิด', () => {
    for (const f of [...FLOWER_IDS, ...RIVER_PLANT_IDS]) expect(KIND_BY_ID.has(plantScanKind(f)), f).toBe(true);
    for (const s of SHRUB_IDS) expect(cat(s), s).toBe('plant');
  });
  it('หิน 6 ชนิด ปลา 2 ชนิด สัตว์ 14 ชนิด สัตว์ในถ้ำ', () => {
    for (const r of ROCK_TYPES) expect(cat(ROCK_SCAN[r]), r).toBe('nature');
    for (const id of ['trout', 'carp', 'cavefish', 'bat', ...SPECIES.map((s) => s.id)]) expect(cat(id), id).toBe('animal');
    expect(KIND_BY_ID.has('fish')).toBe(false);
  });
  it('รหัสไม่ซ้ำ ข้อความครบทั้งสองภาษา ฉบับอังกฤษไม่มีอักษรไทย', () => {
    expect(new Set(KINDS.map((k) => k.id)).size).toBe(KINDS.length);
    for (const k of KINDS) {
      const fields: ('name' | 'alienName' | 'guess' | 'truth' | 'log')[] = ['name', 'alienName', 'guess', 'truth'];
      if (k.log) fields.push('log');
      for (const field of fields) {
        const tx = k[field]!;
        expect(tx.th.trim().length, `${k.id}.${field}.th`).toBeGreaterThan(0);
        expect(tx.en.trim().length, `${k.id}.${field}.en`).toBeGreaterThan(0);
        expect(/[฀-๿]/.test(tx.en), `${k.id}.${field}.en`).toBe(false);
        expect(/[฀-๿]/.test(tx.th), `${k.id}.${field}.th`).toBe(true);
      }
    }
  });
  it('ตัวเลขในชั้นความจริงของชนิดใหม่ มีอยู่ในไฟล์อ้างอิง (ไม่แต่งตัวเลขเอง)', () => {
    const refs = readFileSync(new URL('../docs/REFERENCES-R2.md', import.meta.url), 'utf8');
    for (const k of [...NEW_ANIMALS, ...NEW_TREES, ...NEW_FLOWERS, ...WATER_PLANTS, ...NEW_SHRUBS, ...NEW_ROCKS]) {
      for (const n of k.truth.th.match(/\d[\d,]*/g) ?? []) expect(refs.includes(n), `${k.id}: ${n}`).toBe(true);
    }
  });
});
