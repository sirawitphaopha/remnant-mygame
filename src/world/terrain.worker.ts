// สร้างภูมิประเทศ 3 × 3 กม. นอกเธรดหลัก หน้าเว็บไม่ค้างระหว่างรอ
// ส่งความคืบหน้า { progress } ระหว่างทาง แล้วส่งตาราง { data } กลับแบบย้ายหน่วยความจำ (ไม่คัดลอก)
import { generateTerrain } from './terrainGen';

const post = (msg: unknown, transfer: Transferable[] = []) => (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(msg, transfer);

self.onmessage = () => {
  const data = generateTerrain((f) => post({ progress: f }));
  post({ data }, [data.heights.buffer, data.biomes.buffer]);
};
