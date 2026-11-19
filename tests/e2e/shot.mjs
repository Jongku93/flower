// 화면 검수용 스크린샷: node tests/e2e/shot.mjs [url]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 컨테이너에 미리 깔린 Playwright
const url = process.argv[2] || 'http://localhost:4173/?test=1&seed=7';
const out = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(url);
await page.waitForFunction(() => window.__fg && window.__fgAssets);
// 장면: 여러 색 + 2겹 꽃
await page.evaluate(() => {
  const s = window.__fg.state();
  const b = s.board.map((c) => ({ ...c, layers: [] }));
  const put = (r, c, l) => (b[r * 5 + c].layers = l);
  put(0, 2, ['yellow']); put(1, 1, ['red', 'pink']); put(1, 2, ['pink']); put(1, 3, ['purple', 'yellow']);
  put(2, 0, ['red', 'pink']); put(2, 1, ['red', 'yellow']); put(2, 3, ['blue']); put(2, 4, ['orange', 'red']);
  put(3, 1, ['yellow']); put(3, 3, ['pink', 'blue']); put(4, 2, ['orange']);
  window.__fg.load({ ...s, board: b, queue: [['red', 'pink'], ['yellow'], ['pink', 'purple'], ['red']] });
});
await page.waitForTimeout(400);
await page.screenshot({ path: out + '01-board.png' });
// 팝: (2,2) 에 [red,pink] → 빨강 3개 (2,0)(2,1)(2,2) 터짐
const box = await page.locator('[data-cell="12"]').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
const t0 = Date.now();
for (const ms of [120, 260, 400, 560, 760, 1000, 1500]) {
  const w = ms - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w);
  await page.screenshot({ path: out + `02-pop-${String(ms).padStart(4, '0')}.png` });
}
await page.waitForFunction(() => !window.__fg.busy());
await page.screenshot({ path: out + '03-after.png' });
console.log('errors:', JSON.stringify(errs));
console.log(await page.evaluate(() => JSON.stringify(window.__fg.state().board.filter(c=>c.active).map(c=>c.layers.join('+')||'-'))));
await browser.close();
