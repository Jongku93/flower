/**
 * 시드 RNG (mulberry32). 상태는 uint32 하나라서 저장·복원이 정확하다.
 * 함수는 순수: (state) → [값 0..1, 다음 state]
 */
export function nextRandom(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [v, s];
}

export function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }
}
