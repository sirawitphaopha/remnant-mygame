import { WORLD } from '../config/game';
import { BRIDGE, RIVER, ROAD, ROAD_WIDTH, TOWN, distToPolyline } from './layout';
import { rng } from './noise';
import type { Structures } from './structures';
import type { Terrain } from './Terrain';

// เมืองพังในหุบเขา + สะพานพัง · วางด้วยตัวสุ่มที่ตั้งเลขไว้ ผลเดิมทุกครั้ง

export type BuildingStyle = 'solid' | 'ruin' | 'shelter';

export interface Building {
  key: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  y: number;
  style: BuildingStyle;
  /** สีผนัง (ไว้ให้ภาพเลือกโทน) */
  tone: number;
}

export interface BridgePart { x: number; z: number; hx: number; hz: number; rot: number; y0: number; y1: number; kind: 'deck' | 'pillar' | 'rail' }

export interface TownLayout {
  buildings: Building[];
  bridge: BridgePart[];
}

export function buildTown(t: Terrain, s: Structures): TownLayout {
  const r = rng(WORLD.seed + 808);
  const buildings: Building[] = [];
  const tries = 220;
  for (let i = 0; i < tries && buildings.length < 16; i++) {
    const a = r() * Math.PI * 2;
    const dist = 14 + Math.sqrt(r()) * TOWN.radius * 0.62;
    const x = TOWN.x + Math.cos(a) * dist;
    const z = TOWN.z + Math.sin(a) * dist;
    const w = 8 + r() * 8;
    const d = 7 + r() * 7;
    const rad = Math.hypot(w, d) / 2;
    if (distToPolyline(x, z, ROAD) < ROAD_WIDTH + rad + 1.5) continue;
    if (distToPolyline(x, z, RIVER) < 16 + rad) continue;
    if (buildings.some((b) => Math.hypot(b.x - x, b.z - z) < rad + Math.hypot(b.w, b.d) / 2 + 3)) continue;
    // หันตามถนนใกล้สุดคร่าว ๆ ให้ดูเป็นเมือง
    const rot = Math.round((a + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2) + (r() - 0.5) * 0.12;
    const floors = 2 + Math.floor(r() * 5);
    const n = buildings.length;
    const style: BuildingStyle = n % 5 === 1 ? 'shelter' : n % 3 === 2 ? 'ruin' : 'solid';
    const h = style === 'shelter' ? 4.2 : floors * 3.2 * (style === 'ruin' ? 0.6 : 1);
    // ฐานตึกเท่ากับจุดต่ำสุดของพื้นใต้ตึก ตึกไม่ลอย
    let y = Infinity;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) y = Math.min(y, t.heightAt(x + (px * w) / 2, z + (pz * d) / 2));
    buildings.push({ key: `building-${n}`, x, z, w, d, h, rot, y, style, tone: r() });
  }

  for (const b of buildings) {
    if (b.style === 'shelter') {
      // ตึกโล่งข้างในมีประตู หลบหนาวได้ · ผนัง 4 ด้าน (ด้านหน้าเว้นช่องประตู) + หลังคา
      const th = 0.35;
      const hw = b.w / 2;
      const hd = b.d / 2;
      const c = Math.cos(b.rot);
      const sn = Math.sin(b.rot);
      const at = (lx: number, lz: number) => ({ x: b.x + lx * c + lz * sn, z: b.z - lx * sn + lz * c });
      const wall = (lx: number, lz: number, hx: number, hz: number) => {
        const p = at(lx, lz);
        s.add({ x: p.x, z: p.z, hx, hz, rot: b.rot, y0: b.y - 1, y1: b.y + b.h, tag: b.key });
      };
      wall(0, hd - th / 2, hw, th / 2);
      wall(-hw + th / 2, 0, th / 2, hd);
      wall(hw - th / 2, 0, th / 2, hd);
      const door = 1.6;
      wall(-(hw + door) / 2, -hd + th / 2, (hw - door) / 2, th / 2);
      wall((hw + door) / 2, -hd + th / 2, (hw - door) / 2, th / 2);
      s.add({ x: b.x, z: b.z, hx: hw, hz: hd, rot: b.rot, y0: b.y + b.h, y1: b.y + b.h + 0.3, tag: b.key });
    } else {
      s.add({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, rot: b.rot, y0: b.y - 1, y1: b.y + b.h, tag: b.key });
    }
  }

  // สะพานพัง: พื้นสะพานสองท่อน ขาดตรงกลาง มีเสาตอม่อ
  const bridge: BridgePart[] = [];
  const dirX = Math.cos(BRIDGE.angle);
  const dirZ = Math.sin(BRIDGE.angle);
  const rot = -BRIDGE.angle;
  const deckY = Math.max(t.heightAt(BRIDGE.x - dirX * 20, BRIDGE.z - dirZ * 20), t.heightAt(BRIDGE.x + dirX * 20, BRIDGE.z + dirZ * 20), WORLD.waterLevel + 2);
  for (const side of [-1, 1]) {
    const cx = BRIDGE.x + dirX * side * 10.5;
    const cz = BRIDGE.z + dirZ * side * 10.5;
    bridge.push({ x: cx, z: cz, hx: 8, hz: 3.2, rot, y0: deckY - 0.6, y1: deckY, kind: 'deck' });
    s.add({ x: cx, z: cz, hx: 8, hz: 3.2, rot, y0: deckY - 0.6, y1: deckY, tag: 'bridge' });
    for (const rail of [-1, 1]) {
      const rx = cx - dirZ * rail * 3.05;
      const rz = cz + dirX * rail * 3.05;
      bridge.push({ x: rx, z: rz, hx: 8, hz: 0.12, rot, y0: deckY, y1: deckY + 1, kind: 'rail' });
      s.add({ x: rx, z: rz, hx: 8, hz: 0.12, rot, y0: deckY, y1: deckY + 1, tag: 'bridge' });
    }
    const px = BRIDGE.x + dirX * side * 5;
    const pz = BRIDGE.z + dirZ * side * 5;
    const py0 = t.heightAt(px, pz) - 1;
    bridge.push({ x: px, z: pz, hx: 0.8, hz: 2.4, rot, y0: py0, y1: deckY - 0.6, kind: 'pillar' });
    s.add({ x: px, z: pz, hx: 0.8, hz: 2.4, rot, y0: py0, y1: deckY - 0.6, tag: 'bridge' });
  }
  return { buildings, bridge };
}
