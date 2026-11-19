/**
 * 난이도 점검: 단순한 두 종류의 자동 플레이어로 여러 판을 돌려 도달 단계·턴 수를 본다.
 *   npx vite-node tools/balance-sim.ts
 * - random: 빈 칸 아무 데나
 * - casual: 바로 터지는 자리 > 같은 색 옆자리 > 아무 데나 (대기열 첫 꽃만 봄, '보통 사람' 근사)
 */
import { newGame, resolveTurn } from '../src/game/engine';
import { GRID, type GameState } from '../src/game/types';

type Policy = (s: GameState, rnd: () => number) => number;
const empties = (s: GameState) => s.board.map((c, i) => (c.active && !c.layers.length ? i : -1)).filter((i) => i >= 0);
const random: Policy = (s, rnd) => { const e = empties(s); return e[Math.floor(rnd() * e.length)]; };
const casual: Policy = (s, rnd) => {
  const e = empties(s);
  let best = -1e9, pick = e[0];
  for (const i of e) {
    const r = resolveTurn(s, i);
    let sc = r.steps.reduce((a, st) => a + st.cells.length * 10 * st.chain, 0);
    const col = s.queue[0][0], rr = Math.floor(i / GRID), cc = i % GRID;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const n = s.board[(rr + dr) * GRID + cc + dc];
      if (rr + dr >= 0 && rr + dr < GRID && cc + dc >= 0 && cc + dc < GRID && n?.active && n.layers[0] === col) sc += 3;
    }
    sc += rnd();
    if (sc > best) { best = sc; pick = i; }
  }
  return pick;
};

function run(policy: Policy, games: number) {
  const levels: number[] = [], turns: number[] = [];
  for (let g = 1; g <= games; g++) {
    let s = newGame(g * 7919);
    let seed = g;
    const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    while (!s.over && s.turn < 3000) s = resolveTurn(s, policy(s, rnd)).state;
    levels.push(s.level); turns.push(s.turn);
  }
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  const dist: Record<number, number> = {};
  levels.forEach((l) => (dist[l] = (dist[l] || 0) + 1));
  return { avgLevel: avg(levels), avgTurns: avg(turns), reachedLv2: (levels.filter((l) => l >= 2).length / games * 100).toFixed(0) + '%', reachedLv3: (levels.filter((l) => l >= 3).length / games * 100).toFixed(0) + '%', dist };
}
console.log('random', run(random, 300));
console.log('casual', run(casual, 300));
