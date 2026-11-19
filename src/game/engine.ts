/**
 * 꽃정원 — 순수 게임 규칙. 화면·시간·저장과 무관하다.
 *
 * 한 턴: 빈 칸에 다음 꽃 배치 → 표면 꽃(layers[0])만 보고 가로·세로 같은 색 3개 이상 찾기
 *       → 해당 칸의 표면층만 한 번씩 벗기기 → 새로 드러난 꽃으로 다시 찾기(연쇄) → 점수 → 단계 확인.
 * resolveTurn 은 턴 전체를 끝까지 계산해 단계별 결과(steps)와 최종 상태를 돌려준다.
 * 화면은 steps 를 재생만 하므로 연출과 판정이 어긋날 수 없다.
 */
import { GAME_CONFIG } from './config';
import { levelConfig, maskActive } from './levels';
import { nextRandom, randomSeed } from './rng';
import {
  CELL_COUNT,
  GRID,
  MAX_LAYERS,
  colOf,
  idx,
  rowOf,
  type Cell,
  type ColorId,
  type CoreState,
  type GameState,
  type MatchGroup,
  type Piece,
  type PopStep,
  type TurnResult,
} from './types';

/* ---------- 보드 ---------- */

export function emptyBoard(level: number): Cell[] {
  const mask = levelConfig(level).mask;
  const b: Cell[] = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) b.push({ row: r, col: c, active: maskActive(mask, r, c), layers: [] });
  return b;
}

export function cloneBoard(board: Cell[]): Cell[] {
  return board.map((c) => ({ row: c.row, col: c.col, active: c.active, layers: c.layers.slice() }));
}

/** 마스크를 넓히기만 한다(기존 꽃은 그대로). 새로 열린 칸 번호를 돌려준다 */
export function expandBoard(board: Cell[], level: number): number[] {
  const mask = levelConfig(level).mask;
  const opened: number[] = [];
  for (const cell of board) {
    if (!cell.active && maskActive(mask, cell.row, cell.col)) {
      cell.active = true;
      opened.push(idx(cell.row, cell.col));
    }
  }
  return opened;
}

export const surface = (cell: Cell): ColorId | null => (cell.active && cell.layers.length ? cell.layers[0] : null);

export function hasEmptySlot(board: Cell[]): boolean {
  return board.some((c) => c.active && c.layers.length === 0);
}

/* ---------- 대기열 ---------- */

export function makePiece(level: number, rng: number): [Piece, number] {
  const cfg = levelConfig(level);
  let r: number;
  let s = rng;
  [r, s] = nextRandom(s);
  const outer = cfg.colors[Math.floor(r * cfg.colors.length)];
  [r, s] = nextRandom(s);
  if (r >= cfg.doubleChance || cfg.colors.length < 2) return [[outer], s];
  const pool = GAME_CONFIG.innerDiffersFromOuter ? cfg.colors.filter((c) => c !== outer) : cfg.colors;
  [r, s] = nextRandom(s);
  const inner = pool[Math.floor(r * pool.length)];
  return [[outer, inner], s];
}

function refillQueue(queue: Piece[], level: number, rng: number): [Piece[], number] {
  const q = queue.map((p) => p.slice());
  let s = rng;
  while (q.length < GAME_CONFIG.queueLength) {
    let p: Piece;
    [p, s] = makePiece(level, s);
    q.push(p);
  }
  return [q, s];
}

/* ---------- 새 게임 ---------- */

export function newGame(seed: number = randomSeed()): GameState {
  const [queue, rng] = refillQueue([], 1, seed >>> 0);
  return {
    version: 1,
    seed: seed >>> 0,
    level: 1,
    score: 0,
    levelPopped: 0,
    totalPopped: 0,
    board: emptyBoard(1),
    queue,
    rng,
    turn: 0,
    bestChain: 0,
    over: false,
    undoLeft: GAME_CONFIG.undoPerLevel,
    prev: null,
    lastUpdatedAt: Date.now(),
  };
}

/* ---------- 판정 ---------- */

interface Run {
  color: ColorId;
  cells: number[];
}

/** 표면 꽃만 보고 가로·세로 같은 색 3개 이상 직선을 모두 찾는다. 빈 칸·비활성 칸은 줄을 끊는다 */
export function findRuns(board: Cell[]): Run[] {
  const runs: Run[] = [];
  const scan = (line: number[]) => {
    let start = 0;
    for (let i = 1; i <= line.length; i++) {
      const prev = surface(board[line[i - 1]]);
      const cur = i < line.length ? surface(board[line[i]]) : null;
      if (cur !== null && cur === prev) continue;
      const len = i - start;
      if (prev !== null && len >= 3) runs.push({ color: prev, cells: line.slice(start, i) });
      start = i;
    }
  };
  for (let r = 0; r < GRID; r++) scan(Array.from({ length: GRID }, (_, c) => idx(r, c)));
  for (let c = 0; c < GRID; c++) scan(Array.from({ length: GRID }, (_, r) => idx(r, c)));
  return runs;
}

/** 직선들을 같은 색끼리 칸을 공유하면 하나의 무리로 묶는다(교차 매치 = 큰 꽃 하나) */
export function findMatches(board: Cell[]): MatchGroup[] {
  const runs = findRuns(board);
  const groups: { color: ColorId; cells: Set<number>; runs: number[] }[] = [];
  for (const run of runs) {
    const hits = groups.filter((g) => g.color === run.color && run.cells.some((c) => g.cells.has(c)));
    const merged = { color: run.color, cells: new Set(run.cells), runs: [run.cells.length] };
    for (const h of hits) {
      h.cells.forEach((c) => merged.cells.add(c));
      merged.runs.push(...h.runs);
      groups.splice(groups.indexOf(h), 1);
    }
    groups.push(merged);
  }
  return groups.map((g) => ({ color: g.color, cells: [...g.cells].sort((a, b) => a - b), runs: g.runs }));
}

