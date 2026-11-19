import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/game/config';
import {
  canUndo,
  emptyBoard,
  findMatches,
  makePiece,
  newGame,
  resolveMatches,
  resolveTurn,
  undo,
} from '../../src/game/engine';
import { levelConfig, maskCount, MASK_13, MASK_21 } from '../../src/game/levels';
import { idx, type Cell, type ColorId, type GameState, type Piece } from '../../src/game/types';

/** 보드에 꽃을 직접 놓는 시험 도우미 */
function put(board: Cell[], at: [number, number], layers: ColorId[]) {
  board[idx(at[0], at[1])].layers = layers.slice();
}
function stateWith(board: Cell[], queue: Piece[], level = 1, extra: Partial<GameState> = {}): GameState {
  const s = newGame(12345);
  return { ...s, level, board, queue: queue.concat(s.queue).slice(0, 4), ...extra };
}
const layersAt = (b: Cell[], r: number, c: number) => b[idx(r, c)].layers;

describe('1. 보드 마스크', () => {
  it('1단계 13칸, 2단계 21칸', () => {
    expect(maskCount(MASK_13)).toBe(13);
    expect(maskCount(MASK_21)).toBe(21);
    expect(emptyBoard(1).filter((c) => c.active)).toHaveLength(13);
    expect(emptyBoard(2).filter((c) => c.active)).toHaveLength(21);
    const rows = (m: string[]) => m.map((r) => r.split('').filter((x) => x === 'O').length);
    expect(rows(levelConfig(1).mask)).toEqual([1, 3, 5, 3, 1]);
    expect(rows(levelConfig(2).mask)).toEqual([3, 5, 5, 5, 3]);
  });

  it('비활성 칸에는 놓을 수 없다', () => {
    const s = newGame(1);
    const r = resolveTurn(s, idx(0, 0));
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });

  it('2단계로 올라가면 기존 꽃은 그대로, 슬롯만 21칸으로 확장', () => {
    const b = emptyBoard(1);
    put(b, [2, 0], ['yellow']);
    put(b, [1, 2], ['pink', 'purple'].slice(0, 1) as ColorId[]);
    put(b, [3, 1], ['red', 'pink']);
    put(b, [2, 2], ['red']);
    put(b, [2, 3], ['red']);
    const goal = levelConfig(1).goal;
    const s = stateWith(b, [['red']], 1, { levelPopped: goal - 3 });
    const r = resolveTurn(s, idx(2, 4)); // 빨강 3개 (2,2)(2,3)(2,4)
    expect(r.ok).toBe(true);
    expect(r.levelUp).toEqual({ from: 1, to: 2, newCells: expect.any(Array) });
    expect(r.levelUp!.newCells).toHaveLength(8);
    expect(r.state.level).toBe(2);
    expect(r.state.board.filter((c) => c.active)).toHaveLength(21);
    expect(layersAt(r.state.board, 2, 0)).toEqual(['yellow']);
    expect(layersAt(r.state.board, 1, 2)).toEqual(['pink']);
    expect(layersAt(r.state.board, 3, 1)).toEqual(['red', 'pink']);
    expect(layersAt(r.state.board, 2, 2)).toEqual([]);
    expect(r.state.levelPopped).toBe(0);
  });
});

describe('2. 같은 색 판정', () => {
  it('2개는 안 터진다', () => {
    const b = emptyBoard(1);
    put(b, [2, 1], ['red']);
    put(b, [2, 2], ['red']);
    expect(findMatches(b)).toEqual([]);
  });
  it('다른 색 3개 일직선은 안 터진다', () => {
    const b = emptyBoard(1);
    put(b, [2, 1], ['red']);
    put(b, [2, 2], ['yellow']);
    put(b, [2, 3], ['pink']);
    expect(findMatches(b)).toEqual([]);
  });
  it('3개 가로 / 세로', () => {
    const b = emptyBoard(1);
    put(b, [2, 1], ['red']);
    put(b, [2, 2], ['red']);
    put(b, [2, 3], ['red']);
    expect(findMatches(b)).toEqual([{ color: 'red', cells: [11, 12, 13], runs: [3] }]);
    const v = emptyBoard(1);
    put(v, [1, 2], ['pink']);
    put(v, [2, 2], ['pink']);
    put(v, [3, 2], ['pink']);
    expect(findMatches(v)).toEqual([{ color: 'pink', cells: [7, 12, 17], runs: [3] }]);
  });
  it('4개, 5개 연결', () => {
    const b = emptyBoard(1);
    for (let c = 0; c < 4; c++) put(b, [2, c], ['yellow']);
    expect(findMatches(b)[0].cells).toHaveLength(4);
    put(b, [2, 4], ['yellow']);
    const g = findMatches(b);
    expect(g).toHaveLength(1);
    expect(g[0].cells).toHaveLength(5);
    expect(g[0].runs).toEqual([5]);
  });
  it('가로·세로 교차(십자)는 가운데 칸을 한 번만 지운다', () => {
    const b = emptyBoard(1);
    for (let c = 0; c < 5; c++) put(b, [2, c], ['red']);
    for (let r = 0; r < 5; r++) put(b, [r, 2], ['red']);
    const g = findMatches(b);
    expect(g).toHaveLength(1);
    expect(g[0].cells).toHaveLength(9);
    const steps = resolveMatches(b);
    expect(steps).toHaveLength(1);
    expect(steps[0].cells).toHaveLength(9);
    expect(steps[0].boardAfter.every((c) => c.layers.length === 0)).toBe(true);
  });
  it('비활성 칸은 줄을 끊는다', () => {
    const b = emptyBoard(1); // (1,0) 비활성
    put(b, [1, 1], ['red']);
    put(b, [1, 2], ['red']);
    expect(findMatches(b)).toEqual([]);
  });
  it('서로 다른 색 두 무리가 동시에 터진다', () => {
    const b = emptyBoard(2);
    for (let c = 1; c < 4; c++) put(b, [0, c], ['red']);
    for (let c = 1; c < 4; c++) put(b, [4, c], ['yellow']);
    const g = findMatches(b);
    expect(g.map((x) => x.color).sort()).toEqual(['red', 'yellow']);
  });
});

