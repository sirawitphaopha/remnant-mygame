import * as THREE from 'three';
import { rng } from '../../world/noise';

// ลายเศษใบไม้ร่วงบนพื้นป่า (พี่กันสั่ง 26 ต.ค. 2569) · วาดลง canvas ครั้งเดียว ขอบจางลงให้กลืนกับดิน
// ใบกว้าง: ใบรีหลายขนาด สีน้ำตาล ส้ม เหลืองหม่น บางใบมีเส้นกลางใบ ซ้อนกันหนาตรงกลาง
// ใบเข็ม: เส้นสั้นบาง ๆ สีน้ำตาลแดงไขว้กันเป็นพรม มีกิ่งเล็กกับลูกสนปน
// รูปอ้างอิงกับที่มาอยู่ใน docs/REFERENCES-R2.md หัวข้อ 12

export type LitterKind = 'broad' | 'needle';

const cache = new Map<LitterKind, THREE.Texture>();

export function litterTexture(kind: LitterKind): THREE.Texture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'broad' ? 9101 : 9203);
  // ขอบแผ่นจาง: ยิ่งห่างกลางแผ่นยิ่งมีใบน้อย
  const spot = (): [number, number] => {
    for (;;) {
      const x = r() * S;
      const y = r() * S;
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      if (d < 0.95 && r() > d * d) return [x, y];
    }
  };
  if (kind === 'broad') {
    const cols = ['#6b4a2a', '#7d5730', '#8c6234', '#a0703a', '#b07a32', '#8a7a3a', '#5a3e26', '#9a5a2a', '#6e5a34'];
    for (let k = 0; k < 230; k++) {
      const [x, y] = spot();
      const len = 7 + r() * 13;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI * 2);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.globalAlpha = 0.85 + r() * 0.15;
      g.beginPath();
      g.ellipse(0, 0, len, len * (0.35 + r() * 0.25), 0, 0, Math.PI * 2);
      g.fill();
      // เส้นกลางใบสีเข้ม
      g.strokeStyle = 'rgba(40,28,18,.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-len * 0.9, 0);
      g.lineTo(len * 0.9, 0);
      g.stroke();
      g.restore();
    }
  } else {
    const cols = ['#6a3a22', '#7a4426', '#5a321e', '#8a5230', '#4e2c1a'];
    g.lineCap = 'round';
    for (let k = 0; k < 900; k++) {
      const [x, y] = spot();
      const len = 4 + r() * 7;
      const a = r() * Math.PI * 2;
      g.strokeStyle = cols[Math.floor(r() * cols.length)];
      g.globalAlpha = 0.8 + r() * 0.2;
      g.lineWidth = 1.2 + r() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    // กิ่งเล็กกับลูกสน
    g.globalAlpha = 1;
    for (let k = 0; k < 10; k++) {
      const [x, y] = spot();
      const a = r() * Math.PI * 2;
      g.strokeStyle = '#3e2a1c';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26);
      g.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const [x, y] = spot();
      g.fillStyle = '#5a3a24';
      g.beginPath();
      g.ellipse(x, y, 6, 9, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(kind, tex);
  return tex;
}
