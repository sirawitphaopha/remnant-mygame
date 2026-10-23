import * as THREE from 'three';
import { disposeObject } from '../render/dispose';
import { WORLD } from '../config/game';
import { ATTACK_COOLDOWN, ATTACK_RANGE, SPECIES, currentSpeed, decide, inkHit, newMind, type AnimalMind, type Species } from '../core/animals';
import { animalModel, type AnimalModel } from '../render/models/animals';
import { DEEP_FOREST, TOWN } from '../world/layout';
import { forestDensity } from '../world/scatter';
import type { Terrain } from '../world/Terrain';

interface Animal {
  id: number;
  s: Species;
  model: AnimalModel | null;
  mind: AnimalMind;
  x: number;
  y: number;
  z: number;
  hx: number;
  hz: number;
  heading: number;
  speed: number;
  tx: number;
  tz: number;
  retarget: number;
  /** ความสูงบิน (นก) หรือความลึก (ปลา) */
  alt: number;
}

const FIRE_COUNT = 40;

/**
 * สัตว์รอบตัวผู้เล่น · เกิดนอกสายตาในที่อยู่ของมัน หายเมื่อไกลเกิน
 * ส่วนใหญ่ขี้กลัว หมาป่ากับหมีในป่าลึกไล่ทำร้าย · หมึกได้ผลตามชนิด
 */
export class Animals {
  readonly group = new THREE.Group();
  readonly list: Animal[] = [];
  private seq = 0;
  /** ต่อหน้ารหัสสัตว์ ให้ตัวที่เกิดหลังเปิดเกมใหม่ไม่ซ้ำกับตัวที่เคยสแกน */
  private readonly tag = Math.floor(Math.random() * 36 ** 4).toString(36);
  private fireflies: THREE.Points;
  private firePos: Float32Array;
  private fireSeed: Float32Array;
  /** โดนสัตว์ตี (ส่งไปทำโหลร้าว) */
  onAttack: (speciesId: string) => void = () => {};

