/**
 * 팝 연출 캔버스. 화면 전체를 덮는 투명 캔버스(입력은 통과)에 그린다.
 * 판정은 엔진이 이미 끝냈고, 여기서는 '보여 주기'만 한다.
 *
 * 한 무리의 기본 타임라인(ms, speed=1):
 *   120~300  맞은 꽃들이 무리 중심으로 모이며 작아짐(유령 꽃)
 *   120~330  중심에서 같은 색 큰 꽃이 급격히 피어남 (+ 색 바꾼 pop_01 빛)
 *   330~650  같은 색 꽃잎 12~24장 흩날림, 흰 반짝임, pop_02 → pop_03 크로스페이드
 *   600~850  pop_04 잔광, 꽃잎 사라짐
 */
import { FX_TIMING } from '../game/config';
import type { ColorId } from '../game/types';
import { flowerUrl, getImage, PETAL, tintedPop } from './assets';

interface Pt {
  x: number;
  y: number;
}

interface Bloom {
  t0: number;
  scale: number; // 시간 배율(작을수록 빠름)
  color: ColorId;
  center: Pt;
  cell: number; // 칸 크기(px)
  ghosts: Pt[];
  big: number; // 큰 꽃 최종 크기(칸 배수)
  reduced: boolean;
  spawned: boolean;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  max: number;
  tone: [string, string, string];
  flip: number;
}

interface Spark {
  x: number;
  y: number;
  size: number;
  life: number;
  max: number;
  delay: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** a~b 구간 진행도 */
const seg = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));

export class PopFx {
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private blooms: Bloom[] = [];
  private petals: Petal[] = [];
  private sparks: Spark[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  /** 시험용: 지금까지 만든 꽃잎 색 기록 */
  public petalLog: string[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.cv = canvas;
    this.g = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.cv.style.width = this.w + 'px';
    this.cv.style.height = this.h + 'px';
  }

  get busy() {
    return this.blooms.length + this.petals.length + this.sparks.length > 0;
  }

  /** 한 무리 터짐 시작. t0 는 '연출 0ms' 기준 시각(맞은 꽃 반응 시작) */
  addBloom(opts: { color: ColorId; cells: Pt[]; cell: number; scale: number; reduced: boolean; t0: number }) {
    const n = opts.cells.length;
    const cx = opts.cells.reduce((a, p) => a + p.x, 0) / n;
    const cy = opts.cells.reduce((a, p) => a + p.y, 0) / n;
    this.blooms.push({
      t0: opts.t0,
      scale: opts.scale,
      color: opts.color,
      center: { x: cx, y: cy },
      cell: opts.cell,
      ghosts: opts.cells,
      big: Math.min(4.2, 2.9 + (n - 3) * 0.3),
      reduced: opts.reduced,
      spawned: false,
    });
    this.start();
  }

  clear() {
    this.blooms = [];
    this.petals = [];
    this.sparks = [];
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - this.last);
      this.last = now;
      this.step(now, dt);
      if (this.busy) this.raf = requestAnimationFrame(loop);
      else {
        this.raf = 0;
        this.g.setTransform(1, 0, 0, 1, 0, 0);
        this.g.clearRect(0, 0, this.cv.width, this.cv.height);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private spawnPetals(b: Bloom) {
    const tone = PETAL[b.color];
    const n = b.reduced ? 6 : Math.min(24, 12 + b.ghosts.length * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = b.cell * (2.6 + Math.random() * 3.2); // px/초
      this.petals.push({
        x: b.center.x + Math.cos(a) * b.cell * 0.4,
        y: b.center.y + Math.sin(a) * b.cell * 0.4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - b.cell * 1.2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 9,
        size: b.cell * (0.16 + Math.random() * 0.14),
        life: 0,
        max: (520 + Math.random() * 180) * b.scale,
        tone,
        flip: Math.random() * Math.PI * 2,
      });
      this.petalLog.push(b.color);
    }
    if (this.petalLog.length > 200) this.petalLog.splice(0, this.petalLog.length - 200);
    const ns = b.reduced ? 3 : 9;
    for (let i = 0; i < ns; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = b.cell * (0.4 + Math.random() * 1.5);
      this.sparks.push({
        x: b.center.x + Math.cos(a) * r,
        y: b.center.y + Math.sin(a) * r,
        size: b.cell * (0.1 + Math.random() * 0.14),
        life: 0,
        max: (300 + Math.random() * 250) * b.scale,
        delay: Math.random() * 180 * b.scale,
      });
    }
  }

  private step(now: number, dt: number) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);

    // 1) 큰 꽃 · 빛 · 유령 꽃
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      const b = this.blooms[i];
      const u = (now - b.t0) / b.scale; // 기준 타임라인 ms
      if (u < 0) continue;
      if (u >= FX_TIMING.fadeEnd + 40) {
        this.blooms.splice(i, 1);
        continue;
      }
      if (!b.spawned && u >= FX_TIMING.bloomEnd) {
        b.spawned = true;
        this.spawnPetals(b);
      }
      this.drawBloom(b, u);
    }

