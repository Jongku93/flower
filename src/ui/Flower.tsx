import type { CSSProperties } from 'react';
import { flowerUrl, frontUrl } from '../fx/assets';
import NEST from '../fx/nest.json';
import type { ColorId } from '../game/types';

export const COLOR_NAME: Record<ColorId, string> = {
  red: '빨강',
  yellow: '노랑',
  pink: '분홍',
  orange: '주황',
  purple: '보라',
  blue: '파랑',
};

/** 색 구별 표시(설정에서 켬) — 색만으로 구별하기 어려운 분을 위해 */
export const COLOR_MARK: Record<ColorId, string> = {
  red: '♥',
  yellow: '★',
  pink: '●',
  orange: '▲',
  purple: '◆',
  blue: '■',
};

export function flowerLabel(layers: ColorId[]): string {
  if (!layers.length) return '빈 자리';
  if (layers.length === 1) return `${COLOR_NAME[layers[0]]} 꽃`;
  return `${COLOR_NAME[layers[0]]} 꽃, 안에 ${COLOR_NAME[layers[1]]} 꽃`;
}

/**
 * 안쪽 꽃 자리: 바깥 꽃 그림의 수술(컵) 중심에 작게, 조금 위로.
 * 값은 tools/make-nested.py 가 그림을 분석해 src/fx/nest.json 에 적어 둔 것.
 * 꽃 그림 안에서 수술 중심은 대략 (256, 236)/512.
 */
const SRC = 512;
function innerStyle(outer: ColorId): CSSProperties {
  const m = (NEST as Record<string, { cx: number; cy: number; innerScale: number; innerLift: number }>)[outer];
  const sc = m.innerScale;
  const left = m.cx - 256 * sc;
  const top = m.cy - m.innerLift * SRC - 236 * sc;
  return { left: `${(left / SRC) * 100}%`, top: `${(top / SRC) * 100}%`, width: `${sc * 100}%`, height: `${sc * 100}%` };
}

interface Props {
  layers: ColorId[];
  marks?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * 꽃 한 송이. 2겹이면 [바깥 꽃 전체] → [안쪽 꽃] → [바깥 꽃의 앞 꽃잎] 순서로 겹쳐
 * 안쪽 꽃이 바깥 꽃 컵 안에 들어앉은 것처럼 보이게 한다.
 */
export function Flower({ layers, marks, className, style }: Props) {
  if (!layers.length) return null;
  const [outer, inner] = layers;
  return (
    <div className={`flower ${inner ? 'double' : ''} ${className || ''}`} style={style} data-outer={outer} data-inner={inner || ''}>
      <div className="fl-box">
        <img className="outer" src={flowerUrl(outer)} alt="" draggable={false} />
        {inner && (
          <>
            <img className="inner" src={flowerUrl(inner)} alt="" draggable={false} style={innerStyle(outer)} />
            <img className="front" src={frontUrl(outer)} alt="" draggable={false} />
          </>
        )}
      </div>
      {marks && <span className={`mark c-${outer}`}>{COLOR_MARK[outer]}</span>}
      {marks && inner && <span className={`mark inner-mark c-${inner}`}>{COLOR_MARK[inner]}</span>}
    </div>
  );
}
