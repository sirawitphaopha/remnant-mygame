import * as THREE from 'three';
import { GEAR, held, type GearSlot, type Loadout } from '../core/gear';
import type { HeroModel } from '../render/models/hero';
import { inkBlob, inkSplat, toolModel } from '../render/models/tools';
import { t } from '../ui/strings';

/** ของที่สแกนได้ตรงหน้า */
export interface ScanTarget {
  /** รหัสชิ้นนี้ (ไม่ซ้ำกันทั้งโลก) */
  key: string;
  /** ชนิดของ เช่น pine, car, teddy */
  kind: string;
  x: number;
  y: number;
  z: number;
}

/** สิ่งที่อุปกรณ์ต้องใช้จากเกม (ต่อเข้ากับร่างกาย สแกน สัตว์ ในช่วงถัดไป) */
export interface ToolsHost {
  scene: THREE.Scene;
  hero: HeroModel;
  loadout: Loadout;
  heightAt(x: number, z: number): number;
  toast(text: string, kind?: '' | 'warn' | 'danger'): void;
  /** หาของที่สแกนได้ในทิศที่มอง */
  findScanTarget(origin: THREE.Vector3, dir: THREE.Vector3): ScanTarget | null;
  onScanned(target: ScanTarget): void;
  /** ปืนกาว: อุดรอยร้าว · คืน true ถ้ามีรอยให้อุด */
  sealCrack(): boolean;
  /** ถังออกซิเจน: เติมโหล · คืน true ถ้ายังไม่เต็ม */
  refillOxygen(): boolean;
  /** หมึกโดนจุดนั้น (สัตว์ในช่วง 9) */
  onInk(x: number, y: number, z: number): void;
  /** แดดส่องถึงตัวไหม (ชาร์จไฟฉาย) */
  sunlit(): boolean;
}

interface Blob { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
interface Splat { mesh: THREE.Mesh; life: number }

const ARM_BUTTON = ['mouse0', 'mouse2', 'KeyQ', 'KeyR'] as const;
const SCAN_TIME = 1.3;

/** การใช้อุปกรณ์ด้วย 4 แขน · คลิกซ้าย คลิกขวา Q R */
export class Tools {
  /** แขนแต่ละข้างถืออะไรอยู่ (โมเดลในมือ) */
  private inHand: (THREE.Object3D | null)[] = [null, null, null, null];
  private inHandKey: string[] = ['', '', '', ''];
  readonly spot: THREE.SpotLight;
  private blobs: Blob[] = [];
  private splats: Splat[] = [];
  private fireCooldown = [0, 0, 0, 0];
  /** ความคืบหน้าการสแกน 0 ถึง 1 */
  scanProgress = 0;
  scanTarget: ScanTarget | null = null;
  scanning = false;
  aiming = false;
  private tmpA = new THREE.Vector3();

  constructor(private host: ToolsHost) {
    this.spot = new THREE.SpotLight(0xfff2d6, 0, 38, Math.PI / 7, 0.45, 1.4);
    this.spot.castShadow = false;
    host.scene.add(this.spot, this.spot.target);
  }

  /** ปุ่มของแขนนั้นถูกกดค้างหรือกดครั้งเดียว (Input ส่งเข้ามา) */
  update(dt: number, down: (b: string) => boolean, pressed: (b: string) => boolean, viewOrigin: THREE.Vector3, viewDir: THREE.Vector3): void {
    const l = this.host.loadout;
    this.syncHands();
    this.scanning = false;
    this.aiming = false;
    for (let arm = 0; arm < 4; arm++) {
      this.fireCooldown[arm] = Math.max(0, this.fireCooldown[arm] - dt);
      const s = held(l, arm);
      if (!s || s.kind !== 'gear') continue;
      const btn = ARM_BUTTON[arm];
      const isDown = down(btn);
      const isPressed = pressed(btn);
      switch (s.id) {
        case 'scanner':
          if (isDown) this.scan(dt, viewOrigin, viewDir);
          break;
        case 'flashlight':
          if (isPressed) {
            if (!s.on && (s.charge ?? 0) <= 0.01) this.host.toast(t('lightEmpty'), 'warn');
            else s.on = !s.on;
          }
          break;
        case 'inkGun':
          if (isDown) {
            this.aiming = true;
            if (this.fireCooldown[arm] <= 0 && (isPressed || this.fireCooldown[arm] <= 0)) this.fireInk(s, arm, viewDir);
          }
          break;
        case 'glueGun':
          if (isPressed) {
            if ((s.amount ?? 0) <= 0) this.host.toast(t('noGlue'), 'warn');
            else if (this.host.sealCrack()) { s.amount = (s.amount ?? 0) - 1; this.host.toast(t('sealed')); }
            else this.host.toast(t('noCracks'));
          }
          break;
        case 'oxygenTank':
          if (isPressed) {
            if ((s.amount ?? 0) <= 0) this.host.toast(t('noTanks'), 'warn');
            else if (this.host.refillOxygen()) { s.amount = (s.amount ?? 0) - 1; this.host.toast(t('oxygenRefilled')); }
            else this.host.toast(t('oxygenFull'));
          }
          break;
        case 'bag':
          if (isPressed) this.host.toast(t('bagHint'));
          break;
        default:
          break;
      }
    }
    if (!this.scanning) { this.scanProgress = 0; this.scanTarget = null; }
    this.updateLight(dt);
    this.updateInk(dt);
  }

