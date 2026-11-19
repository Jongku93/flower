import { describe, expect, it } from 'vitest';
import { newGame, resolveTurn } from '../../src/game/engine';
import { BACKUP_KEY, loadGame, SAVE_KEY, saveGame, validState, type KV } from '../../src/game/save';
import { idx } from '../../src/game/types';

function memStore(): KV & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => void m.set(k, v) };
}

describe('저장 · 복원', () => {
  it('보드 레이어·레벨·점수·대기열·되돌리기·RNG 까지 정확히 복원', () => {
    const st = memStore();
    let s = newGame(77);
    for (const at of [idx(2, 2), idx(1, 2), idx(2, 1), idx(3, 2)]) s = resolveTurn(s, at).state;
    s = { ...s, board: s.board.map((c, i) => (i === idx(2, 0) ? { ...c, layers: ['red', 'pink'] } : c)) };
    expect(saveGame(s, st)).toBe(true);
    const r = loadGame(st);
    expect(r.source).toBe('main');
    expect(r.state).toEqual(s);
    // 복원 후 같은 수를 두면 같은 결과(RNG 상태 보존)
    const a = resolveTurn(s, idx(2, 3), 1).state;
    const b = resolveTurn(r.state!, idx(2, 3), 1).state;
    expect(b).toEqual(a);
  });

  it('3겹 꽃이 든 저장은 거부하고 백업으로 복원', () => {
    const st = memStore();
    const good = newGame(1);
    saveGame(good, st);
    saveGame(resolveTurn(good, idx(2, 2)).state, st); // 백업 = good
    const bad = JSON.parse(st.m.get(SAVE_KEY)!);
    bad.board[idx(2, 2)].layers = ['red', 'pink', 'yellow'];
    st.m.set(SAVE_KEY, JSON.stringify(bad));
    expect(validState(bad)).toBe(false);
    const r = loadGame(st);
    expect(r.source).toBe('backup');
    expect(r.corrupted).toBe(true);
    expect(r.state).toEqual(good);
  });

  it('대기열에 3겹, 모르는 색, 비활성 칸의 꽃, 마스크 불일치는 모두 거부', () => {
    const s = newGame(2);
    const mut = (f: (o: any) => void) => {
      const o = JSON.parse(JSON.stringify(s));
      f(o);
      return validState(o);
    };
    expect(validState(s)).toBe(true);
    expect(mut((o) => (o.queue[0] = ['red', 'pink', 'blue']))).toBe(false);
    expect(mut((o) => (o.board[12].layers = ['green']))).toBe(false);
    expect(mut((o) => (o.board[0].layers = ['red']))).toBe(false);
    expect(mut((o) => (o.board[0].active = true))).toBe(false);
    expect(mut((o) => (o.board = o.board.slice(0, 24)))).toBe(false);
    expect(mut((o) => (o.prev = { ...o, board: o.board.map((c: any, i: number) => (i === 12 ? { ...c, layers: ['a', 'b', 'c'] } : c)) }))).toBe(false);
  });

  it('깨진 JSON 과 백업 없음 → 새 게임 필요(null)', () => {
    const st = memStore();
    st.m.set(SAVE_KEY, '{oops');
    const r = loadGame(st);
    expect(r.state).toBeNull();
    expect(r.corrupted).toBe(true);
    expect(st.m.has(BACKUP_KEY)).toBe(false);
  });

  it('저장소가 없어도(사생활 모드) 오류 없이 진행', () => {
    expect(saveGame(newGame(1), null)).toBe(false);
    expect(loadGame(null).state).toBeNull();
  });
});
