// 꽃정원 화면 시험 (휴대폰 크기 Chromium).
//   npm run build && npm run preview   (다른 창)
//   npm run e2e                         → BASE=http://localhost:4173 기본
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 컨테이너에 미리 깔린 Playwright 사용
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = new URL('./shots/', import.meta.url).pathname;

let bad = 0;
const ok = (name, cond, extra) => {
  if (cond) console.log('✔', name);
  else {
    bad++;
    console.log('✖', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 500));
  }
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

async function open(ctx, q = 'test=1&seed=11') {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(`${BASE}/?${q}`);
  await page.waitForFunction(() => window.__fg && window.__fgAssets, null, { timeout: 15000 });
  return page;
}
/** 보드를 직접 꾸민다: cells = { 'r,c': ['red','pink'] } */
async function setBoard(page, cells, queue, extra = {}) {
  await page.evaluate(
    ([cells, queue, extra]) => {
      const s = window.__fg.state();
      const b = s.board.map((c) => ({ ...c, layers: [] }));
      for (const [k, v] of Object.entries(cells)) {
        const [r, c] = k.split(',').map(Number);
        b[r * 5 + c].layers = v;
      }
      window.__fg.load({ ...s, board: b, queue: queue.concat(s.queue).slice(0, 4), over: false, prev: null, ...extra });
    },
    [cells, queue, extra],
  );
  await page.waitForTimeout(80);
}
const tap = async (page, i) => {
  const b = await page.locator(`[data-cell="${i}"]`).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
const idle = (page) => page.waitForFunction(() => !window.__fg.busy() && !window.__fg.fxBusy(), null, { timeout: 10000 });
const layers = (page) => page.evaluate(() => window.__fg.state().board.map((c) => c.layers.join('+')));
const I = (r, c) => r * 5 + c;

/* ---------- 1. 시작 화면 · 13칸 · 그림 10개 ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  ok('첫 화면 활성 칸 13개', (await page.locator('.slot:not(.off)').count()) === 13);
  const assets = await page.evaluate(() => window.__fgAssets);
  ok('그림 소스 10개 모두 로드', assets.ok === 10 && assets.failed.length === 0, assets);
  ok('겹꽃용 앞 꽃잎 그림 6개 로드', assets.frontOk === 6, assets);
  const alpha = await page.evaluate(async () => {
    const names = ['red', 'yellow', 'pink', 'orange', 'purple', 'blue'].map((c) => `flowers/flower_${c}`).concat(['effects/pop_01_bloom', 'effects/pop_02_burst', 'effects/pop_03_scatter', 'effects/pop_04_fade']);
    const res = [];
    for (const n of names) {
      const img = new Image();
      img.src = `./assets/${n}.png`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = (x, y) => g.getImageData(x, y, 1, 1).data[3];
      res.push({ n, w: img.naturalWidth, h: img.naturalHeight, corners: [px(0, 0), px(511, 0), px(0, 511), px(511, 511)], center: px(256, 270) });
    }
    return res;
  });
  ok('10개 모두 512×512', alpha.every((a) => a.w === 512 && a.h === 512), alpha);
  ok('10개 모두 모서리 투명(알파 0)', alpha.every((a) => a.corners.every((v) => v === 0)), alpha);
  ok('꽃 6개는 가운데 불투명', alpha.slice(0, 6).every((a) => a.center > 200), alpha);
  // 실제 화면에서 꽃 그림 모서리가 흰/검은 사각형이 아닌지: 꽃 칸의 그림 모서리 픽셀 = 판 배경색(민트)
  await setBoard(page, { '2,2': ['red'] }, [['yellow']]);
  const shot = await page.locator('[data-cell="12"]').screenshot({ path: OUT + 'e2e-cell.png' });
  const pix = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    return [[1, 1], [img.width - 2, 1], [1, img.height - 2], [img.width - 2, img.height - 2]].map(([x, y]) => [...g.getImageData(x, y, 1, 1).data]);
  }, shot.toString('base64'));
  const mintish = (p) => p[1] > 150 && p[1] > p[0] + 15 && !(p[0] > 245 && p[1] > 245 && p[2] > 245) && !(p[0] < 20 && p[1] < 20 && p[2] < 20);
  ok('꽃 칸 모서리는 판 민트색(흰/검은 사각형 아님)', pix.every(mintish), pix);
  ok('오류 없음', page.errors.length === 0, page.errors);
  await ctx.close();
}

/* ---------- 2. 판정 · 표면만 제거 · 연쇄 (실제 화면 조작) ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  await setBoard(page, { '2,1': ['red'], '2,2': ['red'] }, [['yellow'], ['pink']]);
  await tap(page, I(1, 1));
  await idle(page);
  let L = await layers(page);
  ok('같은 색 2개 + 다른 색 → 안 터짐', L[I(2, 1)] === 'red' && L[I(2, 2)] === 'red');

  await setBoard(page, { '2,1': ['red', 'pink'], '2,2': ['red', 'yellow'] }, [['red']]);
  await tap(page, I(2, 3));
  await idle(page);
  L = await layers(page);
  ok('[red,pink][red,yellow][red] → 분홍·노랑·빈칸', L[I(2, 1)] === 'pink' && L[I(2, 2)] === 'yellow' && L[I(2, 3)] === '', L.slice(10, 15));
  const domInner = await page.locator(`[data-cell="${I(2, 1)}"] .flower`).getAttribute('data-outer');
  ok('화면에도 분홍이 남음', domInner === 'pink');

  const s0 = await page.evaluate(() => window.__fg.state().score);
  await setBoard(page, { '2,1': ['red', 'pink'], '2,2': ['red', 'pink'] }, [['red', 'pink']], { score: 0, levelPopped: 0 });
  await tap(page, I(2, 3));
  await page.waitForTimeout(450);
  await page.screenshot({ path: OUT + 'e2e-chain-mid.png' });
  await idle(page);
  L = await layers(page);
  const st = await page.evaluate(() => window.__fg.state());
  ok('[red,pink]×3 → 빨강 뒤 분홍 연쇄로 모두 비움', [I(2, 1), I(2, 2), I(2, 3)].every((i) => L[i] === ''), L.slice(10, 15));
  ok('연쇄 점수 30+45=75, 꽃 6송이', st.score === 75 && st.levelPopped === 6 && st.bestChain >= 2, { score: st.score, p: st.levelPopped, s0 });
  const hudScore = await page.locator('.hud-score b').textContent();
  ok('화면 점수 = 상태 점수', hudScore === '75', hudScore);
  await ctx.close();
}

/* ---------- 3. 팝 색: 빨강은 빨강, 노랑은 노랑 (분홍으로 터지면 불합격) ---------- */
{
  const ctx = await browser.newContext({ ...phone, deviceScaleFactor: 1 });
  const page = await open(ctx);
  const hueAt = async () =>
    page.evaluate(() => {
      const cv = document.querySelector('canvas.fx');
      const g = cv.getContext('2d');
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      const bins = {};
      let n = 0;
      for (let k = 0; k < d.length; k += 16) {
        if (d[k + 3] < 200) continue;
        const r = d[k] / 255, gg = d[k + 1] / 255, b = d[k + 2] / 255;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        const s = mx === 0 ? 0 : (mx - mn) / mx;
        if (s < 0.45 || mx < 0.35) continue; // 흰 반짝임·어두운 곳 제외
        let h;
        if (mx === r) h = ((gg - b) / (mx - mn) + 6) % 6;
        else if (mx === gg) h = (b - r) / (mx - mn) + 2;
        else h = (r - gg) / (mx - mn) + 4;
        h *= 60;
        const name = h < 15 || h >= 345 ? 'red' : h < 38 ? 'orange' : h < 70 ? 'yellow' : h < 170 ? 'green' : h < 250 ? 'blue' : h < 300 ? 'purple' : 'pink';
        bins[name] = (bins[name] || 0) + 1;
        n++;
      }
      return { bins, n };
    });
  const cases = [
    ['red', 'red'],
    ['yellow', 'yellow'],
    ['purple', 'purple'],
    ['blue', 'blue'],
  ];
  for (const [color, want] of cases) {
    await setBoard(page, { '2,1': [color], '2,2': [color] }, [[color]]);
    await page.evaluate(() => window.__fg.petalColors().length);
    await tap(page, I(2, 3));
    await page.waitForTimeout(420);
    const h = await hueAt();
    await page.screenshot({ path: OUT + `e2e-pop-${color}.png` });
    await idle(page);
    const petals = await page.evaluate(() => window.__fg.petalColors().slice(-10));
    const top = Object.entries(h.bins).sort((a, b) => b[1] - a[1])[0]?.[0];
    const pinkShare = (h.bins.pink || 0) / Math.max(1, h.n);
    ok(`${color} 팝: 꽃잎 파티클 색 = ${color}`, petals.length > 0 && petals.every((p) => p === color), petals);
    ok(`${color} 팝: 효과 캔버스 주된 색 = ${want}, 분홍 비율 낮음`, top === want && (color === 'pink' || pinkShare < 0.15), h);
  }
  await ctx.close();
}

/* ---------- 4. 연타 · 팝 중 입력 잠금 ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  await setBoard(page, { '2,1': ['red', 'pink'], '2,2': ['red', 'pink'] }, [['red', 'pink'], ['yellow'], ['yellow']]);
  const t0 = await page.evaluate(() => window.__fg.state().turn);
  await tap(page, I(2, 3));
  for (const i of [I(0, 2), I(1, 1), I(3, 2), I(4, 2), I(0, 2), I(1, 3)]) await tap(page, i);
  const mid = await page.evaluate(() => window.__fg.state().turn);
  ok('팝 재생 중 다른 칸 연타는 무시(턴 +1 만)', mid === t0 + 1, { t0, mid });
  await idle(page);
  // 같은 칸 두 번 빠르게
  await setBoard(page, {}, [['yellow'], ['pink']]);
  const t1 = await page.evaluate(() => window.__fg.state().turn);
  await page.evaluate(() => {
    const el = document.querySelector('[data-cell="12"]');
    const ev = () => new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' });
    el.dispatchEvent(ev());
    el.dispatchEvent(ev());
    document.querySelector('[data-cell="7"]').dispatchEvent(ev());
  });
  await idle(page);
  const t2 = await page.evaluate(() => window.__fg.state().turn);
  ok('같은 순간 세 번 탭 → 한 송이만 놓임', t2 === t1 + 1, { t1, t2 });
  // 이미 꽃 있는 칸
  await tap(page, I(2, 2));
  await idle(page);
  ok('이미 꽃 있는 칸 탭 → 변화 없음', (await page.evaluate(() => window.__fg.state().turn)) === t2);
  await ctx.close();
}

/* ---------- 5. 팝 도중 새로고침 · 화면 숨김 → 상태 정확히 복원 ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  await setBoard(page, { '2,1': ['red', 'pink'], '2,2': ['red', 'pink'], '0,2': ['yellow', 'purple'] }, [['red', 'pink']], { score: 10 });
  await tap(page, I(2, 3));
  await page.waitForTimeout(200);
  const committed = await page.evaluate(() => window.__fg.state());
  await page.goto(`${BASE}/?test=1`); // seed 없이 → 저장에서 복원
  await page.waitForFunction(() => window.__fg && window.__fgAssets);
  const restored = await page.evaluate(() => window.__fg.state());
  ok('팝 도중 새로고침 → 계산 끝난 상태로 복원', JSON.stringify(restored) === JSON.stringify(committed), { a: restored.score, b: committed.score });
  ok('복원 후 2겹 꽃 [yellow,purple] 그대로', restored.board[I(0, 2)].layers.join() === 'yellow,purple');
  const dom = await page.locator(`[data-cell="${I(0, 2)}"] .flower`).evaluate((el) => [el.dataset.outer, el.dataset.inner]);
  ok('복원 후 화면에도 2겹 표시', dom[0] === 'yellow' && dom[1] === 'purple', dom);

  // 화면 숨김(전화·잠금) 중 연출 → 즉시 끝내고 최종 상태 표시
  await setBoard(page, { '2,1': ['red', 'pink'], '2,2': ['red', 'yellow'], '1,2': ['purple'] }, [['red', 'blue']]);
  await tap(page, I(2, 3));
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(50);
  const busy = await page.evaluate(() => window.__fg.busy());
  const vis = await page.evaluate(() => [...document.querySelectorAll('[data-cell]')].map((e) => [Number(e.dataset.cell), e.querySelector('.flower')?.dataset.outer || '']));
  const st = await page.evaluate(() => window.__fg.state().board.map((c, i) => [i, c.layers[0] || '']).filter(([i]) => window.__fg.state().board[i].active));
  ok('화면 숨김 → 연출 즉시 종료, 입력 잠금 풀림', busy === false);
  ok('화면 숨김 → 보이는 보드 = 저장 상태', JSON.stringify(vis) === JSON.stringify(st), { vis, st });
  ok('오류 없음(5)', page.errors.length === 0, page.errors);
  await ctx.close();
}

/* ---------- 6. 단계 확장 13 → 21, 기존 꽃 보존 ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  await setBoard(page, { '0,2': ['yellow'], '1,1': ['red', 'pink'], '3,3': ['pink'], '2,2': ['red'], '2,3': ['red'] }, [['red']], { levelPopped: 19 });
  await tap(page, I(2, 4));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + 'e2e-levelup.png' });
  await idle(page);
  const st = await page.evaluate(() => window.__fg.state());
  ok('2단계 진입', st.level === 2);
  ok('활성 칸 21개(화면)', (await page.locator('.slot:not(.off)').count()) === 21);
  ok('기존 꽃 그대로', st.board[I(0, 2)].layers.join() === 'yellow' && st.board[I(1, 1)].layers.join() === 'red,pink' && st.board[I(3, 3)].layers.join() === 'pink');
  await tap(page, I(0, 1)); // 새로 열린 칸에 놓기
  await idle(page);
  ok('새로 열린 칸에 놓을 수 있음', (await page.evaluate(() => window.__fg.state().board[1].layers.length)) > 0);
  await ctx.close();
}

/* ---------- 7. 되돌리기 · 게임 끝 ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  const before = await page.evaluate(() => window.__fg.state());
  await tap(page, I(2, 2));
  await idle(page);
  await page.locator('.tool', { hasText: '되돌리기' }).click();
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.__fg.state());
  ok('되돌리기 → 보드·대기열 원래대로, 횟수 1 줄어듦', JSON.stringify(after.board) === JSON.stringify(before.board) && JSON.stringify(after.queue) === JSON.stringify(before.queue) && after.undoLeft === before.undoLeft - 1);

  const fill = {};
  const cols = ['red', 'yellow', 'pink'];
  let k = 0;
  for (const [r, c] of [[1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [4, 2]]) fill[`${r},${c}`] = [cols[k++ % 3]];
  await setBoard(page, fill, [['red']]);
  await tap(page, I(0, 2));
  await idle(page);
  await page.waitForTimeout(200);
  ok('빈 자리 없으면 끝 화면', await page.locator('.modal', { hasText: '정원이 가득 찼어요' }).isVisible());
  await page.screenshot({ path: OUT + 'e2e-gameover.png' });
  await page.locator('.btn', { hasText: '새 정원 가꾸기' }).click();
  ok('새 정원 → 빈 13칸', (await page.evaluate(() => window.__fg.state().board.filter((c) => c.layers.length).length)) === 0);
  await ctx.close();
}

/* ---------- 8. PWA: 매니페스트 · 서비스워커 · 오프라인 ----------
 * Playwright 의 setOffline 은 서비스워커가 답해야 할 페이지 이동까지 막아 버려서(알려진 제약),
 * 이 시험 전용 서버(4174)를 띄웠다가 '서버를 꺼 버린 뒤' 다시 여는 방식으로 오프라인을 만든다. */
{
  const { spawn } = await import('node:child_process');
  const root = new URL('../../', import.meta.url).pathname;
  const PWA = 'http://localhost:4174';
  const srv = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(PWA + '/')).ok) break;
    } catch {
      /* 아직 */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(`${PWA}/?test=1&seed=3`);
  const man = await page.evaluate(async () => {
    const l = document.querySelector('link[rel="manifest"]');
    if (!l) return null;
    return (await fetch(l.href)).json();
  });
  ok('매니페스트(이름·아이콘·standalone)', man && man.name === '꽃정원' && man.display === 'standalone' && man.icons.length >= 3, man);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined, null, { timeout: 10000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // 서비스워커가 이 페이지를 맡도록
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__fg && window.__fgAssets);
  const cached = await page.evaluate(async () => {
    let n = 0;
    for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length;
    return n;
  });
  ok('서비스워커가 파일을 캐시에 저장(20개 이상)', cached >= 20, cached);
  await tap(page, I(2, 2));
  await idle(page);
  const saved = await page.evaluate(() => window.__fg.state());
  process.kill(-srv.pid); // 서버 끄기 = 인터넷 끊김과 같은 상황
  await new Promise((r) => setTimeout(r, 500));
  let down = false;
  try {
    await fetch(PWA + '/');
  } catch {
    down = true;
  }
  ok('(확인) 시험 서버가 꺼짐', down);
  await page.goto(`${PWA}/?test=1`);
  await page.waitForFunction(() => window.__fg && window.__fgAssets, null, { timeout: 15000 });
  const off = await page.evaluate(() => ({ s: window.__fg.state(), a: window.__fgAssets }));
  ok('서버 없이(오프라인): 앱이 열림 + 그림 10개 로드', off.a.ok === 10, off.a);
  ok('서버 없이(오프라인): 기록 이어짐', JSON.stringify(off.s) === JSON.stringify(saved));
  await page.screenshot({ path: OUT + 'e2e-offline.png' });
  await ctx.close();
}

