import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initAudio,
  playLog,
  setSoundEnabled,
  sfxClose,
  sfxDeny,
  sfxGameOver,
  sfxLevelUp,
  sfxOpen,
  sfxPlace,
  sfxPop,
  sfxSparkle,
  sfxStart,
  sfxToggle,
  sfxUndo,
  soundsReady,
  unlockAudio,
} from './audio/sfx';
import { flowerUrl, preloadAll, warmTints } from './fx/assets';
import { flushPending, setLeaderboardUrl } from './leaderboard/client';
import { IconGear, IconHelp, IconTrophy, IconUndo, LeafDeco } from './ui/Icons';
import { PopFx } from './fx/PopFx';
import { FX_TIMING } from './game/config';
import { canUndo, newGame, resolveTurn, undo } from './game/engine';
import { levelConfig } from './game/levels';
import { randomSeed } from './game/rng';
import { loadBest, loadGame, loadSettings, saveBest, saveGame, saveSettings, type Settings } from './game/save';
import { ALL_COLORS, type GameState, type TurnResult } from './game/types';
import { Board, type BoardView } from './ui/Board';
import { Queue } from './ui/Queue';
import { GameOverModal, HelpModal, RankModal, SettingsModal } from './ui/Modals';

const TEST_MODE = new URLSearchParams(location.search).has('test');
// 시험 때만: ?test=1&lb=<가짜 순위 서버 주소>
if (TEST_MODE) {
  // 시험은 진짜 순위 시트에 절대 기록하지 않는다: 가짜 주소(lb)를 줄 때만 그 주소, 아니면 서버 없음
  setLeaderboardUrl(new URLSearchParams(location.search).get('lb') ?? '');
}
const HELP_SEEN_KEY = 'flowerGarden.helpSeen.v1';

interface Hud {
  level: number;
  score: number;
  levelPopped: number;
}
interface Float {
  id: number;
  x: number;
  y: number;
  text: string;
}
interface Banner {
  id: number;
  text: string;
  sub?: string;
  kind: 'chain' | 'level';
}

const viewOf = (s: GameState, stepKey = 0): BoardView => ({
  board: s.board,
  react: new Set(),
  reveal: new Map(),
  fresh: null,
  opened: new Set(),
  stepKey,
});
const hudOf = (s: GameState): Hud => ({ level: s.level, score: s.score, levelPopped: s.levelPopped });

function initialState(): { state: GameState; notice: string } {
  const seedParam = new URLSearchParams(location.search).get('seed');
  const r = loadGame();
  if (r.state && !(TEST_MODE && seedParam)) {
    return { state: r.state, notice: r.source === 'backup' ? '저장 일부가 손상되어 바로 전 기록으로 이어 합니다.' : '' };
  }
  const seed = seedParam ? Number(seedParam) >>> 0 : randomSeed();
  return { state: newGame(seed), notice: r.corrupted ? '저장이 손상되어 새로 시작합니다.' : '' };
}

