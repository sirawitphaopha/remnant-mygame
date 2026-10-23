// ระดับภาพ ต่ำ กลาง สูง · ค่าเริ่มต้นกลาง

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** รัศมีที่ยังวาดหญ้า (เมตร) */
  grassRadius: number;
  /** ระยะห่างกอหญ้า (กอละ 9 ใบ) ยิ่งน้อยยิ่งแน่น */
  grassSpacing: number;
  /** รัศมีที่วาดพืชเล็ก (เฟิร์น ดอกไม้ เห็ด) */
  plantRadius: number;
  /** ต้นไม้ละเอียดในระยะนี้ ไกลกว่านี้ใช้แบบหยาบ */
  treeNear: number;
  /** ไกลกว่านี้ไม่วาดต้นไม้เลย (หมอกบังอยู่แล้ว) */
  treeFar: number;
  /** ภูมิประเทศละเอียดในระยะนี้ */
  terrainNear: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: { pixelRatio: 1, shadows: false, shadowMapSize: 512, grassRadius: 28, grassSpacing: 1.0, plantRadius: 35, treeNear: 45, treeFar: 300, terrainNear: 160 },
  medium: { pixelRatio: 1, shadows: true, shadowMapSize: 1024, grassRadius: 40, grassSpacing: 0.7, plantRadius: 50, treeNear: 75, treeFar: 420, terrainNear: 260 },
  high: { pixelRatio: 1.5, shadows: true, shadowMapSize: 2048, grassRadius: 55, grassSpacing: 0.5, plantRadius: 80, treeNear: 140, treeFar: 560, terrainNear: 400 },
};

export const DEFAULT_QUALITY: QualityLevel = 'medium';
