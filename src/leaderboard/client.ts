/**
 * 순위: 서버(구글 시트)와 이 기기 기록.
 * - 이름·기기 번호는 이 기기에 저장 → 다음부터 다시 안 써도 됨
 * - 보내지 못한 기록은 모아 두었다가 인터넷이 되면 다시 보냄
 */
import { LEADERBOARD_URL } from './config';

export interface Entry {
  name: string;
  score: number;
  level: number;
  mine?: boolean;
}
export interface BoardResult {
  online: boolean; // 서버 순위인지(아니면 이 기기 기록)
  top: Entry[];
  rank: number | null;
  total: number;
  pending: boolean; // 아직 못 보낸 기록이 있음
  error?: string;
}
export interface ScoreRecord {
  name: string;
  score: number;
  level: number;
  popped: number;
  turns: number;
}

const NAME_KEY = 'flowerGarden.playerName.v1';
const DEVICE_KEY = 'flowerGarden.device.v1';
const LOCAL_KEY = 'flowerGarden.localBoard.v1';
const PENDING_KEY = 'flowerGarden.pendingScores.v1';
const CACHE_KEY = 'flowerGarden.boardCache.v1';
export const NAME_MAX = 10;

let url = LEADERBOARD_URL;
/** 시험용: 서버 주소 바꾸기 */
export function setLeaderboardUrl(u: string) {
  url = u;
}
export const hasServer = () => !!url;

function get(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 사생활 모드 등 */
  }
}
function getJSON<T>(k: string, fallback: T): T {
  try {
    const v = JSON.parse(get(k) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function cleanName(s: string): string {
  return Array.from(
    String(s || '')
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, NAME_MAX)
    .join('');
}
export function getSavedName(): string {
  return cleanName(get(NAME_KEY) || '');
}
export function saveName(n: string) {
  const c = cleanName(n);
  if (c) set(NAME_KEY, c);
}

export function getDeviceId(): string {
  let id = get(DEVICE_KEY);
  if (!id || !/^[a-z0-9-]{8,40}$/.test(id)) {
    let r = '';
    try {
      r = crypto.randomUUID().toLowerCase();
    } catch {
      r = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    id = 'd-' + r.replace(/[^a-z0-9-]/g, '').slice(0, 36);
    set(DEVICE_KEY, id);
  }
  return id;
}

/* ---------- 이 기기 기록 ---------- */
interface LocalRec extends Entry {
  t: number;
}
function localBoard(): LocalRec[] {
  return getJSON<LocalRec[]>(LOCAL_KEY, []).filter((e) => e && typeof e.score === 'number' && typeof e.name === 'string');
}
function addLocal(r: ScoreRecord) {
  const list = localBoard();
  list.push({ name: r.name, score: r.score, level: r.level, t: Date.now() });
  list.sort((a, b) => b.score - a.score || a.t - b.t);
  set(LOCAL_KEY, JSON.stringify(list.slice(0, 20)));
}
function localResult(highlight?: ScoreRecord, error?: string): BoardResult {
  const list = localBoard();
  let rank: number | null = null;
  const top = list.map((e, i) => {
    const mine = !!highlight && rank === null && e.score === highlight.score && e.name === highlight.name;
    if (mine) rank = i + 1;
    return { name: e.name, score: e.score, level: e.level, mine };
  });
  return { online: false, top, rank, total: list.length, pending: pendingList().length > 0, error };
}

/* ---------- 서버 ---------- */
interface Pending extends ScoreRecord {
  device: string;
}
function pendingList(): Pending[] {
  return getJSON<Pending[]>(PENDING_KEY, []);
}
function setPending(p: Pending[]) {
  set(PENDING_KEY, JSON.stringify(p.slice(-10)));
}

async function call(method: 'GET' | 'POST', body?: object, params?: Record<string, string>): Promise<{ ok: boolean; top?: Entry[]; rank?: number | null; total?: number; msg?: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await fetch(url + q, {
      method,
      // text/plain → 브라우저가 사전 확인(preflight) 없이 바로 보냄(Apps Script 는 OPTIONS 를 못 받음)
      headers: method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      redirect: 'follow',
      cache: 'no-store',
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function serverResult(r: { top?: Entry[]; rank?: number | null; total?: number }): BoardResult {
  const out: BoardResult = { online: true, top: r.top || [], rank: r.rank ?? null, total: r.total || 0, pending: pendingList().length > 0 };
  set(CACHE_KEY, JSON.stringify(out));
  return out;
}

/** 못 보낸 기록 다시 보내기 (앱 시작·인터넷 연결 때) */
export async function flushPending(): Promise<void> {
  if (!url) return;
  const list = pendingList();
  if (!list.length) return;
  const left: Pending[] = [];
  for (const p of list) {
    try {
      const r = await call('POST', p);
      if (!r.ok && /잠시/.test(r.msg || '')) left.push(p); // 너무 빨라서 거절 → 나중에
    } catch {
      left.push(p);
    }
  }
  setPending(left);
}

/** 게임 끝 기록 올리기 */
export async function submitScore(r: ScoreRecord): Promise<BoardResult> {
  const rec = { ...r, name: cleanName(r.name) };
  addLocal(rec);
  if (!url) return localResult(rec);
  const p: Pending = { ...rec, device: getDeviceId() };
  try {
    const res = await call('POST', p);
    if (res.ok) return serverResult(res);
    if (/잠시/.test(res.msg || '')) setPending([...pendingList(), p]);
    return { ...localResult(rec, res.msg), pending: pendingList().length > 0 };
  } catch {
    setPending([...pendingList(), p]);
    const cached = getJSON<BoardResult | null>(CACHE_KEY, null);
    if (cached) return { ...cached, rank: null, pending: true, error: '인터넷이 연결되면 순위에 올라가요' };
    return { ...localResult(rec, '인터넷이 연결되면 순위에 올라가요'), pending: true };
  }
}

/** 순위 보기 */
export async function fetchBoard(): Promise<BoardResult> {
  if (!url) return localResult();
  try {
    await flushPending();
    const name = getSavedName();
    const res = await call('GET', undefined, name ? { device: getDeviceId(), name } : undefined);
    if (res.ok) return serverResult(res);
    return localResult(undefined, res.msg);
  } catch {
    const cached = getJSON<BoardResult | null>(CACHE_KEY, null);
    if (cached) return { ...cached, error: '인터넷이 안 돼서 지난번 순위를 보여 드려요' };
    return localResult(undefined, '인터넷이 안 돼서 이 기기 기록만 보여 드려요');
  }
}

/** 같은 판을 두 번 올리지 않게 */
const SENT_KEY = 'flowerGarden.sentGames.v1';
export function alreadySent(gameKey: string): boolean {
  return getJSON<string[]>(SENT_KEY, []).includes(gameKey);
}
export function markSent(gameKey: string) {
  set(SENT_KEY, JSON.stringify([...getJSON<string[]>(SENT_KEY, []), gameKey].slice(-30)));
}
