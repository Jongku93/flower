/**
 * 자동 저장 · 복원. localStorage 에 본 저장 + 직전 정상 저장(백업)을 둔다.
 * 복원 시 형식을 엄격히 검사한다: 3겹 이상, 모르는 색, 마스크보다 작은 보드 등은 거부.
 */
import { levelConfig, maskActive } from './levels';
import { ALL_COLORS, CELL_COUNT, GRID, MAX_LAYERS, type Cell, type CoreState, type GameState } from './types';

export const SAVE_KEY = 'flowerGarden.save.v1';
export const BACKUP_KEY = 'flowerGarden.save.v1.bak';
export const BEST_KEY = 'flowerGarden.best.v1';
export const SETTINGS_KEY = 'flowerGarden.settings.v1';

const isColor = (v: unknown) => typeof v === 'string' && (ALL_COLORS as readonly string[]).includes(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min = 0) => isNum(v) && Number.isInteger(v) && (v as number) >= min;

function validBoard(board: unknown, level: number): board is Cell[] {
  if (!Array.isArray(board) || board.length !== CELL_COUNT) return false;
  const mask = levelConfig(level).mask;
  for (let i = 0; i < CELL_COUNT; i++) {
    const c = board[i] as Cell;
    if (!c || typeof c !== 'object') return false;
    if (c.row !== Math.floor(i / GRID) || c.col !== i % GRID) return false;
    if (typeof c.active !== 'boolean') return false;
    if (c.active !== maskActive(mask, c.row, c.col)) return false;
    if (!Array.isArray(c.layers) || c.layers.length > MAX_LAYERS) return false;
    if (!c.layers.every(isColor)) return false;
    if (!c.active && c.layers.length) return false;
  }
  return true;
}

function validQueue(q: unknown): boolean {
  return Array.isArray(q) && q.length >= 1 && q.every((p) => Array.isArray(p) && p.length >= 1 && p.length <= MAX_LAYERS && p.every(isColor));
}

export function validCore(s: unknown): s is CoreState {
  const o = s as CoreState;
  if (!o || typeof o !== 'object') return false;
  if (!isInt(o.level, 1) || !isNum(o.score) || o.score < 0) return false;
  if (!isInt(o.levelPopped) || !isInt(o.totalPopped) || !isInt(o.turn) || !isInt(o.bestChain)) return false;
  if (!isInt(o.rng) || o.rng > 0xffffffff) return false;
  if (typeof o.over !== 'boolean') return false;
  return validBoard(o.board, o.level) && validQueue(o.queue);
}

export function validState(s: unknown): s is GameState {
  const o = s as GameState;
  if (!validCore(o) || o.version !== 1) return false;
  if (!isInt(o.seed) || !isInt(o.undoLeft) || !isNum(o.lastUpdatedAt)) return false;
  if (o.prev !== null && !validCore(o.prev)) return false;
  return true;
}

/** 저장소 접근 실패(사생활 모드 등)에도 게임은 계속되게 한다 */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
export function defaultStore(): KV | null {
  try {
    const ls = window.localStorage;
    const t = '__fg_test__';
    ls.setItem(t, '1');
    ls.removeItem(t);
    return ls;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, store: KV | null = defaultStore()): boolean {
  if (!store || !validState(state)) return false;
  try {
    const cur = store.getItem(SAVE_KEY);
    if (cur) store.setItem(BACKUP_KEY, cur);
    store.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return validState(o) ? o : null;
  } catch {
    return null;
  }
}

export type LoadSource = 'main' | 'backup' | 'none';
export function loadGame(store: KV | null = defaultStore()): { state: GameState | null; source: LoadSource; corrupted: boolean } {
  if (!store) return { state: null, source: 'none', corrupted: false };
  let main: string | null = null;
  let bak: string | null = null;
  try {
    main = store.getItem(SAVE_KEY);
    bak = store.getItem(BACKUP_KEY);
  } catch {
    return { state: null, source: 'none', corrupted: false };
  }
  const m = parse(main);
  if (m) return { state: m, source: 'main', corrupted: false };
  const b = parse(bak);
  if (b) return { state: b, source: 'backup', corrupted: !!main };
  return { state: null, source: 'none', corrupted: !!main || !!bak };
}

export function loadBest(store: KV | null = defaultStore()): number {
  try {
    const v = Number(store?.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}
export function saveBest(v: number, store: KV | null = defaultStore()) {
  try {
    store?.setItem(BEST_KEY, String(Math.floor(v)));
  } catch {
    /* 무시 */
  }
}

export interface Settings {
  sound: boolean;
  reduceFx: boolean;
  bigText: boolean;
  /** 색 구별 표시(♥★●▲◆■) */
  marks: boolean;
}
export const DEFAULT_SETTINGS: Settings = { sound: true, reduceFx: false, bigText: false, marks: false };
export function loadSettings(store: KV | null = defaultStore()): Settings {
  try {
    const o = JSON.parse(store?.getItem(SETTINGS_KEY) || 'null');
    if (!o || typeof o !== 'object') {
      // 처음: 기기에서 '동작 줄이기'를 켰다면 효과 줄이기도 켠 채로 시작
      let reduce = false;
      try {
        reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        /* 무시 */
      }
      return { ...DEFAULT_SETTINGS, reduceFx: reduce };
    }
    return {
      sound: typeof o.sound === 'boolean' ? o.sound : DEFAULT_SETTINGS.sound,
      reduceFx: typeof o.reduceFx === 'boolean' ? o.reduceFx : DEFAULT_SETTINGS.reduceFx,
      bigText: typeof o.bigText === 'boolean' ? o.bigText : DEFAULT_SETTINGS.bigText,
      marks: typeof o.marks === 'boolean' ? o.marks : DEFAULT_SETTINGS.marks,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s: Settings, store: KV | null = defaultStore()) {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}
