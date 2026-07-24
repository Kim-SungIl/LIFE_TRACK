// events/constants.ts
// 이벤트 카테고리 ID 셋 — selection.ts와 데이터 파일 간 공유 분류 식별자
// 데이터 파일은 가능한 한 이 파일을 import하지 않고 순수 GameEvent[] 만 export.
// ID 셋은 selection 로직에서만 참조 (NPC 데이터 추출 후 selection.ts 도입 시 정리).

// 후속 이벤트 ID — 이전 선택에 연결된 이벤트 (100% 확정 발동)
export const FOLLOWUP_EVENT_IDS = new Set([
  'class-president-speech', 'class-president-2-speech',
  'class-president-win', 'class-president-lose', 'class-president-vice',
  'class-president-2-win', 'class-president-2-lose',
  'class-president-nudge',
  'haeun-meet', 'haeun-advice', 'haeun-vending', 'haeun-brother', 'haeun-counselor', 'haeun-reunion', 'haeun-hs-curve',
  'jihun-basketball', 'jihun-secret', 'jihun-fight', 'jihun-support', 'jihun-promise',
  'subin-bridge', 'subin-lonely', 'subin-divorce', 'subin-dream', 'subin-farewell',
  'minjae-sports', 'minjae-exam-chat',
  'minjae-ranking', 'minjae-effort', 'minjae-pressure', 'minjae-honest', 'minjae-dream',
  'yuna-library', 'yuna-lunch', 'yuna-hobby', 'yuna-pressure', 'yuna-smile',
  'junha-transfer', 'junha-riceball', 'junha-dialect', 'junha-homesick', 'junha-cook', 'junha-minjae',
]);

// 직접 후속 이벤트 — 같은 장소에서 자연스럽게 이어지는 결과 (예: 선거→연설→결과 발표)
// excludeLocation 필터를 우회 + store.resolveEvent의 followupFiredThisWeek 가드도 우회
// (선거→연설→결과 같은 자연 chain은 같은 주에 모두 보이는 게 의도)
export const DIRECT_SEQUEL_IDS = new Set<string>([
  'class-president-speech', 'class-president-2-speech',
  'class-president-win', 'class-president-lose', 'class-president-vice',
  'class-president-2-win', 'class-president-2-lose',
]);

// v1.2 하드/소프트 위기 ID 세트 (§4.3 우선순위 레이어)
// 하드: 연간 1회 상한 (state.hardCrisisYears 가드)
// 소프트: 연간 2건 상한
export const HARD_CRISIS_IDS = new Set<string>([
  'middle-burnout', 'high-panic', 'family-strain', 'identity-crisis',
]);
export const SOFT_CRISIS_IDS = new Set<string>([
  'minjae-jealousy', 'yuna-misunderstanding', 'subin-drift',
  'jihun-envy', 'haeun-distance',
]);
