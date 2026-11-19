/**
 * server/leaderboard.gs 를 Node 에서 가짜 SpreadsheetApp 등으로 돌려 보는 시험
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function load() {
  const rows: unknown[][] = [];
  const cache = new Map<string, string>();
  const sheet = {
    appendRow: (r: unknown[]) => void rows.push(r),
    getLastRow: () => rows.length,
    getRange: (r: number, _c: number, n: number) => ({ getValues: () => rows.slice(r - 1, r - 1 + n) }),
  };
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (rows.length ? sheet : null), insertSheet: () => sheet }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s: string) => ({ s, setMimeType() { return this; } }) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => void cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };
  const src = readFileSync(new URL('../../server/leaderboard.gs', import.meta.url), 'utf8');
  const api = new Function(...Object.keys(g), src + '\nreturn { doGet, doPost, cleanName_ };')(...Object.values(g));
  const post = (d: object) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(d) } }).s);
  const get = (p: object = {}) => JSON.parse(api.doGet({ parameter: p }).s);
  return { rows, cache, post, get, api };
}
const rec = (o: object = {}) => ({ name: '엄마', score: 300, level: 2, popped: 30, turns: 40, device: 'dev-aaaaaaaa', ...o });

describe('순위 서버', () => {
  it('기록을 올리면 순위와 목록을 돌려준다', () => {
    const s = load();
    const r = s.post(rec());
    expect(r.ok).toBe(true);
    expect(r.rank).toBe(1);
    expect(r.top).toEqual([{ name: '엄마', score: 300, level: 2, mine: true }]);
    expect(s.rows[0][1]).toBe('이름'); // 제목 줄
    expect(s.rows[1][1]).toBe('엄마');
  });

  it('기기+이름마다 최고 점수만, 높은 순서', () => {
    const s = load();
    s.post(rec({ score: 300 }));
    s.cache.clear();
    s.post(rec({ score: 200 })); // 같은 사람 낮은 점수 → 순위엔 300
    s.post(rec({ name: '영희', score: 500, device: 'dev-bbbbbbbb' }));
    s.post(rec({ name: '철수', score: 100, device: 'dev-cccccccc' }));
    const r = s.get({ device: 'dev-aaaaaaaa', name: '엄마' });
    expect(r.total).toBe(3);
    expect(r.top.map((e: { name: string; score: number }) => [e.name, e.score])).toEqual([
      ['영희', 500],
      ['엄마', 300],
      ['철수', 100],
    ]);
    expect(r.rank).toBe(2);
    expect(r.top[1].mine).toBe(true);
    expect(r.top[0].mine).toBe(false);
  });

  it('같은 기기 연속 전송은 잠시 막음', () => {
    const s = load();
    expect(s.post(rec()).ok).toBe(true);
    expect(s.post(rec({ score: 400 })).ok).toBe(false);
  });

  it('이름 다듬기: 10자, 꺾쇠·제어문자 제거, 수식 방지', () => {
    const s = load();
    expect(s.api.cleanName_('  <b>꽃 \n 할머니</b> ')).toBe('b꽃 할머니/b');
    expect(s.api.cleanName_('가나다라마바사아자차카타')).toBe('가나다라마바사아자차');
    s.post(rec({ name: '=HYPERLINK("x")' }));
    expect(s.rows[1][1]).toBe("'=HYPERLINK"); // 10자로 자른 뒤 앞에 ' → 시트가 수식으로 안 읽음
    expect(s.get().top[0].name).toBe('=HYPERLINK');
  });

  it('이상한 기록은 거절', () => {
    const s = load();
    expect(s.post(rec({ name: '   ' })).ok).toBe(false);
    expect(s.post(rec({ device: 'x' })).ok).toBe(false);
    expect(s.post(rec({ score: 99999, popped: 10 })).ok).toBe(false); // 꽃 10송이로 99999점 불가
    expect(s.post(rec({ score: 1.5 })).ok).toBe(false);
    expect(s.post(rec({ popped: 5000, turns: 10, score: 100 })).ok).toBe(false);
    expect(s.rows).toHaveLength(0);
  });

  it('기록이 없을 때도 빈 목록', () => {
    const s = load();
    expect(s.get()).toEqual({ ok: true, total: 0, top: [], rank: null });
  });
});
