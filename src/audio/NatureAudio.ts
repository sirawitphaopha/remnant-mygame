// เสียงธรรมชาติทั้งหมด สังเคราะห์ด้วย Web Audio ไม่มีไฟล์เสียง (ไม่ติดลิขสิทธิ์)
// ลม ใบไม้ นก อีกา จิ้งหรีด กบ นกฮูก น้ำไหล ฝีเท้า น้ำหยดในถ้ำ เสียงก้อง เสียงใต้น้ำ และเสียงอุปกรณ์

export interface AudioEnv {
  /** 0 = กลางวัน 1 = กลางคืน */
  night: number;
  /** ความหนาป่ารอบตัว 0 ถึง 1 */
  forest: number;
  /** ระยะถึงน้ำ (เมตร) */
  waterDist: number;
  /** อยู่ลึกในถ้ำ 0 ถึง 1 */
  cave: number;
  underwater: boolean;
  /** ใกล้เมือง 0 ถึง 1 */
  town: number;
  /** ความสูงจากพื้นหุบเขา ยิ่งสูงลมยิ่งแรง */
  altitude: number;
  /** ลมกระโชกตอนนี้ 0 ถึง 1 */
  gust: number;
}

export type Surface = 'grass' | 'road' | 'rock' | 'water' | 'cave' | 'wood';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class NatureAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private natureBus!: GainNode;
  private gearBus!: GainNode;
  private muffle!: BiquadFilterNode;
  private reverb!: ConvolverNode;
  private reverbGain!: GainNode;
  private noise!: AudioBuffer;
  private beds: Record<'wind' | 'leaves' | 'water' | 'cave', { gain: GainNode; filter: BiquadFilterNode }> = {} as never;
  private timers = { bird: 2, crow: 6, cricket: 0, frog: 3, owl: 8, drip: 1 };
  /** ระดับเสียงที่ตั้ง (หน้าตั้งค่า) */
  natureVolume = 0.8;
  gearVolume = 0.65;
  /** ค่าล่าสุดของแต่ละเสียง (ไว้ทดสอบ) */
  readonly levels: Record<string, number> = {};
  readonly counts: Record<string, number> = { bird: 0, crow: 0, cricket: 0, frog: 0, owl: 0, drip: 0, step: 0 };

  /** เปิดเสียง (ต้องเรียกหลังคนกดปุ่มหรือคลิกครั้งแรก ตามกฎเบราว์เซอร์) */
  start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle).connect(ctx.destination);
    this.natureBus = ctx.createGain();
    this.gearBus = ctx.createGain();
    this.natureBus.connect(this.master);
    this.gearBus.connect(this.master);
    // เสียงก้องในถ้ำ
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0;
    this.reverb.connect(this.reverbGain).connect(this.master);
    // เสียงรบกวนสีชมพูไว้ทำลม น้ำ ใบไม้
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 0.6;
    }
    this.beds.wind = this.bed('bandpass', 420, 0.6);
    this.beds.leaves = this.bed('highpass', 2400, 0.4);
    this.beds.water = this.bed('lowpass', 900, 0.7);
    this.beds.cave = this.bed('lowpass', 160, 1);
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** เสียงพื้นหลังที่ดังตลอด ปรับความดังตามที่อยู่ */
  private bed(type: BiquadFilterType, freq: number, q: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = rand(0.9, 1.1);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.natureBus);
    gain.connect(this.reverb);
    src.start();
    return { gain, filter };
  }

  private set(name: string, g: GainNode, v: number, t = 0.4): void {
    this.levels[name] = v;
    g.gain.setTargetAtTime(v, this.ctx!.currentTime, t);
  }

  /** เรียกทุกเฟรม · ปรับเสียงพื้นหลังและสุ่มเสียงสัตว์ตามที่อยู่กับเวลา */
  update(dt: number, e: AudioEnv): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const day = 1 - e.night;
    const outside = 1 - Math.min(1, e.cave * 3);
    this.natureBus.gain.setTargetAtTime(this.natureVolume, ctx.currentTime, 0.2);
    this.gearBus.gain.setTargetAtTime(this.gearVolume, ctx.currentTime, 0.2);
    // ลม: แรงขึ้นตามความสูงและลมกระโชก · ใบไม้: ในป่าตอนลมพัด
    this.set('wind', this.beds.wind.gain, outside * (0.05 + 0.1 * e.gust + Math.min(0.15, e.altitude / 400)));
    this.beds.wind.filter.frequency.setTargetAtTime(300 + 300 * e.gust, ctx.currentTime, 0.5);
    this.set('leaves', this.beds.leaves.gain, outside * e.forest * (0.02 + 0.07 * e.gust));
    // น้ำไหล: ใกล้แม่น้ำหรือทะเลสาบ
    this.set('water', this.beds.water.gain, outside * 0.22 * Math.max(0, 1 - e.waterDist / 40));
    // ถ้ำ: เสียงต่ำ ๆ กับเสียงก้อง
    this.set('cave', this.beds.cave.gain, e.cave > 0.05 ? 0.12 : 0);
    this.reverbGain.gain.setTargetAtTime(e.cave > 0.05 ? 0.55 : 0.05, ctx.currentTime, 0.5);
    // ใต้น้ำ เสียงอู้อี้
    this.muffle.frequency.setTargetAtTime(e.underwater ? 450 : 20000, ctx.currentTime, 0.15);

    // เสียงสัตว์ที่สุ่มเกิด
    const tm = this.timers;
    for (const k of Object.keys(tm) as (keyof typeof tm)[]) tm[k] -= dt;
    if (tm.bird <= 0) { tm.bird = rand(1.5, 5); if (outside && day > 0.5 && Math.random() < 0.4 + e.forest * 0.5) this.bird(); }
    if (tm.crow <= 0) { tm.crow = rand(5, 12); if (outside && day > 0.5 && e.town > 0.3) this.crow(); }
    if (tm.cricket <= 0) { tm.cricket = rand(0.3, 1.2); if (outside && e.night > 0.6) this.cricket(); }
    if (tm.frog <= 0) { tm.frog = rand(1, 4); if (outside && e.night > 0.5 && e.waterDist < 35) this.frog(); }
    if (tm.owl <= 0) { tm.owl = rand(10, 25); if (outside && e.night > 0.7 && e.forest > 0.3) this.owl(); }
    if (tm.drip <= 0) { tm.drip = rand(0.8, 3); if (e.cave > 0.1) this.drip(); }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0, bus: GainNode = this.natureBus, toReverb = true): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.8, 0.8);
    o.connect(g).connect(pan).connect(bus);
    if (toReverb) pan.connect(this.reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, vol: number, type: BiquadFilterType, freq: number, when = 0, bus: GainNode = this.natureBus): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    g.connect(this.reverb);
    src.start(t, Math.random() * 2, dur + 0.05);
  }

  /** นกร้องเป็นท่อน 2 ถึง 5 โน้ต */
  private bird(): void {
    this.counts.bird++;
    const base = rand(2200, 4200);
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone('sine', base * rand(0.9, 1.3), base * rand(0.7, 1.5), rand(0.06, 0.14), 0.05, i * rand(0.09, 0.16));
  }

  private crow(): void {
    this.counts.crow++;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this.tone('sawtooth', rand(520, 640), rand(380, 460), 0.22, 0.025, i * 0.32);
  }

  private cricket(): void {
    this.counts.cricket++;
    const f = rand(4200, 4900);
    for (let i = 0; i < 4; i++) this.tone('square', f, f, 0.025, 0.008, i * 0.045, this.natureBus, false);
  }

  private frog(): void {
    this.counts.frog++;
    for (let i = 0; i < 3; i++) this.tone('triangle', rand(220, 300), rand(160, 200), 0.09, 0.05, i * 0.12);
  }

  private owl(): void {
    this.counts.owl++;
    this.tone('sine', 410, 380, 0.4, 0.05, 0);
    this.tone('sine', 400, 360, 0.6, 0.05, 0.55);
  }

  private drip(): void {
    this.counts.drip++;
    this.tone('sine', rand(1400, 2200), rand(700, 1000), 0.12, 0.05, 0);
  }

  /** ฝีเท้าหนึ่งก้าว ตามพื้นที่เหยียบ */
  step(surface: Surface, running: boolean): void {
    if (!this.ctx) return;
    this.counts.step++;
    const v = running ? 0.11 : 0.07;
    if (surface === 'water') this.burst(0.25, v * 1.4, 'bandpass', 900);
    else if (surface === 'road' || surface === 'rock' || surface === 'cave') this.burst(0.06, v, 'bandpass', 1800);
    else if (surface === 'wood') this.burst(0.08, v, 'lowpass', 600);
    else this.burst(0.12, v * 0.9, 'highpass', 3000);
  }

  // ===== เสียงอุปกรณ์ =====
  scanTick(): void { if (this.ctx) this.tone('sine', 1600, 1600, 0.05, 0.05, 0, this.gearBus, false); }
  scanDone(): void { if (this.ctx) { this.tone('sine', 1200, 1800, 0.12, 0.06, 0, this.gearBus, false); this.tone('sine', 1800, 2400, 0.14, 0.05, 0.12, this.gearBus, false); } }
  inkShot(): void { if (this.ctx) this.burst(0.15, 0.12, 'lowpass', 500, 0, this.gearBus); }
  glue(): void { if (this.ctx) this.burst(0.35, 0.08, 'bandpass', 1200, 0, this.gearBus); }
  click(): void { if (this.ctx) this.tone('square', 900, 900, 0.03, 0.03, 0, this.gearBus, false); }
  hurt(): void { if (this.ctx) { this.burst(0.3, 0.2, 'highpass', 2500, 0, this.gearBus); this.tone('sawtooth', 300, 120, 0.3, 0.05, 0, this.gearBus, false); } }
}
