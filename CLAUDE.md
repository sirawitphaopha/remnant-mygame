# CLAUDE.md — คู่มือโค้ด ร่องรอย (Remnant)

อ่านก่อนแก้ทุกครั้ง · ข้อกำหนดเกมทั้งหมดอยู่ใน `docs/DESIGN.md` · แผนงานอยู่ใน `docs/PLAN.md` · สถานะแต่ละช่วงอยู่ใน `docs/ROADMAP.md`

## ภาพรวม
- เกมสามมิติบนเว็บ เล่นบนคอมเท่านั้น · TypeScript strict + three.js + Vite · ไม่มีหลังบ้าน
- โมเดลทุกชิ้นปั้นด้วยโค้ด ไม่มีไฟล์โมเดลหรือภาพจากข้างนอก · เสียงสังเคราะห์ด้วย Web Audio
- ฟอนต์ฝังมากับเว็บผ่าน @fontsource (Chakra Petch หัวข้อ · Sarabun เนื้อความ · Roboto Mono ตัวเลข)
- เวอร์ชันอยู่ที่ `package.json` ที่เดียว

## คำสั่ง
| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | เซิร์ฟเวอร์ทดสอบพอร์ต 3700 (ปกติเปิดค้างจาก `C:\Users\PKH\dev-servers\remnant-3700.cmd`) |
| `npm run typecheck` | ตรวจชนิดข้อมูล |
| `npm test` | เทสกติกาเกมกับกฎแบ่งชั้น |
| `npm run build` | build ลง `dist/` |

**ก่อน commit ทุกครั้ง:** `npm run typecheck && npm test && npm run build`

## แบ่งชั้นโค้ด (ชั้นล่างห้าม import ชั้นบน · `tests/rules.test.ts` บังคับ)
```
config ← core ← storage ← world ← {render, player, ui, audio} ← app
```
| โฟลเดอร์ | หน้าที่ |
|---|---|
| `config/` | ค่าสมดุลทั้งหมด |
| `core/` | กติกาล้วน ห้ามแตะ three หรือ DOM |
| `storage/` | บันทึกในเบราว์เซอร์ |
| `world/` | รูปร่างโลก ความสูงพื้น น้ำ จุดวางของ (seed คงที่ แมพเดิมทุกครั้ง) |
| `render/` | ภาพสามมิติ · `render/models/` โมเดลที่ปั้นด้วยโค้ด |
| `player/` | การเคลื่อนที่ของตัวละคร |
| `ui/` | หน้าจอ DOM · ข้อความทุกคำอยู่ใน `ui/strings.ts` (ไทยและอังกฤษ) |
| `audio/` | เสียง |
| `app/` | ผูกทุกส่วน ลูปหลัก ปุ่มบังคับ |

## วิธีทดสอบในโครม
หน้าต่างโครมที่ถูกบังวาดภาพช้ามาก (วัดได้ 2 ภาพต่อวินาที) จึงทดสอบด้วยตัวช่วยตอน dev
```js
const a = __remnant;            // มีเฉพาะตอน npm run dev
a.paused = true;                // หยุดลูปจริง
a.input.simulate('KeyW', true); // กดปุ่มค้าง
a.advance(2);                   // เดินเวลาเกม 2 วินาที ทีละ 1/60 แล้ววาดภาพ
a.input.simulate('KeyW', false);
```
ปุ่มที่กดจริงด้วยคีย์บอร์ดก็เข้า `Input` เหมือนกัน แล้วใช้ `advance()` เดินเวลาต่อ
