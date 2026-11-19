/**
 * 그림 소스 10개 미리 불러오기 + 팝 효과 이미지 색 바꾸기.
 * pop_*.png 는 분홍 꽃잎·황금빛 반짝임으로 그려져 있다. 그대로 쓰면 모든 색이 분홍으로 터지므로,
 * 분홍 계열 픽셀만 골라 터진 꽃 색으로 바꾼다(노란 빛·흰 반짝임·초록 잎은 그대로).
 */
import { ALL_COLORS, type ColorId } from '../game/types';

const BASE = import.meta.env.BASE_URL;
export const flowerUrl = (c: ColorId) => `${BASE}assets/flowers/flower_${c}.png`;
export const POP_NAMES = ['pop_01_bloom', 'pop_02_burst', 'pop_03_scatter', 'pop_04_fade'] as const;
export const popUrl = (i: number) => `${BASE}assets/effects/${POP_NAMES[i]}.png`;

export const ALL_ASSET_URLS = [...ALL_COLORS.map(flowerUrl), ...POP_NAMES.map((_, i) => popUrl(i))];
/** 겹꽃용 '앞 꽃잎' 그림(tools/make-nested.py 가 바깥 꽃 그림에서 떼어 낸 것) */
export const frontUrl = (c: ColorId) => `${BASE}assets/flowers/front/flower_${c}_front.png`;
const FRONT_URLS = ALL_COLORS.map(frontUrl);

/** 꽃잎 파티클용 색 (밝은 쪽 / 기본 / 진한 쪽) — 각 꽃 PNG 에서 눈으로 뽑은 값 */
export const PETAL: Record<ColorId, [string, string, string]> = {
  red: ['#ff6a5c', '#e3201b', '#a3100f'],
  yellow: ['#fff07a', '#ffc81e', '#e59a00'],
  pink: ['#ffc1d6', '#ff7aa6', '#e2477d'],
  orange: ['#ffc58f', '#ff8a3a', '#e05a14'],
  purple: ['#e2c2ff', '#b06cf0', '#7b3ec4'],
  blue: ['#b5e2ff', '#4aa8f0', '#1f6fd0'],
};

/** 색 바꾸기 목표: 색상(도), 채도 배율, 밝기 더하기 */
const TINT: Record<ColorId, { h: number; s: number; l: number } | null> = {
  pink: null,
  red: { h: 358, s: 1.25, l: -0.14 },
  yellow: { h: 46, s: 1.15, l: 0.02 },
  orange: { h: 24, s: 1.2, l: -0.04 },
  purple: { h: 274, s: 0.95, l: -0.04 },
  blue: { h: 207, s: 1.05, l: -0.04 },
};

const images = new Map<string, HTMLImageElement>();

export function getImage(url: string): HTMLImageElement | undefined {
  return images.get(url);
}

/** 그림 소스 10개 + 앞 꽃잎 6개. ok 는 소스 10개 중 불러온 수 */
export function preloadAll(): Promise<{ ok: number; failed: string[]; frontOk: number }> {
  const failed: string[] = [];
  return Promise.all(
    [...ALL_ASSET_URLS, ...FRONT_URLS].map(
      (url) =>
        new Promise<void>((res) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            images.set(url, img);
            res();
          };
          img.onerror = () => {
            failed.push(url);
            res();
          };
          img.src = url;
        }),
    ),
  ).then(() => ({
    ok: ALL_ASSET_URLS.filter((u) => !failed.includes(u)).length,
    failed,
    frontOk: FRONT_URLS.filter((u) => !failed.includes(u)).length,
  }));
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** 분홍 계열인지: 색상 300~360·0~22도, 채도 충분 */
const isPinkish = (h: number, s: number, l: number) => (h >= 300 || h <= 22) && s > 0.28 && l > 0.25 && l < 0.93;

const tinted = new Map<string, HTMLCanvasElement | HTMLImageElement>();

/** 색 바꾼 팝 이미지(캐시). 실패하면 원본을 돌려준다 */
export function tintedPop(i: number, color: ColorId): HTMLCanvasElement | HTMLImageElement | undefined {
  const key = `${i}:${color}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const src = images.get(popUrl(i));
  if (!src) return undefined;
  const t = TINT[color];
  if (!t) {
    tinted.set(key, src);
    return src;
  }
  try {
    const SIZE = 256; // 효과는 크게 늘려도 부드러운 그림이라 256 이면 충분, 계산량 1/4
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(src, 0, 0, SIZE, SIZE);
    const data = g.getImageData(0, 0, SIZE, SIZE);
    const p = data.data;
    for (let k = 0; k < p.length; k += 4) {
      if (p[k + 3] < 8) continue;
      const [h, s, l] = rgb2hsl(p[k], p[k + 1], p[k + 2]);
      if (!isPinkish(h, s, l)) continue;
      const [r, gg, b] = hsl2rgb(t.h, Math.min(1, s * t.s), Math.max(0.05, Math.min(0.95, l + t.l)));
      p[k] = r;
      p[k + 1] = gg;
      p[k + 2] = b;
    }
    g.putImageData(data, 0, 0);
    tinted.set(key, cv);
    return cv;
  } catch {
    tinted.set(key, src);
    return src;
  }
}

/** 처음 터질 때 끊기지 않게 미리 만들어 둔다 */
export function warmTints(colors: readonly ColorId[]) {
  const run = () => {
    for (const c of colors) for (let i = 0; i < 4; i++) tintedPop(i, c);
  };
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 50);
}
