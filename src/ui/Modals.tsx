import { useState, type ReactNode } from 'react';
import type { Settings } from '../game/save';
import { Flower } from './Flower';

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h2>{title}</h2>
        {children}
        {onClose && (
          <button type="button" className="btn primary wide" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="꽃정원 놀이 방법" onClose={onClose}>
      <ol className="help">
        <li>
          <div className="help-row">
            <Flower layers={['red']} />
            <Flower layers={['red']} />
            <Flower layers={['red']} />
          </div>
          빈 자리를 누르면 위쪽 <b>다음</b> 꽃이 놓여요. 같은 색 꽃 <b>3송이 이상</b>을 <b>가로나 세로</b>로 이으면 활짝 피며 사라져요.
        </li>
        <li>
          <div className="help-row">
            <Flower layers={['red', 'pink']} />
            <span className="arrow">→</span>
            <Flower layers={['pink']} />
          </div>
          가운데 작은 꽃이 든 <b>겹꽃</b>은 바깥 꽃이 먼저 피어 사라지고, 안쪽 꽃이 그 자리에 남아요.
        </li>
        <li>남은 꽃이 또 3송이로 이어지면 저절로 <b>연쇄</b>로 피어나요. 점수가 더 커져요.</li>
        <li>목표만큼 꽃을 피우면 다음 단계로 가요. 2단계부터는 정원이 넓어져요.</li>
        <li>
          빈 자리가 없으면 끝나요. 실수했을 때는 <b>되돌리기</b>를 눌러 보세요.
        </li>
      </ol>
    </Modal>
  );
}

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
  const set = (k: keyof Settings) => (v: boolean) => onChange({ ...settings, [k]: v });
  return (
    <Modal title="설정" onClose={onClose}>
      <Toggle label="소리" desc="꽃이 필 때 맑은 소리" on={settings.sound} onChange={set('sound')} />
      <Toggle label="효과 줄이기" desc="꽃잎·빛 효과를 줄이고 빠르게" on={settings.reduceFx} onChange={set('reduceFx')} />
      <Toggle label="큰 글씨" desc="글자를 크게" on={settings.bigText} onChange={set('bigText')} />
      <Toggle label="색 구별 표시" desc="꽃마다 ♥★●▲◆■ 표시" on={settings.marks} onChange={set('marks')} />
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

export function GameOverModal({
  score,
  best,
  level,
  canUndo,
  undoLeft,
  onUndo,
  onNew,
}: {
  score: number;
  best: number;
  level: number;
  canUndo: boolean;
  undoLeft: number;
  onUndo: () => void;
  onNew: () => void;
}) {
  return (
    <Modal title="정원이 가득 찼어요">
      <div className="result">
        <div>
          <small>도착한 단계</small>
          <b>{level}단계</b>
        </div>
        <div>
          <small>점수</small>
          <b>{score.toLocaleString('ko-KR')}</b>
        </div>
        <div>
          <small>최고 점수</small>
          <b>{best.toLocaleString('ko-KR')}</b>
        </div>
      </div>
      {canUndo && (
        <button type="button" className="btn wide" onClick={onUndo}>
          ↶ 한 수 되돌리기 ({undoLeft}번 남음)
        </button>
      )}
      <button type="button" className="btn primary wide" onClick={onNew}>
        새 정원 가꾸기
      </button>
    </Modal>
  );
}
