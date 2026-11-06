import { GameEvent, GameState } from './types';

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
 * **이벤트 기록(state.events)은 배열만 새로 만들고, 채택된 레코드는 복제하지 않고 공유한다.** 7년 완주
 * 상태 236KB 중 대부분이 기록이라(Y7 W30 실측 clone 1.44ms) 미리보기·루틴 판정처럼 한 번에 수십 번
 * 복제하는 경로가 판 후반으로 갈수록 무거워졌다.
 *
 * 공유해도 되는 레코드는 **adoptEventRecord를 거친 것뿐**이다(WeakSet으로 표시). 거친 레코드는
 *   - JSON 왕복을 한 번 거친 모양이라(함수·undefined 키 없음) 예전 깊은 복사와 값·바이트가 같고,
 *   - 개발·테스트에서는 깊게 얼어 있어 누가 제자리에서 바꾸면 그 자리에서 던진다(공유의 전제: 불변).
 * 표시가 없는 레코드 — 세이브에서 읽은 기록, 테스트·sim 스크립트가 직접 넣은 기록, 화면이 갈아 끼운
 * 레코드 — 는 여기서 한 번 채택(복사)된다. 그래서 출처와 상관없이 전제가 성립한다. 로드 직후 매 복제가
 * 기록을 다시 복사하지 않도록 migrateLoadedState가 로드 시점에 미리 채택해 둔다.
 * 배열 자리를 비워 둔 채 직렬화해 키 순서도 예전과 같다.
 */
export function cloneGameState(state: GameState): GameState {
  if (!Array.isArray(state.events)) return JSON.parse(JSON.stringify(state)) as GameState;
  const clone = JSON.parse(JSON.stringify({ ...state, events: [] })) as GameState;
  clone.events = adoptEventRecords(state.events);
  return clone;
}

const adopted = new WeakSet<object>();

/** 기록 레코드 하나를 공유 가능한 모양으로 만든다 — JSON 정규화 + (개발·테스트) 깊은 동결 + 채택 표시. */
export function adoptEventRecord(record: GameEvent): GameEvent {
  if (adopted.has(record)) return record;
  const normalized = JSON.parse(JSON.stringify(record)) as GameEvent;
  if (import.meta.env?.DEV) deepFreeze(normalized);
  adopted.add(normalized);
  return normalized;
}

/** 새 배열로, 채택된 레코드는 그대로·아닌 레코드는 채택해서. 객체가 아닌 칸은 예전 JSON 왕복과 같은 값(undefined → null). */
export function adoptEventRecords(events: readonly GameEvent[]): GameEvent[] {
  return events.map(e => (e && typeof e === 'object'
    ? adoptEventRecord(e)
    : (JSON.parse(JSON.stringify(e ?? null)) as GameEvent)));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
