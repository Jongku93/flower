// 새 화면 검수: 첫 도움말(작은/보통 휴대폰) · 게임 화면 · 게임 끝(이름 → 등수)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const out = new URL('./shots/', import.meta.url).pathname;
const b = await chromium.launch();

/** 가짜 순위 서버(Apps Script 흉내) */
export function mockLeaderboard(ctx, seed = []) {
  const rows = [...seed];
  return ctx.route('https://lb.test/exec**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    let me = '';
    if (req.method() === 'POST') {
      const d = JSON.parse(req.postData());
      rows.push({ ...d, t: Date.now() });
      me = d.device + '|' + d.name;
    } else if (u.searchParams.get('device')) me = u.searchParams.get('device') + '|' + u.searchParams.get('name');
    const best = {};
    for (const r of rows) {
      const k = r.device + '|' + r.name;
      if (!best[k] || r.score > best[k].score) best[k] = { ...r, key: k };
    }
    const list = Object.values(best).sort((a, c) => c.score - a.score);
    const rank = list.findIndex((e) => e.key === me) + 1 || null;
    await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, total: list.length, rank, top: list.slice(0, 30).map((e) => ({ name: e.name, score: e.score, level: e.level, mine: e.key === me })) }) });
  });
}

for (const [w, h, tag] of [[360, 640, 'small'], [390, 844, 'normal']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + `v2-help-${tag}.png` });
  await p.locator('.btn', { hasText: '시작하기' }).click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + `v2-game-${tag}.png` });
  await ctx.close();
}

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const seed = [
  { name: '영희', score: 2450, level: 4, device: 'd-aaaa1111' },
  { name: '순자', score: 1880, level: 3, device: 'd-bbbb2222' },
  { name: '꽃님이', score: 960, level: 2, device: 'd-cccc3333' },
  { name: '말순', score: 420, level: 1, device: 'd-dddd4444' },
];
await mockLeaderboard(ctx, seed);
const p = await ctx.newPage();
await p.goto(BASE + '/?test=1&seed=4&lb=' + encodeURIComponent('https://lb.test/exec'));
await p.waitForFunction(() => window.__fg && window.__fgAssets);
// 2겹 섞인 판
await p.evaluate(() => {
  const s = window.__fg.state();
  const b = s.board.map((c) => ({ ...c, layers: [] }));
  const put = (r, c, l) => (b[r * 5 + c].layers = l);
  put(0, 2, ['yellow']); put(1, 1, ['red', 'pink']); put(1, 2, ['pink']); put(1, 3, ['purple', 'yellow']);
  put(2, 0, ['red', 'pink']); put(2, 1, ['red', 'yellow']); put(2, 3, ['blue']); put(2, 4, ['orange', 'red']);
  put(3, 1, ['yellow']); put(3, 3, ['pink', 'blue']); put(4, 2, ['orange']);
  window.__fg.load({ ...s, board: b, turn: 12, score: 1230, levelPopped: 9, queue: [['red', 'pink'], ['yellow'], ['pink', 'purple'], ['red']] });
});
await p.waitForTimeout(400);
await p.screenshot({ path: out + 'v2-board.png' });
// 게임 끝
await p.evaluate(() => {
  const s = window.__fg.state();
  const cols = ['red', 'yellow', 'pink'];
  let k = 0;
  const b = s.board.map((c) => ({ ...c, layers: c.active ? [cols[k++ % 3]] : [] }));
  window.__fg.load({ ...s, board: b, over: true, score: 1520, level: 3, totalPopped: 90, turn: 140 });
});
await p.waitForTimeout(500);
await p.screenshot({ path: out + 'v2-over-ask.png' });
await p.fill('#player-name', '우리엄마');
await p.locator('.btn', { hasText: '순위에 올리기' }).click();
await p.waitForSelector('.rank-me');
await p.waitForTimeout(400);
await p.screenshot({ path: out + 'v2-over-rank.png' });
await b.close();
