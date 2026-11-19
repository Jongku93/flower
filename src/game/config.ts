/**
 * 조정 가능한 게임 규칙 기본값을 여기 모아 둔다 (TUNING.md 참고).
 */
export const GAME_CONFIG = {
  /** 상단에 보이는 다음 꽃 수 */
  queueLength: 4,
  /** 단계마다 받는 '한 수 되돌리기' 횟수 */
  undoPerLevel: 3,
  /** 연쇄 처리 상한(안전장치). 매 단계 최소 3겹이 사라지므로 25칸×2겹이면 17회를 넘을 수 없다 */
  maxChainSteps: 30,
  /** 2겹 꽃의 안쪽 색은 바깥과 다르게 */
  innerDiffersFromOuter: true,
  score: {
    /** 꽃 한 송이(표면층)당 기본 점수 */
    perFlower: 10,
    /** 직선 4개 이상일 때 넘는 송이마다 추가 */
    longRunBonusPerFlower: 10,
    /** n연쇄 배수 = 1 + (n-1) × chainStep */
    chainStep: 0.5,
  },
} as const;

/** 팝 연출 타이밍(ms) */
export const FX_TIMING = {
  react: 120, // 0~120 맞은 꽃 통통
  bloomEnd: 330, // 120~330 큰 꽃 개화
  scatterEnd: 650, // 330~650 꽃잎 흩날림 + 반짝임
  fadeEnd: 850, // 650~850 잔광, 안쪽 꽃 드러남
  /** 연쇄 2번째부터 단계마다 곱하는 속도(짧아짐) */
  chainSpeedup: 0.85,
  minSpeed: 0.6,
  /** '효과 줄이기' 때 전체 시간 배율 */
  reducedScale: 0.6,
};