describe('3. 표면 꽃만 제거', () => {
  it('[red,pink] [red,yellow] [red] → 분홍 · 노랑 · 빈칸', () => {
    const b = emptyBoard(1);
    put(b, [2, 1], ['red', 'pink']);
    put(b, [2, 2], ['red', 'yellow']);
    const s = stateWith(b, [['red']]);
    const r = resolveTurn(s, idx(2, 3));
    expect(r.steps).toHaveLength(1);
    expect(layersAt(r.state.board, 2, 1)).toEqual(['pink']);
    expect(layersAt(r.state.board, 2, 2)).toEqual(['yellow']);
    expect(layersAt(r.state.board, 2, 3)).toEqual([]);
    expect(r.steps[0].removed).toEqual({ 11: 'red', 12: 'red', 13: 'red' });
    expect(r.steps[0].revealed).toEqual({ 11: 'pink', 12: 'yellow', 13: null });
  });
});

describe('4. 안쪽 꽃 연쇄', () => {
  it('[red,pink] 세 개 → 빨강 터지고 남은 분홍 세 개가 같은 턴에 연쇄로 터진다', () => {
    const b = emptyBoard(1);
    put(b, [2, 1], ['red', 'pink']);
    put(b, [2, 2], ['red', 'pink']);
    const s = stateWith(b, [['red', 'pink']]);
    const r = resolveTurn(s, idx(2, 3));
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].groups[0].color).toBe('red');
    expect(r.steps[0].boardAfter[idx(2, 1)].layers).toEqual(['pink']); // 첫 단계 뒤 분홍만 남음
    expect(r.steps[1].groups[0].color).toBe('pink');
    expect(r.steps[1].chain).toBe(2);
    expect(layersAt(r.state.board, 2, 1)).toEqual([]);
    expect(r.state.bestChain).toBe(2);
  });
  it('드러난 안쪽 꽃이 주변 표면 꽃과 이어져도 연쇄', () => {
    const b = emptyBoard(1);
    put(b, [1, 1], ['yellow', 'pink']);
    put(b, [1, 2], ['yellow']);
    put(b, [2, 0], ['pink']);
    put(b, [2, 2], ['pink']);
    // (1,3) 노랑 → 노랑 3개 → (1,1) 분홍 드러남 → 세로 (1,1)? 아니, 가로 (2,*) 와는 별개
    const s = stateWith(b, [['yellow']]);
    const r = resolveTurn(s, idx(1, 3));
    expect(r.steps).toHaveLength(1);
    expect(layersAt(r.state.board, 1, 1)).toEqual(['pink']);
    // 세로 연결 만들기: (1,1) 분홍 + (2,1) 분홍 + (3,1) 분홍
    const b2 = emptyBoard(1);
    put(b2, [1, 1], ['yellow', 'pink']);
    put(b2, [1, 2], ['yellow']);
    put(b2, [2, 1], ['pink']);
    put(b2, [3, 1], ['pink']);
    const r2 = resolveTurn(stateWith(b2, [['yellow']]), idx(1, 3));
    expect(r2.steps.map((x) => x.groups[0].color)).toEqual(['yellow', 'pink']);
    expect(r2.steps[1].cells).toEqual([idx(1, 1), idx(2, 1), idx(3, 1)]);
  });
});

