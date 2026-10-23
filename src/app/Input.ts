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
  /** กำลังเล่นอยู่ (ไม่มีหน้าเมนู) Tab ใช้เปิดกระเป๋า · นอกนั้นปล่อยให้ Tab เลื่อนปุ่มตามปกติของเบราว์เซอร์ */
  captureTab = false;
  /** ขอล็อกเมาส์ไม่สำเร็จ (เบราว์เซอร์ไม่ยอม) ให้หน้าจอขึ้นป้ายบอกให้คลิก */
  lockFailed = false;
  private now = 0;
  private wheelAcc = 0;
  private wheelAt = -1;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' && this.captureTab) e.preventDefault();
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
    // ทัชแพดส่งเหตุการณ์ล้อถี่มาก สะสมจนถึงหนึ่งขั้นแล้วพักสั้น ๆ (ปัดทีเดียวไม่ข้ามหลายช่อง)
    window.addEventListener('wheel', (e) => {
      this.wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(this.wheelAcc) < 60 || this.now - this.wheelAt < 0.12) return;
      this.wheel += Math.sign(this.wheelAcc);
      this.wheelAcc = 0;
      this.wheelAt = this.now;
    }, { passive: true });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    document.addEventListener('pointerlockchange', () => { if (this.locked) this.lockFailed = false; });
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
