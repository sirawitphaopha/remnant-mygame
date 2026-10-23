import * as THREE from 'three';

/**
 * คืนหน่วยความจำของวัตถุที่เอาออกจากฉากแล้ว (รูปทรง วัสดุ ภาพพื้นผิว)
 * three เก็บบัฟเฟอร์บนการ์ดจอไว้จนกว่าจะเรียก dispose · ไม่เรียก = หน่วยความจำโตตามระยะที่เดิน
 * วัสดุหรือรูปทรงที่ใช้ร่วมกันหลายชิ้น ติด userData.shared = true ไว้ ตัวนี้จะข้าม
 */
export function disposeObject(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) {
      if (mat.userData.shared) continue;
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !v.userData.shared) v.dispose();
      mat.dispose();
    }
  });
}