export default function App() {
  const [boot] = useState(initialState);
  const [game, setGame] = useState<GameState>(boot.state);
  const [view, setView] = useState<BoardView>(() => viewOf(boot.state));
  const [hud, setHud] = useState<Hud>(() => hudOf(boot.state));
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [best, setBest] = useState(loadBest);
  const [modal, setModal] = useState<'none' | 'help' | 'settings' | 'rank'>('none');
  const [firstHelp, setFirstHelp] = useState(false);
  const [showOver, setShowOver] = useState(boot.state.over);
  const [toast, setToast] = useState(boot.notice);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [floats, setFloats] = useState<Float[]>([]);

  const gameRef = useRef(game);
  const busyRef = useRef(false);
  const tokenRef = useRef(0);
  const settingsRef = useRef(settings);
  const boardRef = useRef<HTMLDivElement>(null);
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<PopFx | null>(null);
  const seq = useRef(0);
  settingsRef.current = settings;

  /* ---------- 준비 ---------- */
  useEffect(() => {
    if (fxCanvas.current) fxRef.current = new PopFx(fxCanvas.current);
    const onResize = () => fxRef.current?.resize();
    window.addEventListener('resize', onResize);
    let alive = true;
    initAudio(); // 효과음 파일 미리 해독(소리는 첫 탭 때 켜짐)
    preloadAll().then((r) => {
      if (!alive) return;
      (window as unknown as { __fgAssets?: unknown }).__fgAssets = r;
      setReady(true);
      warmTints(ALL_COLORS);
    });
    try {
      if (!TEST_MODE && !localStorage.getItem(HELP_SEEN_KEY)) {
        setFirstHelp(true);
        setModal('help');
      }
    } catch {
      /* 무시 */
    }
    // 못 보낸 순위 기록: 시작할 때와 인터넷이 다시 될 때 보내기
    const onOnline = () => void flushPending();
    window.addEventListener('online', onOnline);
    void flushPending();
    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    setSoundEnabled(settings.sound);
    saveSettings(settings);
    document.documentElement.classList.toggle('big-text', settings.bigText);
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- 상태 확정(먼저 저장, 연출은 나중) ---------- */
  const commit = useCallback((s: GameState) => {
    gameRef.current = s;
    setGame(s);
    saveGame(s);
    if (s.score > loadBest()) {
      saveBest(s.score);
      setBest(s.score);
    }
  }, []);

  const lock = (on: boolean) => {
    busyRef.current = on;
    setBusy(on);
  };

  /** 연출을 즉시 끝내고 확정된 상태를 보여 준다 */
  const finishNow = useCallback(() => {
    tokenRef.current++;
    fxRef.current?.clear();
    const s = gameRef.current;
    setView(viewOf(s, ++seq.current));
    setHud(hudOf(s));
    setBanner(null);
    setFloats([]);
    setShowOver(s.over);
    lock(false);
  }, []);

  /* 화면을 떠나면(전화·잠금·앱 전환) 남은 연출을 건너뛴다. 상태는 이미 저장됨 */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        saveGame(gameRef.current);
        if (busyRef.current) finishNow();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [finishNow]);

  const cellCenter = (i: number) => {
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-cell="${i}"]`);
    if (!el) return { x: 0, y: 0, size: 0 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
  };

  /* ---------- 한 턴 재생 ---------- */
  const play = useCallback(async (res: TurnResult, before: GameState) => {
    const token = ++tokenRef.current;
    const alive = () => token === tokenRef.current;
    const wait = (ms: number) => new Promise<boolean>((ok) => setTimeout(() => ok(alive()), ms));
    lock(true);

    let hudNow = hudOf(before);
    setShowOver(false);
    setView({ ...viewOf(before, ++seq.current), board: res.boardAfterPlace, fresh: res.placedAt });
    sfxPlace();
    if (!(await wait(170))) return;

    for (const step of res.steps) {
      const reduced = settingsRef.current.reduceFx;
      const sc =
        Math.max(FX_TIMING.minSpeed, Math.pow(FX_TIMING.chainSpeedup, step.chain - 1)) * (reduced ? FX_TIMING.reducedScale : 1);
      const key = ++seq.current;
      if (step.chain >= 2) setBanner({ id: key, text: `${step.chain}연쇄!`, sub: step.chain >= 3 ? '정말 멋져요!' : '좋아요!', kind: 'chain' });

      // 0ms: 맞은 꽃 반응 + 캔버스 연출 시작
      setView((v) => ({ ...v, react: new Set(step.cells), fresh: null, reveal: new Map(), stepKey: key }));
      const t0 = performance.now();
      for (const grp of step.groups) {
        const pts = grp.cells.map(cellCenter);
        fxRef.current?.addBloom({ color: grp.color, cells: pts, cell: pts[0]?.size || 60, scale: sc, reduced, t0 });
      }
      if (!(await wait(FX_TIMING.react * sc))) return;

      // 120ms: 표면층 사라짐(보드는 엔진이 계산한 단계 결과 그대로), 안쪽 꽃은 650ms 에 커짐
      sfxPop(step.chain, step.cells.length);
      const reveal = new Map<number, number>();
      for (const c of step.cells) if (step.revealed[c]) reveal.set(c, (FX_TIMING.scatterEnd - FX_TIMING.react) * sc);
      hudNow = { ...hudNow, score: hudNow.score + step.gain, levelPopped: hudNow.levelPopped + step.cells.length };
      setHud(hudNow);
      setView((v) => ({ ...v, board: step.boardAfter, react: new Set(), reveal, stepKey: key }));
      const br = boardRef.current?.getBoundingClientRect();
      if (br) {
        const pts = step.cells.map(cellCenter);
        const fx = pts.reduce((a, p) => a + p.x, 0) / pts.length - br.left;
        const fy = pts.reduce((a, p) => a + p.y, 0) / pts.length - br.top;
        setFloats((f) => [...f.slice(-4), { id: key, x: fx, y: fy, text: `+${step.gain}` }]);
      }
      if (!(await wait((FX_TIMING.bloomEnd - FX_TIMING.react) * sc))) return;
      sfxSparkle(step.chain);
      // 다음 연쇄는 잔광이 끝나기 조금 전에 이어서 시작(늘어지지 않게)
      if (!(await wait((FX_TIMING.fadeEnd - FX_TIMING.bloomEnd - 60) * sc))) return;
    }

    const s = gameRef.current;
    setHud(hudOf(s));
    if (res.levelUp) {
      const key = ++seq.current;
      const cfg = levelConfig(res.levelUp.to);
      const newColor = cfg.colors.length > levelConfig(res.levelUp.from).colors.length;
      setBanner({
        id: key,
        text: `${res.levelUp.to}단계!`,
        sub: res.levelUp.newCells.length ? '정원이 넓어졌어요' : newColor ? '새 꽃이 피기 시작해요' : '잘하셨어요',
        kind: 'level',
      });
      setView({ ...viewOf(s, key), opened: new Set(res.levelUp.newCells) });
      sfxLevelUp();
      if (!(await wait(1300))) return;
    } else {
      setView((v) => ({ ...viewOf(s, v.stepKey), reveal: v.reveal }));
    }
    if (s.over) {
      sfxGameOver();
      setShowOver(true);
    }
    lock(false);
  }, []);

  /* ---------- 입력 ---------- */
  const onTap = useCallback(
    (i: number) => {
      unlockAudio();
      if (busyRef.current || !ready || modal !== 'none') return;
      const before = gameRef.current;
      if (before.over) return;
      const res = resolveTurn(before, i);
      if (!res.ok) {
        if (res.reason === 'occupied-or-inactive' && before.board[i]?.active) sfxDeny();
        return;
      }
      busyRef.current = true; // 같은 프레임의 두 번째 탭도 막는다
      commit(res.state);
      void play(res, before);
    },
    [commit, play, ready, modal],
  );

  const onUndo = () => {
    unlockAudio();
    if (busyRef.current || !canUndo(gameRef.current)) return;
    commit(undo(gameRef.current));
    finishNow();
    sfxUndo();
  };

  const onNewGame = () => {
    unlockAudio();
    sfxStart();
    commit(newGame());
    finishNow();
    setModal('none');
  };

  const openModal = (m: 'help' | 'settings' | 'rank') => {
    unlockAudio();
    sfxOpen();
    setModal(m);
  };
  const closeModal = () => {
    sfxClose();
    setModal('none');
  };
  const changeSettings = (next: Settings) => {
    unlockAudio();
    const flipped = (Object.keys(next) as (keyof Settings)[]).find((k) => next[k] !== settings[k]);
    if (flipped === 'sound') {
      if (next.sound) {
        setSoundEnabled(true);
        sfxToggle(true);
      } else {
        sfxToggle(false);
        setSoundEnabled(false);
      }
    } else if (flipped) sfxToggle(!!next[flipped]);
    setSettings(next);
  };

  /* 시험용 손잡이(?test=1 일 때만) */
  useEffect(() => {
    if (!TEST_MODE) return;
    (window as unknown as Record<string, unknown>).__fg = {
      state: () => gameRef.current,
      busy: () => busyRef.current,
      load: (s: GameState) => {
        commit(s);
        finishNow();
      },
      petalColors: () => fxRef.current?.petalLog.slice() ?? [],
      fxBusy: () => !!fxRef.current?.busy,
      sounds: () => playLog.slice(),
      soundsReady,
    };
  }, [commit, finishNow]);

  const cfg = levelConfig(hud.level);
  const progress = Math.min(1, hud.levelPopped / cfg.goal);

  const showHint = ready && !busy && game.turn === 0 && modal === 'none' && !showOver;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <svg className="hills" viewBox="0 0 400 300" preserveAspectRatio="none">
          <path d="M0 120 Q90 60 190 105 T400 90 V300 H0Z" fill="#9fd884" />
          <path d="M0 170 Q120 120 230 160 T400 150 V300 H0Z" fill="#7cc66a" />
          <path d="M0 230 Q100 200 210 225 T400 215 V300 H0Z" fill="#5fae55" />
        </svg>
        <div className="bushes" />
        {(['pink', 'yellow', 'purple', 'red', 'blue', 'orange'] as const).map((c, i) => (
          <span key={c} className={`deco d${i + 1}`} style={{ backgroundImage: `url(${flowerUrl(c)})` }} />
        ))}
      </div>

      <header className="hud">
        <div className="hud-level">
          <small>단계</small>
          <b>{hud.level}</b>
        </div>
        <div className="hud-goal" aria-label={`이번 단계 목표: 꽃 ${cfg.goal}송이 중 ${Math.min(hud.levelPopped, cfg.goal)}송이`}>
          <div className="goal-text">
            꽃 <b>{Math.min(hud.levelPopped, cfg.goal)}</b> / {cfg.goal}
          </div>
          <div className="goal-bar">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="hud-score">
          <small>점수</small>
          <b>{hud.score.toLocaleString('ko-KR')}</b>
        </div>
      </header>

      <Queue queue={game.queue} marks={settings.marks} />

      <main className="board-wrap">
        <div className={`pond ${showHint ? 'hint' : ''}`}>
          <LeafDeco className="leaf l1" />
          <LeafDeco className="leaf l2" />
          <LeafDeco className="leaf l3" />
          <Board ref={boardRef} view={view} marks={settings.marks} locked={busy} onTap={onTap} />
          {showHint && <div className="tap-hint">빈 연잎을 눌러 꽃을 놓아 보세요</div>}
        </div>
        <div className="floats" aria-hidden="true">
          {floats.map((f) => (
            <span key={f.id} className="float" style={{ left: f.x, top: f.y }} onAnimationEnd={() => setFloats((l) => l.filter((x) => x.id !== f.id))}>
              {f.text}
            </span>
          ))}
        </div>
        {banner && (
          <div key={banner.id} className={`banner ${banner.kind}`} onAnimationEnd={() => setBanner((b) => (b && b.id === banner.id ? null : b))}>
            <b>{banner.text}</b>
            {banner.sub && <small>{banner.sub}</small>}
          </div>
        )}
        {!ready && <div className="loading">꽃을 준비하는 중…</div>}
      </main>

      <nav className="tools">
        <button type="button" className="tool" onClick={onUndo} disabled={busy || !canUndo(game)} aria-label={`되돌리기, ${game.undoLeft}번 남음`}>
          <IconUndo />
          <span>되돌리기</span>
          <em>{game.undoLeft}</em>
        </button>
        <button type="button" className="tool" onClick={() => openModal('rank')}>
          <IconTrophy />
          <span>순위</span>
        </button>
        <button type="button" className="tool" onClick={() => openModal('help')}>
          <IconHelp />
          <span>도움말</span>
        </button>
        <button type="button" className="tool" onClick={() => openModal('settings')}>
          <IconGear />
          <span>설정</span>
        </button>
      </nav>

      <canvas ref={fxCanvas} className="fx" aria-hidden="true" />

      {toast && <div className="toast">{toast}</div>}

      {showOver && modal === 'none' && (
        <GameOverModal
          key={`${game.seed}:${game.turn}:${game.score}`}
          gameKey={`${game.seed}:${game.turn}:${game.score}`}
          score={game.score}
          best={best}
          level={game.level}
          popped={game.totalPopped}
          turns={game.turn}
          canUndo={canUndo(game)}
          undoLeft={game.undoLeft}
          onUndo={onUndo}
          onNew={onNewGame}
        />
      )}
      {modal === 'help' && (
        <HelpModal
          first={firstHelp}
          onClose={() => {
            closeModal();
            setFirstHelp(false);
            try {
              localStorage.setItem(HELP_SEEN_KEY, '1');
            } catch {
              /* 무시 */
            }
          }}
        />
      )}
      {modal === 'rank' && <RankModal onClose={closeModal} />}
      {modal === 'settings' && (
        <SettingsModal settings={settings} best={best} onChange={changeSettings} onNew={onNewGame} onClose={closeModal} />
      )}
    </div>
  );
}
