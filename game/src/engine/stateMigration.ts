// 구세이브 호환 — 누락 필드 백필 + 리네임 마이그레이션 + 직렬화 손실된 함수 필드 복원.
// gameEngine.ts 에서 추출 (P2-6). store 로드와 processWeek 양쪽에서 사용 — SAVE_VERSION 비격상 유지.
// 새 필드 추가 시 여기 한 곳만 수정.
import { GameState } from './types';
import { hashInitialState, deriveTalkSeed } from './rng';
import { GAME_EVENTS } from './events';
import { SCHOOL_LIFE_EVENTS } from './events/school-life';
import { absWeek } from './weekMath';

export function migrateLoadedState(state: GameState): GameState {
  // 'gene' → 'resilience' 리네임 마이그레이션 (구세이브 호환)
  const migratedParents = state.parents
    ? (state.parents.map((p: string) => (p === 'gene' ? 'resilience' : p)) as GameState['parents'])
    : state.parents;
  // 'do-nothing' 활동 제거(deep-rest와 중복·열등) — 진행 중인 방학 vacationChoices에서 안전 필터링
  const migratedVacationChoices = (state.vacationChoices || []).filter(id => id !== 'do-nothing');
  // 관계 신호: lastInteractionWeek 백필. undefined로 두면 구세이브 전원이 로드 즉시 '요즘 뜸하다'로
  // 대량 오탐 → 현재 절대주차로 시딩해 "방금 만난" 중립 상태에서 시작(다음 8주 뒤부터 자연 발현).
  const nowAbs = absWeek(state.year ?? 1, state.week ?? 1);
  const migratedNpcs = (state.npcs || []).map(n => ({
    ...n,
    lastInteractionWeek: n.lastInteractionWeek ?? nowAbs,
  }));
  const result: GameState = {
    ...state,
    parents: migratedParents,
    npcs: migratedNpcs,
    vacationChoices: migratedVacationChoices,
    examResults: state.examResults || [],
    activeBuffs: state.activeBuffs || [],
    weekPurchases: state.weekPurchases || {},
    consecutiveTiredWeeks: state.consecutiveTiredWeeks ?? 0,
    totalTiredWeeks: state.totalTiredWeeks ?? 0,
    burnoutCooldown: state.burnoutCooldown ?? 0,
    eventTimeCost: state.eventTimeCost ?? 0,
    idleWeeks: state.idleWeeks ?? 0,
    memorySlots: state.memorySlots || [],
    milestoneScenes: state.milestoneScenes || [],
    rngSeed: (state.rngSeed && state.rngSeed !== 0)
      ? state.rngSeed
      : hashInitialState({ gender: state.gender, parents: migratedParents }),
    // 잡담 전용 시드 백필 — 구세이브는 rngSeed에서 파생(0이면 방지). 진행 시드와 분리.
    talkRngSeed: (state.talkRngSeed && state.talkRngSeed !== 0)
      ? state.talkRngSeed
      : deriveTalkSeed(
          (state.rngSeed && state.rngSeed !== 0)
            ? state.rngSeed
            : hashInitialState({ gender: state.gender, parents: migratedParents }),
        ),
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
    // Phase 2B: strict 성적향상 어드밴티지 연간 가드
    parentPraiseYears: state.parentPraiseYears ?? [],
    // Phase 4B: 강점별 절정 발동 가드 + 긍정 태그 누적(구버전 세이브는 0부터 — 절정은 조건 충족 시 발동)
    parentClimaxFired: state.parentClimaxFired ?? [],
    parentPositiveTags: state.parentPositiveTags ?? {},
  };

  // 직렬화/clone에서 손실된 currentEvent의 함수 필드(condition 등) 복원
  // EventChoice.condition이 살아 있어야 EventScene 선택지 게이팅이 정상 동작 —
  // 이벤트 도중 새로고침 시 돈 부족 선택지가 잠금 풀려 보이던 버그 차단
  if (result.currentEvent && result.currentEvent.id) {
    const cur = result.currentEvent;
    // SCHOOL_LIFE_EVENTS 는 별도 풀(GAME_EVENTS 미포함)이지만 selection 에서 currentEvent 로
    // 반환되는 가장 흔한 이벤트군 — 함께 조회하지 않으면 학교생활 랜덤 이벤트 도중 새로고침 시
    // currentEvent 유실(null) + phase='event' 유지로 soft-lock 발생.
    const fresh = GAME_EVENTS.find(e => e.id === cur.id)
      ?? SCHOOL_LIFE_EVENTS.find(e => e.id === cur.id);
    if (fresh) {
      // 발생주(cur.week)는 보존 — result.week 는 week++(gameEngine) 이후 값이라 덮어쓰면
      // 기억(memory)의 발생주가 +1 어긋난다(W48 이벤트 → 49).
      result.currentEvent = { ...fresh, week: cur.week ?? result.week };
    } else {
      // 카탈로그에서 사라진 ID(구세이브 리네임/삭제) → currentEvent 제거 + phase 복구로 soft-lock 차단.
      // weekLog 가 있으면 주간 결산(result)으로, 없으면 일상(weekday)으로 떨어뜨려 진행 가능 상태 보장.
      result.currentEvent = null;
      if (result.phase === 'event') result.phase = result.weekLog ? 'result' : 'weekday';
    }
  }

  return result;
}