/* ---------- 10. 겹꽃: 안쪽 꽃이 바깥 꽃 컵 안에(동그란 테두리 없음) ---------- */
{
  const ctx = await browser.newContext({ ...phone, deviceScaleFactor: 2 });
  const page = await open(ctx);
  await setBoard(page, { '2,2': ['red', 'pink'], '2,1': ['yellow', 'purple'], '2,3': ['blue', 'orange'] }, [['pink']]);
  const geo = await page.evaluate(() => {
    const el = document.querySelector('[data-cell="12"]');
    const box = el.querySelector('.fl-box').getBoundingClientRect();
    const imgs = [...el.querySelectorAll('.fl-box img')].map((i) => ({ cls: i.className, ok: i.complete && i.naturalWidth === 512, r: i.getBoundingClientRect() }));
    return { box: { x: box.x, y: box.y, w: box.width, h: box.height }, imgs, badge: !!el.querySelector('.inner-badge') };
  });
  ok('겹꽃은 그림 3장(바깥·안쪽·앞 꽃잎) 순서', geo.imgs.map((i) => i.cls).join() === 'outer,inner,front', geo.imgs.map((i) => i.cls));
  ok('세 장 모두 로드', geo.imgs.every((i) => i.ok));
  ok('동그란 테두리(badge) 없음', !geo.badge);
  const inn = geo.imgs[1].r;
  const cx = (inn.x + inn.width / 2 - geo.box.x) / geo.box.w, cy = (inn.y + inn.height / 2 - geo.box.y) / geo.box.h;
  ok('안쪽 꽃은 바깥 꽃의 수술 자리(가운데 위쪽)에 0.6~0.7배', Math.abs(cx - 0.5) < 0.05 && cy > 0.28 && cy < 0.42 && inn.width / geo.box.w > 0.6 && inn.width / geo.box.w < 0.7, { cx, cy, s: inn.width / geo.box.w });
  await page.locator('.board').screenshot({ path: OUT + 'e2e-nested.png' });
  // 겹꽃 바깥만 터지고 안쪽이 컵 자리에서 제 크기로 피어남(재생 끝나면 transform 없음)
  await setBoard(page, { '1,2': ['pink'], '3,2': ['pink'], '2,2': [] , '2,1': ['yellow', 'purple'], '2,3': ['blue', 'orange']}, [['pink', 'red']]);
  await tap(page, 12);
  await idle(page);
  const t = await page.locator('[data-cell="12"] .flower').evaluate((e) => [e.dataset.outer, getComputedStyle(e).transform]);
  ok('분홍 3개 세로 → 가운데 칸에 안쪽 빨강이 제 크기로 남음', t[0] === 'red' && (t[1] === 'none' || t[1] === 'matrix(1, 0, 0, 1, 0, 0)'), t);
  await ctx.close();
}

