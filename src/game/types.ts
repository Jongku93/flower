/**
 * 꽃정원 — 게임 상태 타입
 * layers[0] 이 지금 보이는 바깥 꽃, layers[1] 이 안쪽 꽃. 길이는 0·1·2 만 허용(3겹 금지).
 */
export const ALL_COLORS = ['red', 'yellow', 'pink', 'orange', 'purple', 'blue'] as const;
export type ColorId = (typeof ALL_COLORS)[number];

export const MAX_LAYERS = 2;
export const GRID = 5; // 논리 좌표는 5×5
export const CELL_COUNT = GRID * GRID;

export interface Cell {
  row: number;
  col: number;
  active: boolean;
  layers: ColorId[]; // 0..2
}

/** 대기열의 꽃 한 송이: [바깥] 또는 [바깥, 안쪽] */
export type Piece = ColorId[];

/** 게임 상태 중 '한 수 되돌리기'에 그대로 다시 쓸 수 있는 부분 */
export interface CoreState {
  level: number;
  score: number;
  /** 이번 단계에서 터뜨린 꽃(표면층) 수 — 단계 목표와 비교 */
  levelPopped: number;
  /** 지금까지 터뜨린 꽃 전체 수 */
  totalPopped: number;
  board: Cell[]; // 길이 25, row-major
  queue: Piece[];
  rng: number; // 시드 RNG 의 현재 상태(uint32)
  turn: number;
  bestChain: number;
  over: boolean;
}

export interface GameState extends CoreState {
  version: 1;
  seed: number; // 게임 시작 시드(기록용)
  undoLeft: number;
  /** 바로 전 수의 상태(되돌리기용). 없으면 null */
  prev: CoreState | null;
  lastUpdatedAt: number;
}

/** 한 번의 소거 단계(연쇄 1회) */
export interface MatchGroup {
  color: ColorId;
  /** 이 무리에 든 칸 번호(가로·세로 교차가 이어지면 하나의 무리) */
  cells: number[];
  /** 무리를 이루는 직선 줄 길이들(점수 계산용) */
  runs: number[];
}

export interface PopStep {
  chain: number; // 1부터
  groups: MatchGroup[];
  /** 이번 단계에서 표면층이 벗겨진 칸(중복 없음) */
  cells: number[];
  /** 칸별로 벗겨진 색 */
  removed: Record<number, ColorId>;
  /** 칸별로 새로 드러난 안쪽 꽃(없으면 null) */
  revealed: Record<number, ColorId | null>;
  gain: number;
  /** 이 단계가 끝난 직후의 보드 */
  boardAfter: Cell[];
}

export interface TurnResult {
  ok: boolean;
  reason?: string;
  placedAt: number;
  piece: Piece;
  boardAfterPlace: Cell[];
  steps: PopStep[];
  turnGain: number;
  levelUp: { from: number; to: number; newCells: number[] } | null;
  gameOver: boolean;
  state: GameState;
}

export const idx = (row: number, col: number) => row * GRID + col;
export const rowOf = (i: number) => Math.floor(i / GRID);
export const colOf = (i: number) => i % GRID;