  constructor(private terrain: Terrain) {
    this.firePos = new Float32Array(FIRE_COUNT * 3);
    this.fireSeed = new Float32Array(FIRE_COUNT);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.firePos, 3));
    this.fireflies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.12, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
  }

  /** ที่อยู่ตรงนั้นเหมาะกับชนิดนี้ไหม */
  private fits(s: Species, x: number, z: number): boolean {
    const h = this.terrain.heightAt(x, z);
    const water = h < WORLD.waterLevel - 0.6;
    const shore = h > WORLD.waterLevel - 0.3 && h < WORLD.waterLevel + 1.2;
    const dens = forestDensity(this.terrain, x, z);
    const deep = Math.hypot(x - DEEP_FOREST.x, z - DEEP_FOREST.z) < DEEP_FOREST.radius * 0.85;
    switch (s.habitat) {
      case 'water': return water;
      case 'shore': return shore;
      case 'deep': return deep && !water;
      case 'forest': return dens > 0.4 && !water && h < 70;
      case 'town': return Math.hypot(x - TOWN.x, z - TOWN.z) < TOWN.radius;
      case 'sky': return true;
      default: return !water && dens < 0.5 && this.terrain.slopeAt(x, z) < 0.25 && h < 60;
    }
  }

  private spawn(s: Species, px: number, pz: number): void {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 45 + Math.random() * 60;
      const x = px + Math.cos(a) * d;
      const z = pz + Math.sin(a) * d;
      if (Math.abs(x) > WORLD.half - 30 || Math.abs(z) > WORLD.half - 30 || !this.fits(s, x, z)) continue;
      const model = animalModel(s.id);
      this.group.add(model.root);
      const alt = s.move === 'fly' ? (s.id === 'eagle' ? 45 + Math.random() * 20 : 8 + Math.random() * 10) : s.move === 'swim' ? -0.6 : s.move === 'flutter' ? 0.6 + Math.random() : 0;
      this.list.push({ id: this.seq++, s, model, mind: newMind(), x, y: this.terrain.heightAt(x, z), z, hx: x, hz: z, heading: Math.random() * 6.28, speed: 0, tx: x, tz: z, retarget: 0, alt });
      return;
    }
  }

  /** สัตว์ที่อยู่ใกล้จุดนี้ (สแกน) */
  scanTargets(): { key: string; kind: string; x: number; y: number; z: number }[] {
    return this.list.filter((a) => a.model).map((a) => ({ key: `animal-${this.tag}-${a.id}`, kind: a.s.id, x: a.x, y: a.y + Math.max(0.15, a.s.height), z: a.z }));
  }

  /** หมึกตกตรงนี้ · สัตว์ในรัศมีโดนหมึก */
  ink(x: number, y: number, z: number): string[] {
    const hit: string[] = [];
    for (const a of this.list) {
      if (Math.hypot(a.x - x, a.z - z) < 2.6 && Math.abs(a.y - y) < 4) {
        inkHit(a.mind, a.s);
        hit.push(a.s.id);
      }
    }
    return hit;
  }

  /** จำนวนสัตว์ต่อชนิด ใช้ซ้ำทุกเฟรม */
  private counts = new Map<(typeof SPECIES)[number], number>();

  update(dt: number, px: number, py: number, pz: number, night: boolean, time: number): void {
    // เกิดใหม่ให้ครบจำนวนตามเวลา
    this.counts.clear();
    for (const a of this.list) this.counts.set(a.s, (this.counts.get(a.s) ?? 0) + 1);
    for (const s of SPECIES) {
      if (s.move === 'glow') continue;
      const active = s.active === 'always' || (s.active === 'night') === night;
      const have = this.counts.get(s) ?? 0;
      if (active && have < s.count && Math.random() < dt * 2) this.spawn(s, px, pz);
    }
    // หายเมื่อไกลเกิน หรือหมดเวลาออกหากิน
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      const active = a.s.active === 'always' || (a.s.active === 'night') === night;
      if (Math.hypot(a.x - px, a.z - pz) > 150 || (!active && Math.hypot(a.x - px, a.z - pz) > 50)) {
        if (a.model) disposeObject(a.model.root);
        this.list.splice(i, 1);
      }
    }

    for (const a of this.list) {
      const s = a.s;
      const dist = Math.hypot(a.x - px, a.z - pz);
      const mode = decide(a.mind, s, dt, dist, Math.hypot(a.x - a.hx, a.z - a.hz));
      let tx = a.tx;
      let tz = a.tz;
      let want = 0;
      if (mode === 'flee') {
        const l = dist || 1;
        tx = a.x + ((a.x - px) / l) * 20;
        tz = a.z + ((a.z - pz) / l) * 20;
        want = s.speed;
      } else if (mode === 'chase') {
        tx = px;
        tz = pz;
        want = s.speed;
        if (dist < ATTACK_RANGE && a.mind.cooldown <= 0 && Math.abs(a.y - py) < 2) {
          a.mind.cooldown = ATTACK_COOLDOWN;
          this.onAttack(s.id);
        }
      } else if (mode === 'return') {
        tx = a.hx;
        tz = a.hz;
        want = s.speed * 0.6;
      } else {
        a.retarget -= dt;
        if (a.retarget <= 0) {
          a.retarget = 3 + Math.random() * 6;
          const r = s.move === 'fly' ? 40 : 14;
          a.tx = a.hx + (Math.random() - 0.5) * r * 2;
          a.tz = a.hz + (Math.random() - 0.5) * r * 2;
        }
        tx = a.tx;
        tz = a.tz;
        want = Math.hypot(tx - a.x, tz - a.z) > 1 ? s.speed * (s.move === 'fly' ? 0.6 : 0.22) : 0;
        if (s.move === 'fly' && s.id === 'eagle') want = s.speed * 0.7;
      }
      want = currentSpeed(a.mind, s, want);
      a.speed += (want - a.speed) * Math.min(1, dt * 3);
      const dx = tx - a.x;
      const dz = tz - a.z;
      const dl = Math.hypot(dx, dz);
      if (dl > 0.05 && a.speed > 0.01) {
        const target = Math.atan2(-dx, -dz);
        let d = target - a.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.heading += d * Math.min(1, dt * 4);
        let nx = a.x - Math.sin(a.heading) * a.speed * dt;
        let nz = a.z - Math.cos(a.heading) * a.speed * dt;
        // สัตว์บกไม่ลงน้ำลึก ปลาไม่ขึ้นบก
        if (s.move === 'swim' ? this.terrain.heightAt(nx, nz) > WORLD.waterLevel - 0.8 : s.move !== 'fly' && s.move !== 'flutter' && this.terrain.heightAt(nx, nz) < WORLD.waterLevel - 0.3) {
          nx = a.x;
          nz = a.z;
          a.retarget = 0;
        }
        a.x = Math.max(-WORLD.half + 5, Math.min(WORLD.half - 5, nx));
        a.z = Math.max(-WORLD.half + 5, Math.min(WORLD.half - 5, nz));
      }
      const ground = this.terrain.heightAt(a.x, a.z);
      if (s.move === 'fly') a.y = Math.max(ground + 3, (s.id === 'eagle' ? 0 : ground) + a.alt + Math.sin(time * 0.6 + a.id) * 1.5);
      else if (s.move === 'swim') a.y = WORLD.waterLevel + a.alt;
      else if (s.move === 'flutter') a.y = ground + a.alt + Math.sin(time * 3 + a.id) * 0.25;
      else if (s.move === 'hop') a.y = ground + Math.max(0, Math.sin(time * 9 + a.id)) * 0.25 * Math.min(1, a.speed);
      else a.y = ground;
      if (a.model) {
        a.model.root.position.set(a.x, a.y, a.z);
        a.model.root.rotation.y = a.heading;
        // โดนหมึกตัวเปื้อนดำ (ย่อตัวนิด ๆ ให้รู้ว่าเหนียว)
        a.model.root.scale.setScalar(a.mind.sticky > 0 ? 0.97 : 1);
        a.model.animate(dt, a.speed, time);
      }
    }

    // หิ่งห้อย: กลางคืน ลอยต่ำ ๆ รอบตัวในทุ่งกับริมน้ำ
    this.fireflies.visible = night;
    if (night) {
      for (let i = 0; i < FIRE_COUNT; i++) {
        if (this.fireSeed[i] === 0 || Math.hypot(this.firePos[i * 3] - px, this.firePos[i * 3 + 2] - pz) > 40) {
          const a = Math.random() * 6.28;
          const d = 5 + Math.random() * 30;
          this.firePos[i * 3] = px + Math.cos(a) * d;
          this.firePos[i * 3 + 2] = pz + Math.sin(a) * d;
          this.fireSeed[i] = 1 + Math.random() * 100;
        }
        const sd = this.fireSeed[i];
        this.firePos[i * 3] += Math.sin(time * 0.5 + sd) * dt * 0.4;
        this.firePos[i * 3 + 2] += Math.cos(time * 0.4 + sd) * dt * 0.4;
        this.firePos[i * 3 + 1] = this.terrain.heightAt(this.firePos[i * 3], this.firePos[i * 3 + 2]) + 0.6 + Math.sin(time + sd) * 0.4;
      }
      (this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.fireflies.material as THREE.PointsMaterial).opacity = 0.5 + 0.4 * Math.sin(time * 2.3);
    }
  }

  /** หิ่งห้อยที่ใกล้สุด (สแกน) */
  nearestFirefly(px: number, pz: number): { i: number; x: number; y: number; z: number } | null {
    if (!this.fireflies.visible) return null;
    let best = -1;
    let bd = 12;
    for (let i = 0; i < FIRE_COUNT; i++) {
      const d = Math.hypot(this.firePos[i * 3] - px, this.firePos[i * 3 + 2] - pz);
      if (d < bd) { bd = d; best = i; }
    }
    return best < 0 ? null : { i: best, x: this.firePos[best * 3], y: this.firePos[best * 3 + 1], z: this.firePos[best * 3 + 2] };
  }

  /** ตัวช่วยทดสอบ: วางสัตว์ชนิดนั้นตรงจุดนั้น */
  place(id: string, x: number, z: number): number {
    const s = SPECIES.find((v) => v.id === id)!;
    const model = animalModel(id);
    this.group.add(model.root);
    const a: Animal = { id: this.seq++, s, model, mind: newMind(), x, y: this.terrain.heightAt(x, z), z, hx: x, hz: z, heading: 0, speed: 0, tx: x, tz: z, retarget: 5, alt: s.move === 'fly' ? 6 : 0 };
    this.list.push(a);
    return a.id;
  }

  get(id: number): Animal | undefined {
    return this.list.find((a) => a.id === id);
  }
}
