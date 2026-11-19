/**
 * 효과음.
 * 소리 파일: npm 패키지 uisfx 0.4.0 의 CC0(퍼블릭 도메인) 음원 — public/assets/sfx/ (출처·라이선스: LICENSE-AUDIO.txt, SOUNDS.md)
 *   꽃정원 분위기에 맞춰 'dreamy'(꽃이 피는 부드러운 반짝임) · 'soft'(펠트처럼 둥근 소리) · 'glass'(반짝임) 묶음에서 골랐다.
 * 파일을 아직 못 불러왔거나 해독에 실패하면 WebAudio 합성음으로 대신한다(소리 실패는 게임에 영향 없음).
 */
const BASE = import.meta.env.BASE_URL;

export const SOUND_FILES = {
  place: 0.5, // soft/drop — 꽃 놓기
  bloom: 0.6, // dreamy/success — 3송이 개화
  'bloom-big': 0.6, // dreamy/bonus — 4송이 이상 개화
  chain: 0.6, // dreamy/streak — 연쇄(연쇄마다 음 높임)
  sparkle: 0.3, // glass/reaction — 꽃잎 흩날림 반짝
  levelup: 0.7, // dreamy/level-up — 단계 올라감
  gameover: 0.6, // dreamy/sleep — 정원이 가득 참
  undo: 0.5, // soft/undo — 되돌리기
  blocked: 0.35, // soft/blocked — 이미 꽃이 있는 칸
  open: 0.4, // soft/open — 창 열기
  close: 0.4, // soft/close — 창 닫기
  'toggle-on': 0.45, // soft/toggle-on — 설정 켬
  'toggle-off': 0.45, // soft/toggle-off — 설정 끔
  start: 0.55, // dreamy/start — 새 게임
} as const;
export type SoundName = keyof typeof SOUND_FILES;
export const soundUrl = (n: SoundName) => `${BASE}assets/sfx/${n}.mp3`;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
const buffers = new Map<SoundName, AudioBuffer>();
let loading: Promise<void> | null = null;
/** 시험용: 지금까지 재생한 소리 이름(파일인지 합성인지) */
export const playLog: string[] = [];

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function decode(c: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // 옛 Safari 는 콜백 방식만 지원
  return new Promise((ok, fail) => {
    const p = c.decodeAudioData(data, ok, fail);
    if (p && typeof p.then === 'function') p.then(ok, fail);
  });
}

function loadAll(c: AudioContext) {
  if (loading) return loading;
  loading = Promise.all(
    (Object.keys(SOUND_FILES) as SoundName[]).map(async (n) => {
      try {
        const res = await fetch(soundUrl(n));
        if (!res.ok) return;
        buffers.set(n, await decode(c, await res.arrayBuffer()));
      } catch {
        /* 합성음으로 대신 */
      }
    }),
  ).then(() => undefined);
  return loading;
}

/** 앱을 열 때 호출: 소리 장치를 만들고(아직 잠김) 파일을 미리 해독해 둔다 → 첫 탭부터 파일 소리 */
export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      void loadAll(ctx);
    }
  } catch {
    ctx = null;
  }
}

/** 첫 터치 때 호출(모바일은 사용자 동작 안에서만 소리를 켤 수 있음) */
export function unlockAudio() {
  initAudio();
  try {
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* 무시 */
  }
}

/** 시험용: 소리 파일을 모두 불러왔는지 */
export async function soundsReady(): Promise<number> {
  if (loading) await loading;
  return buffers.size;
}

const ready = () => enabled && !!ctx && !!master && ctx.state !== 'closed';
/** 잠겨 있으면(첫 탭 직후) 깨운 다음 재생 */
function whenRunning(f: () => void) {
  if (!ctx) return;
  if (ctx.state === 'running') f();
  else
    ctx
      .resume()
      .then(() => {
        if (ctx && ctx.state === 'running') f();
      })
      .catch(() => {});
}

