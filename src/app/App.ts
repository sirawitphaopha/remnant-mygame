import * as THREE from 'three';
import { SPAWN } from '../config/game';
import { flatGround, type Ground } from '../world/Ground';
import { Player } from '../player/Player';
import { CameraRig } from '../render/CameraRig';
import { Input } from './Input';

/** ผูกทุกส่วนของเกมเข้าด้วยกัน และวนลูปทุกเฟรม */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
  readonly input: Input;
  readonly ground: Ground = flatGround;
  readonly player: Player;
  readonly rig: CameraRig;
  private hero: THREE.Object3D;
  private clock = new THREE.Clock();
  private elapsed = 0;
  fps = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(private host: HTMLElement, readonly uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x9cc4dc);
    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
    sun.position.set(80, 120, 40);
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000, 100, 100).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x5b7a45, wireframe: false }),
    );
    this.scene.add(floor);
    const grid = new THREE.GridHelper(1000, 200, 0x3e5530, 0x4a6638);
    grid.position.y = 0.01;
    this.scene.add(grid);

    this.hero = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 6, 12).translate(0, 0.9, 0),
      new THREE.MeshStandardMaterial({ color: 0xd6d8d2 }),
    );
    this.scene.add(this.hero);

    this.player = new Player(this.ground);
    this.player.place(SPAWN.x, SPAWN.z, SPAWN.heading);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(this.player);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    if (import.meta.env.DEV) (window as unknown as { __remnant: App }).__remnant = this;
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.measureFps(dt);
    if (this.paused) { this.render(); return; }
    this.update(dt);
    this.render();
  }

  /** หยุดลูปจริงไว้ ใช้ตอนทดสอบด้วย advance() */
  paused = false;

  /**
   * ตัวช่วยทดสอบ: เดินเวลาเกมไปตามจำนวนวินาที ทีละ 1/60 วินาที แล้ววาดภาพหนึ่งครั้ง
   * ใช้ตอนหน้าต่างโครมวาดภาพช้า (ถูกบัง) ผลจะเหมือนเล่นจริงทุกเฟรม
   */
  advance(seconds: number): void {
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) this.update(step);
    this.render();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.input.setTime(this.elapsed);

    const inp = this.input;
    this.rig.rotate(inp.mouseDX, inp.mouseDY);
    const f = this.rig.forward();
    const r = { x: -f.z, z: f.x };
    let mx = 0;
    let mz = 0;
    if (inp.isDown('KeyW')) { mx += f.x; mz += f.z; }
    if (inp.isDown('KeyS')) { mx -= f.x; mz -= f.z; }
    if (inp.isDown('KeyD')) { mx += r.x; mz += r.z; }
    if (inp.isDown('KeyA')) { mx -= r.x; mz -= r.z; }
    this.player.update(dt, {
      x: mx,
      z: mz,
      run: inp.isDown('ShiftLeft') || inp.isDown('ShiftRight'),
      jump: inp.wasPressed('Space'),
    });

    const p = this.player;
    this.hero.position.set(p.x, p.y, p.z);
    this.hero.rotation.y = p.heading;
    this.rig.update(dt, p);
    inp.endFrame();
  }

  private measureFps(dt: number): void {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }
}
