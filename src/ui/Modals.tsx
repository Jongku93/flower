import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flowerUrl } from '../fx/assets';
import type { Settings } from '../game/save';
import type { ColorId } from '../game/types';
import {
  alreadySent,
  cleanName,
  fetchBoard,
  getSavedName,
  hasServer,
  markSent,
  NAME_MAX,
  saveName,
  submitScore,
  type BoardResult,
} from '../leaderboard/client';
import { Flower } from './Flower';

/** 대화상자: 머리 · 내용(넘치면 이 부분만 스크롤) · 아래 버튼(항상 보임) */
function Modal({ title, children, footer, icon = 'pink', className }: { title: string; children: ReactNode; footer?: ReactNode; icon?: ColorId; className?: string }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${className || ''}`}>
        <div className="modal-head">
          <img src={flowerUrl(icon)} alt="" />
          <h2>{title}</h2>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- 놀이 방법 (짧게, 시작 버튼은 항상 화면 안) ---------- */
export function HelpModal({ first, onClose }: { first: boolean; onClose: () => void }) {
  return (
    <Modal
      title="꽃정원"
      className="help-modal"
      footer={
        <button type="button" className="btn primary wide big" onClick={onClose} autoFocus>
          {first ? '시작하기' : '알겠어요'}
        </button>
      }
    >
      <ul className="howto">
        <li>
          <div className="how-pic">
            <Flower layers={['red']} />
            <Flower layers={['red']} />
            <Flower layers={['red']} />
          </div>
          <p>
            같은 색 <b>3송이</b>를 이으면 활짝!
          </p>
        </li>
        <li>
          <div className="how-pic">
            <Flower layers={['red', 'pink']} />
            <span className="arrow">›</span>
            <Flower layers={['pink']} />
          </div>
          <p>
            <b>겹꽃</b>은 안쪽 꽃이 남아요
          </p>
        </li>
      </ul>
      <p className="how-tip">빈 연잎을 누르면 꽃이 놓여요</p>
    </Modal>
  );
}

/* ---------- 순위 목록 ---------- */
const MEDAL = ['🥇', '🥈', '🥉'];
export function RankList({ result }: { result: BoardResult }) {
  const mineRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    mineRef.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);
  if (!result.top.length) return <p className="rank-empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</p>;
  return (
    <ol className="rank-list">
      {result.top.map((e, i) => (
        <li key={i} className={e.mine ? 'mine' : ''} ref={e.mine ? mineRef : undefined}>
          <span className="rk">{i < 3 ? MEDAL[i] : i + 1}</span>
          <span className="nm">{e.name}</span>
          <span className="lv">{e.level}단계</span>
          <span className="sc">{e.score.toLocaleString('ko-KR')}</span>
        </li>
      ))}
    </ol>
  );
}

function rankLine(r: BoardResult, name: string) {
  if (!r.rank) return '';
  return r.online ? `${name}님은 ${r.total}명 중 ${r.rank}등!` : `이 기기 기록 중 ${r.rank}등!`;
}

/* ---------- 이름 입력 ---------- */
function NameForm({ initial, onSubmit, label = '순위에 올리기' }: { initial: string; onSubmit: (n: string) => void; label?: string }) {
  const [v, setV] = useState(initial);
  const ok = cleanName(v).length > 0;
  return (
    <form
      className="name-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(cleanName(v));
      }}
    >
      <label htmlFor="player-name">순위에 쓸 이름이나 별명</label>
      <div className="row">
        <input
          id="player-name"
          value={v}
          maxLength={NAME_MAX + 4}
          placeholder="예) 꽃님이"
          autoComplete="nickname"
          enterKeyHint="done"
          onChange={(e) => setV(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={!ok}>
          {label}
        </button>
      </div>
      <small>한 번 쓰면 이 휴대폰에 저장돼요</small>
    </form>
  );
}

/* ---------- 게임 끝 + 순위 ---------- */
export function GameOverModal({
  score,
  best,
  level,
  popped,
  turns,
  gameKey,
  canUndo,
  undoLeft,
  onUndo,
  onNew,
}: {
  score: number;
  best: number;
  level: number;
  popped: number;
  turns: number;
  gameKey: string;
  canUndo: boolean;
  undoLeft: number;
  onUndo: () => void;
  onNew: () => void;
}) {
  const [name, setName] = useState(getSavedName);
  const [phase, setPhase] = useState<'ask' | 'sending' | 'done'>(name ? 'sending' : 'ask');
  const [result, setResult] = useState<BoardResult | null>(null);
  const started = useRef(false);

  const send = async (n: string) => {
    saveName(n);
    setName(n);
    setPhase('sending');
    const r = await submitScore({ name: n, score, level, popped, turns });
    markSent(gameKey);
    setResult(r);
    setPhase('done');
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (alreadySent(gameKey)) {
      // 이미 올린 판(새로고침 등) → 순위만 보기
      setPhase('sending');
      void fetchBoard().then((r) => {
        setResult(r);
        setPhase('done');
      });
    } else if (name) void send(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      title="정원이 가득 찼어요"
      className="over-modal"
      icon="yellow"
      footer={
        <>
          <button type="button" className="btn primary wide big" onClick={onNew}>
            새 정원 가꾸기
          </button>
          {canUndo && (
            <button type="button" className="btn wide" onClick={onUndo}>
              ↶ 한 수 되돌리기 ({undoLeft}번 남음)
            </button>
          )}
        </>
      }
    >
      <div className="final">
        <div className="final-score">{score.toLocaleString('ko-KR')}</div>
        <div className="final-sub">
          {level}단계까지 · 최고 {best.toLocaleString('ko-KR')}점
        </div>
      </div>
      {phase === 'ask' && <NameForm initial={name} onSubmit={(n) => void send(n)} />}
      {phase === 'sending' && <p className="rank-wait">순위에 올리는 중…</p>}
      {phase === 'done' && result && (
        <>
          {rankLine(result, name) && <p className="rank-me">🌸 {rankLine(result, name)}</p>}
          {result.error && <p className="rank-note">{result.error}</p>}
          {!result.online && !result.error && !hasServer() && <p className="rank-note">함께 보는 순위는 준비 중이에요 (이 기기 기록)</p>}
          <RankList result={result} />
          <button type="button" className="link" onClick={() => setPhase('ask')}>
            이름 바꾸기 ({name})
          </button>
        </>
      )}
    </Modal>
  );
}

/* ---------- 순위 보기 (도구 버튼) ---------- */
export function RankModal({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<BoardResult | null>(null);
  useEffect(() => {
    void fetchBoard().then(setResult);
  }, []);
  const online = result ? result.online : hasServer();
  return (
    <Modal
      title={online ? '함께 보는 순위' : '이 기기 기록'}
      icon="yellow"
      className="rank-modal"
      footer={
        <button type="button" className="btn primary wide big" onClick={onClose}>
          닫기
        </button>
      }
    >
      {!result && <p className="rank-wait">순위를 불러오는 중…</p>}
      {result && (
        <>
          {result.rank && <p className="rank-me">🌸 {rankLine(result, getSavedName())}</p>}
          {result.error && <p className="rank-note">{result.error}</p>}
          {!result.online && !result.error && !hasServer() && <p className="rank-note">함께 보는 순위는 준비 중이에요</p>}
          <RankList result={result} />
        </>
      )}
    </Modal>
  );
}

/* ---------- 설정 ---------- */
function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>
        <b>{label}</b>
        <small>{desc}</small>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export function SettingsModal({
  settings,
  best,
  onChange,
  onNew,
  onClose,
}: {
  settings: Settings;
  best: number;
  onChange: (s: Settings) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(getSavedName);
  const set = (k: keyof Settings) => (v: boolean) => onChange({ ...settings, [k]: v });
  return (
    <Modal
      title="설정"
      icon="purple"
      footer={
        <button type="button" className="btn primary wide big" onClick={onClose}>
          닫기
        </button>
      }
    >
      <Toggle label="소리" desc="꽃이 필 때 맑은 소리" on={settings.sound} onChange={set('sound')} />
      <Toggle label="효과 줄이기" desc="꽃잎·빛 효과를 줄이고 빠르게" on={settings.reduceFx} onChange={set('reduceFx')} />
      <Toggle label="큰 글씨" desc="글자를 크게" on={settings.bigText} onChange={set('bigText')} />
      <Toggle label="색 구별 표시" desc="꽃마다 ♥★●▲◆■ 표시" on={settings.marks} onChange={set('marks')} />
      <div className="name-row">
        {!editName ? (
          <>
            <span>
              <b>순위 이름</b>
              <small>{name || '아직 없어요'}</small>
            </span>
            <button type="button" className="btn small" onClick={() => setEditName(true)}>
              {name ? '바꾸기' : '정하기'}
            </button>
          </>
        ) : (
          <NameForm
            initial={name}
            label="저장"
            onSubmit={(n) => {
              saveName(n);
              setName(n);
              setEditName(false);
            }}
          />
        )}
      </div>
      <p className="best">최고 점수 {best.toLocaleString('ko-KR')}</p>
      {!confirm ? (
        <button type="button" className="btn wide" onClick={() => setConfirm(true)}>
          새 게임 시작
        </button>
      ) : (
        <div className="confirm">
          <p>지금 정원을 지우고 처음부터 할까요?</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              아니요
            </button>
            <button type="button" className="btn danger" onClick={onNew}>
              새로 시작
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