  private scan(dt: number, origin: THREE.Vector3, dir: THREE.Vector3): void {
    this.scanning = true;
    this.aiming = true;
    const target = this.host.findScanTarget(origin, dir);
    if (!target) {
      if (this.scanProgress === 0 && !this.scanTarget) this.scanProgress = -1; // ไม่มีอะไร
      return;
    }
    if (!this.scanTarget || this.scanTarget.key !== target.key) {
      this.scanTarget = target;
      this.scanProgress = 0;
    }
    this.scanProgress = Math.min(1, Math.max(0, this.scanProgress) + dt / SCAN_TIME);
    // ปลาหมึกหันมองของที่สแกน
    const oc = this.host.hero.octo;
    oc.lookAt(target.x, target.y, target.z);
    if (this.scanProgress >= 1) {
      this.host.onScanned(target);
      this.scanProgress = 0;
      this.scanTarget = null;
    }
  }

  private fireInk(s: GearSlot, arm: number, dir: THREE.Vector3): void {
    if ((s.amount ?? 0) <= 0) {
      if (this.fireCooldown[arm] <= 0) this.host.toast(t('noInk'), 'warn');
      this.fireCooldown[arm] = 0.6;
      return;
    }
    s.amount = (s.amount ?? 0) - 1;
    this.fireCooldown[arm] = 0.35;
    const mesh = inkBlob();
    const hand = this.host.hero.hands[arm];
    hand.getWorldPosition(mesh.position);
    this.host.scene.add(mesh);
    this.blobs.push({ mesh, vel: dir.clone().multiplyScalar(24).add(new THREE.Vector3(0, 1.5, 0)), life: 4 });
  }

  private updateInk(dt: number): void {
    for (const b of this.blobs) {
      b.vel.y -= 9.81 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      const p = b.mesh.position;
      const gy = this.host.heightAt(p.x, p.z);
      if (p.y <= gy + 0.05 || b.life <= 0) {
        b.life = -1;
        this.host.onInk(p.x, gy, p.z);
        const sp = inkSplat();
        sp.position.set(p.x, gy + 0.04, p.z);
        sp.rotation.y = Math.random() * Math.PI;
        this.host.scene.add(sp);
        this.splats.push({ mesh: sp, life: 25 });
      }
    }
    this.blobs = this.blobs.filter((b) => (b.life > 0 ? true : (this.host.scene.remove(b.mesh), false)));
    for (const s of this.splats) {
      s.life -= dt;
      (s.mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(0.85, s.life / 5);
    }
    this.splats = this.splats.filter((s) => (s.life > 0 ? true : (this.host.scene.remove(s.mesh), false)));
  }

  private updateLight(dt: number): void {
    const l = this.host.loadout;
    let lightArm = -1;
    let light: GearSlot | null = null;
    for (let a = 0; a < 4; a++) {
      const s = held(l, a);
      if (s && s.kind === 'gear' && s.id === 'flashlight') { lightArm = a; light = s; }
    }
    // ไฟฉายที่ไม่ได้ถือในแขนก็ยังชาร์จแดดได้
    for (const s of l.belt) {
      if (!s || s.kind !== 'gear' || s.id !== 'flashlight') continue;
      if (s.on && s !== light) s.on = false;
      if (s.on) {
        s.charge = Math.max(0, (s.charge ?? 0) - dt / GEAR.flashlight.drainSeconds);
        if (s.charge <= 0) { s.on = false; this.host.toast(t('lightEmpty'), 'warn'); }
      }
      if (this.host.sunlit()) s.charge = Math.min(1, (s.charge ?? 0) + dt / GEAR.flashlight.sunChargeSeconds);
    }
    if (light && light.on && lightArm >= 0) {
      const hand = this.host.hero.hands[lightArm];
      hand.getWorldPosition(this.spot.position);
      const fwd = this.tmpA.set(0, -0.15, -1).applyQuaternion(this.host.hero.root.quaternion);
      this.spot.target.position.copy(this.spot.position).addScaledVector(fwd, 10);
      this.spot.intensity = 60 * (0.4 + 0.6 * Math.min(1, (light.charge ?? 0) * 4));
    } else {
      this.spot.intensity = 0;
    }
    this.host.hero.chestLight.visible = true;
  }

  /** ใส่โมเดลอุปกรณ์ในมือตามที่แขนถืออยู่ */
  private syncHands(): void {
    const l = this.host.loadout;
    for (let a = 0; a < 4; a++) {
      const s = held(l, a);
      const key = s ? (s.kind === 'gear' ? s.id : 'item') : '';
      if (key === this.inHandKey[a]) continue;
      this.inHandKey[a] = key;
      if (this.inHand[a]) this.inHand[a]!.removeFromParent();
      this.inHand[a] = null;
      if (s && s.kind === 'gear') {
        const m = toolModel(s.id);
        m.position.set(0, -0.06, -0.04);
        m.rotation.x = Math.PI / 2;
        this.host.hero.hands[a].add(m);
        this.inHand[a] = m;
      }
    }
  }

  /** จำนวนก้อนหมึกที่ลอยอยู่ (ไว้ทดสอบ) */
  get flyingInk(): number {
    return this.blobs.length;
  }
  get splatCount(): number {
    return this.splats.length;
  }
}