function playFile(n: SoundName, opts: { rate?: number; vol?: number; when?: number } = {}): boolean {
  if (!ready()) return false;
  const buf = buffers.get(n);
  if (!buf) return false;
  whenRunning(() => {
    try {
      const src = ctx!.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate ?? 1;
      const g = ctx!.createGain();
      g.gain.value = SOUND_FILES[n] * (opts.vol ?? 1);
      src.connect(g).connect(master!);
      src.start(ctx!.currentTime + (opts.when ?? 0));
      playLog.push(n);
      if (playLog.length > 50) playLog.shift();
    } catch {
      /* 무시 */
    }
  });
  return true;
}

/* ---------- 합성음(대신 쓰는 소리) ---------- */
function tone(freq: number, dur: number, when = 0, type: OscillatorType = 'sine', vol = 0.18, glideTo?: number) {
  if (!ready()) return;
  try {
    const t = ctx!.currentTime + when;
    const o = ctx!.createOscillator();
    const gn = ctx!.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* 무시 */
  }
}
function synth(name: string, f: () => void) {
  if (!ready()) return;
  whenRunning(() => {
    f();
    playLog.push('synth:' + name);
  });
}

/* ---------- 게임에서 부르는 소리 ---------- */

/** 꽃 놓기 */
export function sfxPlace() {
  if (!playFile('place')) synth('place', () => tone(520, 0.09, 0, 'sine', 0.12, 380));
}

/** 꽃 터짐: 1연쇄는 개화음(4송이 이상은 더 화려하게), 2연쇄부터는 연쇄음을 반음씩 높여 */
export function sfxPop(chain: number, size: number) {
  const semis = Math.min(chain - 1, 6) * 2;
  const rate = Math.pow(2, semis / 12);
  const name: SoundName = chain >= 2 ? 'chain' : size >= 4 ? 'bloom-big' : 'bloom';
  if (playFile(name, { rate })) return;
  synth('pop', () => {
    const base = 523.25 * rate;
    [0, 4, 7, size >= 4 ? 12 : -1]
      .filter((n) => n >= 0)
      .forEach((n, i) => {
        const f = base * Math.pow(2, n / 12);
        tone(f, 0.32, i * 0.055, 'sine', 0.16);
        tone(f * 2, 0.18, i * 0.055, 'triangle', 0.04);
      });
  });
}

/** 꽃잎 흩날림 반짝 */
export function sfxSparkle(chain = 1) {
  if (playFile('sparkle', { rate: 1 + Math.min(chain - 1, 4) * 0.06 })) return;
  synth('sparkle', () => {
    for (let i = 0; i < 3; i++) tone(1800 + Math.random() * 1400, 0.08, 0.02 + i * 0.05, 'sine', 0.05);
  });
}

export function sfxLevelUp() {
  if (!playFile('levelup')) synth('levelup', () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, i * 0.09, 'triangle', 0.14)));
}

export function sfxGameOver() {
  if (!playFile('gameover')) synth('gameover', () => [523, 440, 392, 330].forEach((f, i) => tone(f, 0.3, i * 0.14, 'sine', 0.12)));
}

export function sfxDeny() {
  if (!playFile('blocked')) synth('blocked', () => tone(220, 0.08, 0, 'sine', 0.06));
}

export function sfxUndo() {
  if (!playFile('undo')) synth('undo', () => tone(660, 0.12, 0, 'sine', 0.1, 440));
}

export function sfxOpen() {
  if (!playFile('open')) synth('open', () => tone(600, 0.07, 0, 'sine', 0.06, 760));
}

export function sfxClose() {
  if (!playFile('close')) synth('close', () => tone(700, 0.07, 0, 'sine', 0.06, 540));
}

export function sfxToggle(on: boolean) {
  if (!playFile(on ? 'toggle-on' : 'toggle-off')) synth('toggle', () => tone(on ? 760 : 520, 0.06, 0, 'sine', 0.07));
}

export function sfxStart() {
  if (!playFile('start')) synth('start', () => [392, 523, 659].forEach((f, i) => tone(f, 0.18, i * 0.07, 'sine', 0.1)));
}
