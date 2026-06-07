// 구세이브 호환 — 누락 필드 백필 + 리네임 마이그레이션 + 직렬화 손실된 함수 필드 복원.
// gameEngine.ts 에서 추출 (P2-6). store 로드와 processWeek 양쪽에서 사용 — SAVE_VERSION 비격상 유지.
// 새 필드 추가 시 여기 한 곳만 수정.
import { GameState } from './types';
import { hashInitialState } from './rng';
import { GAME_EVENTS } from './events';

export function migrateLoadedState(state: GameState): GameState {
  // 'gene' → 'resilience' 리네임 마이그레이션 (구세이브 호환)
  const migratedParents = state.parents
    ? (state.parents.map((p: string) => (p === 'gene' ? 'resilience' : p)) as GameState['parents'])
    : state.parents;
  // 'do-nothing' 활동 제거(deep-rest와 중복·열등) — 진행 중인 방학 vacationChoices에서 안전 필터링
  const migratedVacationChoices = (state.vacationChoices || []).filter(id => id !== 'do-nothing');
  const result: GameState = {
    ...state,
    parents: migratedParents,
    vacationChoices: migratedVacationChoices,
    examResults: state.examResults || [],
    activeBuffs: state.activeBuffs || [],
    weekPurchases: state.weekPurchases || {},
    consecutiveTiredWeeks: state.consecutiveTiredWeeks ?? 0,
    burnoutCooldown: state.burnoutCooldown ?? 0,
    eventTimeCost: state.eventTimeCost ?? 0,
    idleWeeks: state.idleWeeks ?? 0,
    memorySlots: state.memorySlots || [],
    milestoneScenes: state.milestoneScenes || [],
    rngSeed: (state.rngSeed && state.rngSeed !== 0)
      ? state.rngSeed
      : hashInitialState({ gender: state.gender, parents: migratedParents }),
    hardCrisisYears: state.hardCrisisYears || [],
    // 슬롯별 루틴 카운터 — 구세이브의 단일 routineWeeks 값을 양 슬롯에 복제 (호환)
    routineSlot2Weeks: state.routineSlot2Weeks
      ?? (state as unknown as { routineWeeks?: number }).routineWeeks ?? 0,
    routineSlot3Weeks: state.routineSlot3Weeks
      ?? (state as unknown as { routineWeeks?: number }).routineWeeks ?? 0,
    // Phase 2.1 말걸기 백필
    talkEventPressure: state.talkEventPressure ?? 0,
    parentTalkPressure: state.parentTalkPressure ?? 0,
    parentIntimacy: state.parentIntimacy ?? 50,
    talkEventsFired: state.talkEventsFired ?? [],
    npcEventPendingThisWeek: state.npcEventPendingThisWeek ?? false,
    parentEventPendingThisWeek: state.parentEventPendingThisWeek ?? false,
    // Phase 2A: 부모 미니이벤트 쿨다운 기록(없던 세이브는 빈 배열 → 즉시 재발동 가능)
    parentEventsFired: state.parentEventsFired ?? [],
  };

  // 직렬화/clone에서 손실된 currentEvent의 함수 필드(condition 등) 복원
  // EventChoice.condition이 살아 있어야 EventScene 선택지 게이팅이 정상 동작 —
  // 이벤트 도중 새로고침 시 돈 부족 선택지가 잠금 풀려 보이던 버그 차단
  if (result.currentEvent && result.currentEvent.id) {
    const fresh = GAME_EVENTS.find(e => e.id === result.currentEvent!.id);
    result.currentEvent = fresh
      ? { ...fresh, week: result.week }
      : null;  // 카탈로그에서 사라진 ID → 안전 fallback
  }

  return result;
}