    // 2) 꽃잎
    const s = dt / 1000;
    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.petals.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(0.12, s);
      p.vy = p.vy * Math.pow(0.12, s) + 520 * s * 0.35;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.rot += p.vr * s;
      p.flip += s * 7;
      const k = p.life / p.max;
      const alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      this.drawPetal(p, alpha);
    }

    // 3) 흰 반짝임
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life += dt;
      const t = sp.life - sp.delay;
      if (t >= sp.max) {
        this.sparks.splice(i, 1);
        continue;
      }
      if (t < 0) continue;
      const k = t / sp.max;
      this.drawSpark(sp.x, sp.y, sp.size * Math.sin(Math.PI * k), Math.sin(Math.PI * k));
    }
  }

  private drawImg(img: CanvasImageSource | undefined, x: number, y: number, size: number, alpha: number, rot = 0) {
    if (!img || alpha <= 0.01 || size <= 0) return;
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.drawImage(img, -size / 2, -size / 2, size, size);
    g.restore();
  }

  private drawBloom(b: Bloom, u: number) {
    const g = this.g;
    const { x, y } = b.center;
    const C = b.cell;
    const flower = getImage(flowerUrl(b.color));

    // 유령 꽃: 맞은 꽃들이 가운데로 빨려 들어감 (120~300)
    if (u >= FX_TIMING.react && u < 300) {
      const k = easeOutCubic(seg(u, FX_TIMING.react, 300));
      for (const p of b.ghosts) {
        this.drawImg(flower, lerp(p.x, x, k), lerp(p.y, y, k), C * lerp(0.95, 0.45, k), 1 - k * 0.9);
      }
    }

    if (!b.reduced) {
      // 빛 원판 (색 바꾼 pop_01) 120~650
      const a1 = seg(u, FX_TIMING.react, 260) * (1 - seg(u, 420, FX_TIMING.scatterEnd));
      this.drawImg(tintedPop(0, b.color), x, y, C * b.big * 1.35 * lerp(0.6, 1.1, seg(u, 120, 650)), a1 * 0.85);
      // 터짐 (pop_02) 300~560
      const a2 = seg(u, 300, 380) * (1 - seg(u, 480, 600));
      this.drawImg(tintedPop(1, b.color), x, y, C * b.big * 1.5 * lerp(0.8, 1.25, seg(u, 300, 600)), a2);
      // 흩날림 (pop_03) 450~760, 천천히 돈다
      const a3 = seg(u, 450, 540) * (1 - seg(u, 640, 780));
      this.drawImg(tintedPop(2, b.color), x, y, C * b.big * 1.6 * lerp(0.95, 1.3, seg(u, 450, 780)), a3, seg(u, 450, 780) * 0.5);
      // 잔광 (pop_04) 600~850
      const a4 = seg(u, 600, 680) * (1 - seg(u, 720, FX_TIMING.fadeEnd));
      this.drawImg(tintedPop(3, b.color), x, y, C * b.big * 1.7, a4);
    }

    // 큰 꽃: 120~330 급격히 피어남(살짝 넘쳤다 돌아옴), 330~650 조금 더 커지며 사라짐
    if (u >= FX_TIMING.react && u < FX_TIMING.scatterEnd) {
      const grow = easeOutBack(seg(u, FX_TIMING.react, FX_TIMING.bloomEnd));
      const after = seg(u, FX_TIMING.bloomEnd, FX_TIMING.scatterEnd);
      const size = C * b.big * (0.35 + 0.65 * grow) * (1 + 0.12 * after);
      const alpha = 1 - easeOutCubic(seg(u, 430, FX_TIMING.scatterEnd));
      // 하얀 후광
      g.save();
      g.globalAlpha = alpha * 0.7;
      const rg = g.createRadialGradient(x, y, 0, x, y, size * 0.75);
      rg.addColorStop(0, 'rgba(255,255,240,0.95)');
      rg.addColorStop(0.5, 'rgba(255,250,220,0.35)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, y, size * 0.75, 0, Math.PI * 2);
      g.fill();
      g.restore();
      this.drawImg(flower, x, y, size, alpha, Math.sin(u / 140) * 0.05);
    }

    // 퍼지는 흰 고리 (330 순간)
    const ring = seg(u, FX_TIMING.bloomEnd - 20, 560);
    if (ring > 0 && ring < 1) {
      g.save();
      g.globalAlpha = (1 - ring) * 0.8;
      g.strokeStyle = '#fffbea';
      g.lineWidth = C * 0.12 * (1 - ring) + 1;
      g.beginPath();
      g.arc(x, y, C * lerp(0.5, b.big * 0.95, easeOutCubic(ring)), 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  private drawPetal(p: Petal, alpha: number) {
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.flip))); // 팔랑팔랑
    const L = p.size;
    const grad = g.createLinearGradient(0, -L, 0, L);
    grad.addColorStop(0, p.tone[0]);
    grad.addColorStop(0.55, p.tone[1]);
    grad.addColorStop(1, p.tone[2]);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, L);
    g.bezierCurveTo(L * 0.95, L * 0.35, L * 0.7, -L * 0.8, 0, -L);
    g.bezierCurveTo(-L * 0.7, -L * 0.8, -L * 0.95, L * 0.35, 0, L);
    g.fill();
    g.globalAlpha = alpha * 0.45;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = Math.max(1, L * 0.08);
    g.beginPath();
    g.moveTo(0, L * 0.7);
    g.quadraticCurveTo(L * 0.12, 0, 0, -L * 0.7);
    g.stroke();
    g.restore();
  }

  private drawSpark(x: number, y: number, r: number, alpha: number) {
    if (r <= 0.3) return;
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(255,255,230,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      g.lineTo(Math.cos(a + Math.PI / 4) * r * 0.22, Math.sin(a + Math.PI / 4) * r * 0.22);
    }
    g.closePath();
    g.fill();
    g.restore();
  }
}
