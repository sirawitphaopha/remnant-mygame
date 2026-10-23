import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ชั้นล่างห้าม import ชั้นบน · config ← core ← storage ← world ← {render, player, ui, audio} ← app
const LAYER: Record<string, number> = { config: 0, core: 1, storage: 2, world: 3, render: 4, player: 4, ui: 4, audio: 4, app: 5 };
const NO_THREE = ['config', 'core', 'storage', 'ui', 'audio'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('กฎแบ่งชั้นโค้ด', () => {
  for (const file of files('src')) {
    const layer = file.split(sep)[1];
    if (!(layer in LAYER)) continue;
    const src = readFileSync(file, 'utf8');
    it(`${file} ไม่ import ชั้นที่สูงกว่า`, () => {
      for (const m of src.matchAll(/from '\.\.\/([a-z]+)\//g)) {
        const to = m[1];
        if (to in LAYER) expect(LAYER[to], `${file} → ${to}`).toBeLessThanOrEqual(LAYER[layer]);
      }
      if (NO_THREE.includes(layer)) expect(src.includes("from 'three'"), `${file} ใช้ three ไม่ได้`).toBe(false);
    });
  }
});
