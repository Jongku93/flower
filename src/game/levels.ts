/**
 * 보드 마스크와 단계별 난이도.
 *
 * 1단계 13칸(1·3·5·3·1), 2단계 21칸(3·5·5·5·3), 단계가 올라가도 기존 꽃 유지.
 * 아래 목표·2겹 확률·색 해금 시점·3단계 이후 보드는 모두 조정 가능한 기본값.
 */
import type { ColorId } from './types';

export const MASK_13 = ['..O..', '.OOO.', 'OOOOO', '.OOO.', '..O..'];
export const MASK_21 = ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'];
export const MASK_25 = ['OOOOO', 'OOOOO', 'OOOOO', 'OOOOO', 'OOOOO'];

export interface LevelConfig {
  level: number;
  colors: ColorId[];
  /** 대기열에서 2겹 꽃이 나올 확률 (0..1) */
  doubleChance: number;
  /** 이 단계를 넘기려면 터뜨려야 하는 꽃(표면층) 수 */
  goal: number;
  mask: string[];
}

/** 3단계 이후 25칸으로 넓힐지 — 기본은 끔 */
export const EXPAND_TO_25_FROM_LEVEL: number | null = null;

const C3: ColorId[] = ['red', 'yellow', 'pink'];
const C4: ColorId[] = [...C3, 'purple'];
const C5: ColorId[] = [...C4, 'orange'];
const C6: ColorId[] = [...C5, 'blue'];

/** 명시적 표 (1~10단계). 11단계부터는 levelConfig() 가 계산 */
const TABLE: Omit<LevelConfig, 'level' | 'mask'>[] = [
  { colors: C3, doubleChance: 0.08, goal: 21 }, // 1
  { colors: C4, doubleChance: 0.1, goal: 30 }, // 2  (21칸 확장)
  { colors: C4, doubleChance: 0.13, goal: 36 }, // 3
  { colors: C4, doubleChance: 0.16, goal: 42 }, // 4
  { colors: C4, doubleChance: 0.19, goal: 48 }, // 5
  { colors: C5, doubleChance: 0.15, goal: 48 }, // 6  (+주황)
  { colors: C5, doubleChance: 0.18, goal: 54 }, // 7
  { colors: C5, doubleChance: 0.2, goal: 60 }, // 8
  { colors: C5, doubleChance: 0.22, goal: 63 }, // 9
  { colors: C5, doubleChance: 0.25, goal: 66 }, // 10
];

export function maskFor(level: number): string[] {
  if (EXPAND_TO_25_FROM_LEVEL !== null && level >= EXPAND_TO_25_FROM_LEVEL) return MASK_25;
  return level <= 1 ? MASK_13 : MASK_21;
}

export function levelConfig(level: number): LevelConfig {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= TABLE.length) return { level: lv, mask: maskFor(lv), ...TABLE[lv - 1] };
  // 11단계 이상: 6색, 2겹 22%에서 시작해 30%까지 천천히
  const extra = lv - TABLE.length - 1;
  return {
    level: lv,
    colors: C6,
    doubleChance: Math.min(0.3, 0.22 + extra * 0.01),
    goal: Math.min(90, 66 + extra * 3),
    mask: maskFor(lv),
  };
}

export function maskActive(mask: string[], row: number, col: number): boolean {
  return mask[row]?.[col] === 'O';
}

export function maskCount(mask: string[]): number {
  return mask.join('').split('').filter((c) => c === 'O').length;
}
