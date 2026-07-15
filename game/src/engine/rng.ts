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

// 잡담(말걸기) 전용 RNG — 게임 진행 시드(rngSeed)와 분리한다.
// 잡담은 무한 클릭 가능한데, 진행 시드를 공유하면 클릭 횟수만큼 이후 시험·이벤트
// 굴림 시퀀스가 밀려 결정론이 깨지고 리롤 익스플로잇 여지가 생긴다.
// rngSeed에서 1회 파생해 별도 스트림으로 굴린다(0 고정 방지).
export function deriveTalkSeed(rngSeed: number): number {
  return ((rngSeed ^ 0x9e3779b9) >>> 0) || 1;
}

export function seededRandomTalk(state: GameState): number {
  if (!state.talkRngSeed) state.talkRngSeed = deriveTalkSeed(state.rngSeed);
  const a = 1664525, c = 1013904223, m = 0x100000000;
  state.talkRngSeed = (Math.imul(a, state.talkRngSeed) + c) >>> 0;
  return state.talkRngSeed / m;
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
