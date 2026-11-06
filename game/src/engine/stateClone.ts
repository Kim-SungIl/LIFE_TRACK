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
 *
 * **이벤트 기록(state.events)은 배열만 새로 만들고 레코드 객체는 공유한다.** 7년 완주 상태 236KB 중
 * 대부분이 기록이라(Y7 W30 실측 clone 1.44ms) 미리보기·루틴 판정처럼 한 번에 수십 번 복제하는 경로가
 * 판 후반으로 갈수록 무거워졌다. 공유가 안전한 전제는 둘이다:
 *   - 레코드는 만들어진 뒤 바뀌지 않는다 — 바꿀 일이 있으면 새 객체로 갈아 끼운다(store.consumeRomancePlan).
 *   - 레코드는 처음부터 JSON 왕복을 거친 모양이다(recordResolvedEvent가 정규화) — 그래서 공유해도
 *     예전 깊은 복사와 같은 값이고, 세이브·지문 바이트도 같다.
 * 배열 자리를 비워 둔 채 직렬화해 키 순서도 예전과 같다.
 */
export function cloneGameState(state: GameState): GameState {
  if (!Array.isArray(state.events)) return JSON.parse(JSON.stringify(state)) as GameState;
  const clone = JSON.parse(JSON.stringify({ ...state, events: [] })) as GameState;
  clone.events = state.events.slice();
  return clone;
}
