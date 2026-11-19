import { forwardRef, type CSSProperties } from 'react';
import type { Cell } from '../game/types';
import { Flower, flowerLabel } from './Flower';

export interface BoardView {
  board: Cell[];
  /** 맞아서 통통 반응 중인 칸 */
  react: Set<number>;
  /** 표면층이 벗겨진 뒤 안쪽 꽃이 커지는 칸 → 지연(ms) */
  reveal: Map<number, number>;
  /** 방금 놓은 칸 */
  fresh: number | null;
  /** 단계가 올라가며 새로 열린 칸 */
  opened: Set<number>;
  /** 애니메이션을 다시 시작시키기 위한 번호 */
  stepKey: number;
}

interface Props {
  view: BoardView;
  marks: boolean;
  locked: boolean;
  onTap: (i: number) => void;
}

export const Board = forwardRef<HTMLDivElement, Props>(function Board({ view, marks, locked, onTap }, ref) {
  const openedList = [...view.opened];
  return (
    <div className={`board ${locked ? 'locked' : ''}`} ref={ref} role="grid" aria-label="꽃밭">
      {view.board.map((cell, i) => {
        if (!cell.active) return <div key={i} className="slot off" aria-hidden="true" />;
        const empty = cell.layers.length === 0;
        const delay = view.reveal.get(i);
        const cls = [
          'slot',
          empty ? 'empty' : '',
          view.react.has(i) ? 'react' : '',
          delay !== undefined ? 'reveal' : '',
          view.fresh === i ? 'fresh' : '',
          view.opened.has(i) ? 'opened' : '',
        ].join(' ');
        const style = {
          '--reveal-delay': `${delay ?? 0}ms`,
          '--open-delay': `${Math.max(0, openedList.indexOf(i)) * 60}ms`,
          '--rot': `${(i * 137) % 360}deg`, // 연잎 홈 방향을 칸마다 다르게
        } as CSSProperties;
        return (
          <button
            key={`${i}-${delay !== undefined || view.react.has(i) || view.fresh === i ? view.stepKey : 0}`}
            type="button"
            className={cls}
            style={style}
            data-cell={i}
            aria-label={flowerLabel(cell.layers)}
            onPointerDown={(e) => {
              // 터치 즉시 반응(클릭 지연 없음). 마우스는 왼쪽 버튼만
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              onTap(i);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onTap(i);
            }}
          >
            <Flower layers={cell.layers} marks={marks} />
          </button>
        );
      })}
    </div>
  );
});
