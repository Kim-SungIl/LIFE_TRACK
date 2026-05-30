import { GameState } from './types';

/**
 * GameState 깊은 복사.
 *
 * JSON 직렬화 기반이라 함수 필드(currentEvent.condition 등)는 의도적으로 탈락한다.
 * structuredClone 은 함수에서 throw 하므로 쓰지 않는다. 함수 복원이 필요한 경로
 * (세이브 로드 / processWeek)는 migrateLoadedState 로 재수화한다.
 *
 * 기존에 store/gameEngine/shopSystem 에 흩어져 있던 JSON.parse(JSON.stringify(...))
 * 패턴의 단일 진입점.
 */
export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
