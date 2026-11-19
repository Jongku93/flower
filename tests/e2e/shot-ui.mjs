// 도움말 · 설정 · 색 구별 표시 · 2단계 판 스크린샷
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const out = new URL('./shots/', import.meta.url).pathname;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(BASE + '/'); // 시험 모드 아님 → 처음이면 도움말이 뜸
await p.waitForTimeout(1200);
await p.screenshot({ path: out + 'ui-help.png' });
await p.locator('.btn', { hasText: '닫기' }).click();
await p.locator('.tool', { hasText: '설정' }).click();
await p.locator('.toggle', { hasText: '색 구별 표시' }).click();
await p.screenshot({ path: out + 'ui-settings.png' });
await p.locator('.btn', { hasText: '닫기' }).click();
await p.goto(BASE + '/?test=1&seed=9');
await p.waitForFunction(() => window.__fg && window.__fgAssets);
await p.evaluate(() => {
  const s = window.__fg.state();
  const cols = ['red', 'yellow', 'pink', 'purple', 'orange', 'blue'];
  const b = s.board.map((c, i) => {
    const r = Math.floor(i / 5), k = i % 5;
    const active = !((r === 0 || r === 4) && (k === 0 || k === 4));
    const layers = active && (i * 7) % 5 !== 0 ? (i % 3 === 0 ? [cols[i % 6], cols[(i + 2) % 6]] : [cols[i % 6]]) : [];
    return { ...c, active, layers };
  });
  window.__fg.load({ ...s, level: 2, board: b, score: 1230, levelPopped: 12 });
});
await p.waitForTimeout(300);
await p.screenshot({ path: out + 'ui-level2-marks.png' });
await b.close();
