// ===== v1.2 결정론적 RNG =====
// LCG (Linear Congruential Generator) — 이벤트 발동 분기 전용.
// state.rngSeed를 mutate. 같은 시드 + 같은 플레이 입력 = 항상 같은 시퀀스.
// events.ts와 gameEngine.ts 모두에서 사용하므로 별도 모듈로 분리 (순환 import 방지).

import type { GameState } from './types';

export function seededRandom(state: GameState): number {
  const a = 1664525, c = 1013904223, m = 0x100000000;
  state.rngSeed = (Math.imul(a, state.rngSeed) + c) >>> 0;
  return state.rngSeed / m;
}

export function hashInitialState(seedInput: {
  gender: string;
  parents: readonly string[];
  startedAt?: number;
}): number {
  const str = `${seedInput.gender}_${seedInput.parents.join('-')}_${seedInput.startedAt ?? Date.now()}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 16777619);
  }
  // 0이면 LCG가 0에 고정되므로 방지
  return (hash >>> 0) || 1;
}
