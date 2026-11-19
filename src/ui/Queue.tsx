import type { Piece } from '../game/types';
import { Flower, flowerLabel } from './Flower';

export function Queue({ queue, marks }: { queue: Piece[]; marks: boolean }) {
  return (
    <div className="queue" aria-label={`다음 꽃: ${queue.map(flowerLabel).join(', ')}`}>
      <span className="queue-label">다음</span>
      {queue.map((p, i) => (
        <div key={`${i}-${p.join('-')}`} className={`q-item ${i === 0 ? 'first' : ''}`}>
          <Flower layers={p} marks={marks} />
        </div>
      ))}
    </div>
  );
}
