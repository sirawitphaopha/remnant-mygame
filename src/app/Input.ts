/** รับปุ่มคีย์บอร์ดกับเมาส์ · ล็อกเมาส์ไว้กลางจอตอนเล่น */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private mouseDown = new Set<number>();
  private mousePressed = new Set<number>();
  /** เมาส์ขยับไปเท่าไรตั้งแต่เฟรมก่อน */
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  /** เวลาล่าสุดที่เมาส์ขยับ (วินาทีของนาฬิกาเกม) ใช้ให้กล้องหมุนกลับข้างหลังเอง */
  lastMouseMove = 0;
  private now = 0;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouseDown.clear(); });
    target.addEventListener('mousedown', (e) => {
      if (!this.locked) { this.lock(); return; }
      this.mouseDown.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.mouseDown.delete(e.button));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) this.lastMouseMove = this.now;
    });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  get locked(): boolean { return document.pointerLockElement === this.target; }

  lock(): void {
    const r = this.target.requestPointerLock?.();
    if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
  }

  unlock(): void { if (this.locked) document.exitPointerLock(); }

  isDown(code: string): boolean { return this.down.has(code); }
  wasPressed(code: string): boolean { return this.pressed.has(code); }
  isMouseDown(button: number): boolean { return this.mouseDown.has(button); }
  wasMousePressed(button: number): boolean { return this.mousePressed.has(button); }

  /** เรียกทุกต้นเฟรมก่อนอ่านค่า */
  setTime(t: number): void { this.now = t; }

  /** เรียกทุกท้ายเฟรม ล้างค่าที่นับเฉพาะเฟรมนั้น */
  endFrame(): void {
    this.pressed.clear();
    this.mousePressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  /** ใช้ตอนทดสอบเท่านั้น จำลองการกดปุ่มเมาส์ (0 ซ้าย 2 ขวา) */
  simulateMouse(button: number, isDown: boolean): void {
    if (isDown) { if (!this.mouseDown.has(button)) this.mousePressed.add(button); this.mouseDown.add(button); }
    else this.mouseDown.delete(button);
  }

  /** ปุ่มแบบรวม: 'mouse0' 'mouse2' หรือรหัสปุ่มคีย์บอร์ด */
  held(b: string): boolean {
    return b.startsWith('mouse') ? this.isMouseDown(Number(b.slice(5))) : this.isDown(b);
  }

  pressedAny(b: string): boolean {
    return b.startsWith('mouse') ? this.wasMousePressed(Number(b.slice(5))) : this.wasPressed(b);
  }

  /** ใช้ตอนทดสอบเท่านั้น จำลองการกดปุ่ม */
  simulate(code: string, isDown: boolean): void {
    if (isDown) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); }
    else this.down.delete(code);
  }
}
