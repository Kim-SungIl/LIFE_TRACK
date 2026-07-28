// 컴포넌트 테스트 공용 픽스처 — 실제 createInitialState 기반(수제 mock 금지).
// 엔진 초기값이 바뀌면 테스트도 같이 따라가도록 SSOT를 그대로 쓴다.
import { createInitialState } from '../engine/gameEngine';
import { GameState, GameEvent, EventChoice, NpcState } from '../engine/types';

export function makeState(patch?: Partial<GameState>): GameState {
  const s = createInitialState('male', ['emotional', 'info'], { rngSeed: 42 });
  return { ...s, ...patch };
}

// npcs 배열에서 id로 찾아 부분 갱신한 새 배열 — 테스트 의도(어떤 NPC를 어떻게)를 한 줄로.
export function withNpc(
  npcs: NpcState[],
  id: string,
  patch: Partial<NpcState>,
): NpcState[] {
  return npcs.map(n => (n.id === id ? { ...n, ...patch } : n));
}

export function makeChoice(patch?: Partial<EventChoice>): EventChoice {
  return { text: '선택한다', effects: {}, message: '결과 메시지', ...patch };
}

export function makeEvent(patch?: Partial<GameEvent>): GameEvent {
  return {
    id: 'test-event',
    title: '테스트 이벤트',
    description: '테스트 본문이다.',
    choices: [makeChoice()],
    ...patch,
  };
}