export function chainMultiplier(chain: number): number {
  return 1 + (chain - 1) * GAME_CONFIG.score.chainStep;
}

export function stepScore(groups: MatchGroup[], uniqueCells: number, chain: number): number {
  const sc = GAME_CONFIG.score;
  let base = uniqueCells * sc.perFlower;
  for (const g of groups) for (const len of g.runs) base += Math.max(0, len - 3) * sc.longRunBonusPerFlower;
  return Math.round(base * chainMultiplier(chain));
}

/** 소거를 연쇄가 끝날 때까지 반복. board 는 바뀌지 않고 단계별 결과만 돌려준다 */
export function resolveMatches(start: Cell[]): PopStep[] {
  const steps: PopStep[] = [];
  let board = cloneBoard(start);
  for (let chain = 1; chain <= GAME_CONFIG.maxChainSteps; chain++) {
    const groups = findMatches(board);
    if (!groups.length) return steps;
    const cells = [...new Set(groups.flatMap((g) => g.cells))].sort((a, b) => a - b);
    const next = cloneBoard(board);
    const removed: Record<number, ColorId> = {};
    const revealed: Record<number, ColorId | null> = {};
    for (const i of cells) {
      const layers = next[i].layers;
      removed[i] = layers[0];
      layers.shift(); // 표면층 하나만, 칸마다 정확히 한 번
      revealed[i] = layers.length ? layers[0] : null;
    }
    steps.push({ chain, groups, cells, removed, revealed, gain: stepScore(groups, cells.length, chain), boardAfter: next });
    board = next;
  }
  throw new Error('연쇄 상한 초과 — 판정 오류');
}

/* ---------- 턴 ---------- */

function core(s: GameState): CoreState {
  return {
    level: s.level,
    score: s.score,
    levelPopped: s.levelPopped,
    totalPopped: s.totalPopped,
    board: cloneBoard(s.board),
    queue: s.queue.map((p) => p.slice()),
    rng: s.rng,
    turn: s.turn,
    bestChain: s.bestChain,
    over: s.over,
  };
}

function fail(state: GameState, at: number, reason: string): TurnResult {
  return {
    ok: false,
    reason,
    placedAt: at,
    piece: [],
    boardAfterPlace: state.board,
    steps: [],
    turnGain: 0,
    levelUp: null,
    gameOver: state.over,
    state,
  };
}

export function canPlace(state: GameState, at: number): boolean {
  const cell = state.board[at];
  return !state.over && !!cell && cell.active && cell.layers.length === 0;
}

export function resolveTurn(state: GameState, at: number, now: number = Date.now()): TurnResult {
  if (state.over) return fail(state, at, 'over');
  if (!Number.isInteger(at) || at < 0 || at >= CELL_COUNT) return fail(state, at, 'bad-index');
  if (!canPlace(state, at)) return fail(state, at, 'occupied-or-inactive');

  const piece = state.queue[0].slice(0, MAX_LAYERS);
  const board = cloneBoard(state.board);
  board[at].layers = piece.slice();
  const boardAfterPlace = cloneBoard(board);

  const steps = resolveMatches(board);
  const finalBoard = steps.length ? cloneBoard(steps[steps.length - 1].boardAfter) : board;
  const turnGain = steps.reduce((a, s) => a + s.gain, 0);
  const popped = steps.reduce((a, s) => a + s.cells.length, 0);

  let level = state.level;
  let levelPopped = state.levelPopped + popped;
  let levelUp: TurnResult['levelUp'] = null;
  let undoLeft = state.undoLeft;
  if (levelPopped >= levelConfig(level).goal) {
    const from = level;
    level += 1;
    levelPopped = 0;
    undoLeft = GAME_CONFIG.undoPerLevel;
    const newCells = expandBoard(finalBoard, level);
    levelUp = { from, to: level, newCells };
  }
  // 이미 보여 준 대기열 꽃은 바꾸지 않고, 새로 채우는 꽃만 (새) 단계 색·확률로 뽑는다
  const [queue, rng] = refillQueue(state.queue.slice(1), level, state.rng);

  const over = !hasEmptySlot(finalBoard);
  const next: GameState = {
    version: 1,
    seed: state.seed,
    level,
    score: state.score + turnGain,
    levelPopped,
    totalPopped: state.totalPopped + popped,
    board: finalBoard,
    queue,
    rng,
    turn: state.turn + 1,
    bestChain: Math.max(state.bestChain, steps.length),
    over,
    undoLeft,
    prev: levelUp ? null : core(state), // 단계가 바뀐 수는 되돌리지 않음
    lastUpdatedAt: now,
  };
  return { ok: true, placedAt: at, piece, boardAfterPlace, steps, turnGain, levelUp, gameOver: over, state: next };
}

export function canUndo(state: GameState): boolean {
  return state.prev !== null && state.undoLeft > 0;
}

export function undo(state: GameState, now: number = Date.now()): GameState {
  if (!canUndo(state) || !state.prev) return state;
  const p = state.prev;
  return { ...state, ...core({ ...state, ...p } as GameState), undoLeft: state.undoLeft - 1, prev: null, lastUpdatedAt: now };
}

/* ---------- 도우미 ---------- */

export const cellIndex = (c: Cell) => idx(c.row, c.col);
export { rowOf, colOf };