/* ---------- 11. 효과음: 실제 파일(CC0)로 재생 ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await open(ctx);
  await setBoard(page, { '2,1': ['red'], '2,2': ['red'] }, [['red']]);
  await tap(page, I(2, 3)); // 첫 탭에서 소리 켜짐 + 파일 불러오기
  await idle(page);
  const n = await page.evaluate(() => window.__fg.soundsReady());
  ok('효과음 파일 14개 해독 성공', n === 14, n);
  await setBoard(page, { '2,1': ['red', 'pink'], '2,2': ['red', 'pink'] }, [['red', 'pink']]);
  await tap(page, I(2, 3));
  await idle(page);
  await page.locator('.tool', { hasText: '되돌리기' }).click();
  await page.locator('.tool', { hasText: '설정' }).click();
  await page.locator('.toggle', { hasText: '큰 글씨' }).click();
  await page.locator('.btn', { hasText: '닫기' }).click();
  await tap(page, I(2, 1)); // 이미 꽃 있는 칸
  const log = await page.evaluate(() => window.__fg.sounds());
  for (const name of ['place', 'bloom', 'chain', 'sparkle', 'undo', 'open', 'toggle-on', 'close', 'blocked']) ok(`소리 '${name}' 파일로 재생`, log.includes(name), log);
  ok('합성음으로 대신한 적 없음', !log.some((x) => x.startsWith('synth:')), log);
  // 소리 끄기 → 이후 아무 소리 없음
  await page.locator('.tool', { hasText: '설정' }).click();
  await page.locator('.toggle', { hasText: '소리' }).first().click();
  await page.locator('.btn', { hasText: '닫기' }).click();
  const before = (await page.evaluate(() => window.__fg.sounds())).length;
  await setBoard(page, { '2,1': ['red'], '2,2': ['red'] }, [['red']]);
  await tap(page, I(2, 3));
  await idle(page);
  const after = (await page.evaluate(() => window.__fg.sounds())).length;
  ok('소리 끄면 재생 안 함', after === before, { before, after });
  await ctx.close();
}

/* ---------- 9. 외부 요청 없음(광고·추적 없음) ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const hosts = new Set();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  await page.goto(`${BASE}/?test=1&seed=5`);
  await page.waitForFunction(() => window.__fg && window.__fgAssets);
  await tap(page, I(2, 2));
  await idle(page);
  const local = new URL(BASE).host;
  ok('외부 서버로 나가는 요청 없음', [...hosts].every((h) => h === local), [...hosts]);
  await ctx.close();
}

await browser.close();
console.log(bad ? `\n실패 ${bad}개` : '\n모두 통과');
process.exit(bad ? 1 : 0);