describe('5. 3겹 금지', () => {
  it('대기열에서 만들어지는 꽃은 항상 1~2겹, 안쪽은 바깥과 다른 색', () => {
    let rng = 7;
    for (let lv = 1; lv <= 15; lv++) {
      for (let i = 0; i < 2000; i++) {
        let p: Piece;
        [p, rng] = makePiece(lv, rng);
        expect(p.length === 1 || p.length === 2).toBe(true);
        expect(levelConfig(lv).colors).toContain(p[0]);
        if (p.length === 2) expect(p[1]).not.toBe(p[0]);
      }
    }
  });
  it('긴 무작위 플레이에서도 어떤 칸도 2겹을 넘지 않는다', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = newGame(seed);
      let rng = seed * 99991;
      for (let t = 0; t < 400 && !s.over; t++) {
        const empties = s.board.map((c, i) => (c.active && !c.layers.length ? i : -1)).filter((i) => i >= 0);
        rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
        const r = resolveTurn(s, empties[rng % empties.length]);
        expect(r.ok).toBe(true);
        s = r.state;
        expect(s.board.every((c) => c.layers.length <= 2)).toBe(true);
        expect(s.board.every((c) => c.active || c.layers.length === 0)).toBe(true);
        for (const st of r.steps) expect(st.boardAfter.every((c) => c.layers.length <= 2)).toBe(true);
      }
    }
  });
});

describe('6. 점수 · 연쇄 안정성', () => {
  it('교차 매치에서 칸 점수는 한 번만', () => {
    const b = emptyBoard(1);
    for (let c = 1; c < 4; c++) put(b, [2, c], ['red']);
    put(b, [1, 2], ['red']);
    put(b, [3, 2], ['red']);
    const steps = resolveMatches(b);
    expect(steps[0].cells).toHaveLength(5);
    expect(steps[0].gain).toBe(5 * GAME_CONFIG.score.perFlower);
  });
  it('연쇄 배수와 턴 점수 합계가 일치', () => {
    const b = emptyBoard(1);
    put(b, [2, 1], ['red', 'pink']);
    put(b, [2, 2], ['red', 'pink']);
    const s = stateWith(b, [['red', 'pink']], 1, { score: 100 });
    const r = resolveTurn(s, idx(2, 3));
    expect(r.steps[0].gain).toBe(30);
    expect(r.steps[1].gain).toBe(45);
    expect(r.turnGain).toBe(75);
    expect(r.state.score).toBe(175);
    expect(r.state.levelPopped).toBe(s.levelPopped + 6);
  });
  it('어떤 판이든 연쇄는 상한 안에서 끝난다(꽉 찬 2겹 판)', () => {
    const b = emptyBoard(2);
    const cols: ColorId[] = ['red', 'yellow', 'pink', 'purple'];
    b.forEach((c, i) => {
      if (c.active) c.layers = [cols[i % 4], cols[(i + 1) % 4]];
    });
    const steps = resolveMatches(b);
    expect(steps.length).toBeLessThanOrEqual(GAME_CONFIG.maxChainSteps);
  });
  it('이미 꽃이 있는 칸은 무시(상태 그대로)', () => {
    const s = newGame(3);
    const r1 = resolveTurn(s, idx(2, 2));
    const r2 = resolveTurn(r1.state, idx(2, 2));
    expect(r2.ok).toBe(false);
    expect(r2.state).toBe(r1.state);
  });
  it('같은 시드 = 같은 대기열', () => {
    expect(newGame(42).queue).toEqual(newGame(42).queue);
    expect(newGame(42).queue).toHaveLength(GAME_CONFIG.queueLength);
  });
});

describe('7. 되돌리기 · 게임 끝', () => {
  it('되돌리면 직전 보드·점수·대기열·RNG 로 돌아간다', () => {
    const s0 = newGame(5);
    const s1 = resolveTurn(s0, idx(2, 2)).state;
    expect(canUndo(s1)).toBe(true);
    const u = undo(s1);
    expect(u.board).toEqual(s0.board);
    expect(u.queue).toEqual(s0.queue);
    expect(u.rng).toBe(s0.rng);
    expect(u.undoLeft).toBe(s1.undoLeft - 1);
    expect(canUndo(u)).toBe(false); // 연속 되돌리기는 한 수만
  });
  it('빈 칸이 없으면 게임 끝, 더는 놓을 수 없다', () => {
    const b = emptyBoard(1);
    const cols: ColorId[] = ['red', 'yellow', 'pink'];
    let k = 0;
    b.forEach((c, i) => {
      if (c.active && i !== idx(0, 2)) c.layers = [cols[k++ % 3]];
    });
    // (0,2) 위에 놓을 꽃: 아래 (1,2) 와 다른 색이라 안 터지게
    const below = b[idx(1, 2)].layers[0];
    const piece: ColorId = cols.find((c) => c !== below && c !== b[idx(2, 2)].layers[0])!;
    const r = resolveTurn(stateWith(b, [[piece]]), idx(0, 2));
    expect(r.steps).toHaveLength(0);
    expect(r.gameOver).toBe(true);
    expect(resolveTurn(r.state, idx(0, 2)).ok).toBe(false);
  });
});
