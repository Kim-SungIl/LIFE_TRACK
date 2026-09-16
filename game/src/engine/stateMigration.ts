// 구세이브 호환 — 두 레이어로 나뉜다:
//  1) 단계형(versioned) 마이그레이션: 세이브에 찍힌 version → 현재 version까지 step을 순차 적용.
//     필드 의미가 바뀌는 breaking 변경만 step으로 쓴다. 로드 시 1회 실행.
//  2) 버전 무관 정규화(migrateLoadedState): 누락 필드 백필 + 리네임 + 직렬화 손실 함수 복원.
//     store 로드와 processWeek 양쪽에서 매번 실행 — 반드시 멱등·저비용. 단순 필드 추가는 전부 이쪽.
// gameEngine.ts 에서 추출 (P2-6). 새 필드 추가 시 migrateLoadedState 한 곳만 수정.
import { GameState, ParentStrength, PendingWeekDelta, StatKey } from './types';
import { padYearCounts } from './ending';
import { hashInitialState, deriveTalkSeed } from './rng';
import { GAME_EVENTS } from './events';
import { SCHOOL_LIFE_EVENTS } from './events/school-life';
import { absWeek } from './weekMath';
import { presentEvent } from './eventPresentation';
import { STAT_KEYS } from './saveIntegrity';

// ===== 1) 단계형 마이그레이션 =====
// 과거엔 store가 version !== SAVE_VERSION이면 세이브를 통째로 버렸다(격상 = 전 세이브 증발).
// 이제 과거 버전은 step 순차 적용으로 살리고, 미래 버전(다운그레이드)만 로드를 거부한다(store).
export const CURRENT_SAVE_VERSION = 1;

type MigrationStep = (state: GameState) => GameState;

// key n = "version n 세이브를 n+1로 올리는" 순수 함수. 단계는 연속이어야 한다(결번 금지).
// 격상 절차: 여기에 step 추가 + CURRENT_SAVE_VERSION 증가 + stateMigration.test.ts에 케이스 추가.
const MIGRATION_STEPS: Record<number, MigrationStep> = {};

// fromVersion(세이브 스탬프)부터 toVersion까지 순차 적용. steps/toVersion 주입은 테스트 전용
// (파이프라인 역학 검증) — 런타임(store 로드)은 기본값만 쓴다.
export function runSaveMigrations(
  state: GameState,
  fromVersion: number,
  steps: Record<number, MigrationStep> = MIGRATION_STEPS,
  toVersion: number = CURRENT_SAVE_VERSION,
): GameState {
  let s = state;
  // 스탬프가 없거나 이상한 세이브는 v1 간주(버전 도입 이후 유일한 과거 버전이 1).
  let v = Number.isInteger(fromVersion) && fromVersion >= 1 ? fromVersion : 1;
  while (v < toVersion) {
    const step = steps[v];
    if (!step) break; // 결번 = step 등록 누락(개발 오류). 남은 단계 강행보다 현 상태 보존이 안전.
    s = step(s);
    v++;
  }
  return s;
}

/**
 * 부모 강점의 **레거시 별칭**. 리네임이 생기면 여기에만 적는다.
 *
 * **왜 상수로 빼는가**: 이 표를 쓰는 곳이 둘이다 — 게임을 로드하는 경로(migrateLoadedState)와,
 * 세이브에서 시작 설정만 뽑는 경로(lastSetup.deriveSetup). 리네임을 한쪽에만 적으면 두 화면이
 * 같은 세이브를 두고 **다른 말을 한다**: 타이틀은 정규화 전 state를, 엔딩은 정규화 후 state를
 * 보기 때문이다(#441 검수에서 'gene' 하나로 실제 재현됨 — 콜드 타이틀에서만 갈래가 사라진다).
 * 지금 항목이 하나뿐인 건 우연이고, 다음 리네임이 들어오면 같은 균열이 조용히 다시 열린다.
 */
export const LEGACY_PARENT_ALIASES: Readonly<Record<string, ParentStrength>> = {
  gene: 'resilience',
};

/** 레거시 별칭을 현행 값으로. 모르는 값은 그대로 돌려준다(검증은 호출부의 몫). */
export function normalizeParentStrength(p: string): string {
  return LEGACY_PARENT_ALIASES[p] ?? p;
}

// ===== 2) 버전 무관 정규화·재수화 =====
/**
 * 주 확정 전 보류분(`pendingWeekDelta`)을 **숫자만 남기고 정규화한다.**
 *
 * 왜 `saveIntegrity`가 아니라 여기인가: 저쪽의 판정은 "이 값으로 게임이 성립하는가"이고,
 * 성립 안 하면 판을 통째로 **거부한다**. 보류분은 그 기준에 안 맞는다 — 한 주짜리 스크래치패드라
 * 실효과는 이미 `state.stats`에 반영돼 있고, 이 필드는 **결산에 보여 줄 델타**일 뿐이다.
 * 이걸로 세이브를 거부하면 7년을 버리고 결산 한 줄을 얻는다. 그래서 거부가 아니라 정규화다.
 *
 * 무엇을 막는가(전부 실측 — 손상 세이브 6종을 실제 store에 태워 확인):
 *
 *   {fatigue: '3'}              → 결산 피로 **-33** (정상 -3, 문자열 이어붙이기)
 *   {money: '-8'}               → 결산 돈 **NaN**
 *   {stats: {academic: '5'}}    → 학업 **+0.2** — 5가 조용히 삼켜짐
 *   {stats: null} · 'corrupt'   → **advanceWeek이 TypeError로 터져 주 확정 불가**
 *   {money: NaN}                → 무해 (falsy 가드에 걸려 건너뜀)
 *
 * 여섯 건 전부 `loadSavedGame`이 true를 돌려줬고 손상 안내는 안 떴다. 각 PR 단독 CI가 못 잡은
 * 이유는 구멍이 **두 PR을 합쳐야** 생기기 때문이다 — 한쪽이 필드를 만들고 다른 쪽이 검증기를 만든다.
 *
 * **모르는 축은 버린다.** `stats`에 `{wisdom: 3}` 같은 게 있으면 결산에 없는 축이 생긴다.
 *
 * 이 함수는 `migrateLoadedState`를 통해 **로드할 때와 매주 `processWeek` 첫머리**에서 돈다.
 * 그래서 정상 보류분은 반드시 그대로 살아남아야 한다(안 그러면 #453이 통째로 죽는다).
 */
export function sanitizePendingWeekDelta(v: unknown): PendingWeekDelta | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const p = v as Record<string, unknown>;
  const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

  const stats: PendingWeekDelta['stats'] = {};
  const rawStats = p.stats;
  if (typeof rawStats === 'object' && rawStats !== null && !Array.isArray(rawStats)) {
    for (const k of STAT_KEYS) {
      const val = (rawStats as Record<string, unknown>)[k];
      if (isNum(val) && val !== 0) stats[k as StatKey] = val;
    }
  }
  const fatigue = isNum(p.fatigue) ? p.fatigue : 0;
  const money = isNum(p.money) ? p.money : 0;

  // 전부 0이면 보류분이 없는 것과 같다 — 타입이 약속한 undefined로 접는다.
  if (fatigue === 0 && money === 0 && Object.keys(stats).length === 0) return undefined;
  return { stats, fatigue, money };
}

export function migrateLoadedState(state: GameState): GameState {
  // 'gene' → 'resilience' 리네임 마이그레이션 (구세이브 호환). 표는 LEGACY_PARENT_ALIASES가 SSOT.
  const migratedParents = state.parents
    ? (state.parents.map((p: string) => normalizeParentStrength(p)) as GameState['parents'])
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
    // T21: 구세이브는 과거 주를 재구성하지 않는다 — 0 백필 = 스냅샷과 동일(등급이 갑자기 안 떨어짐).
    lowMentalWeeksByYear: padYearCounts(state.lowMentalWeeksByYear),
    veryLowMentalWeeksByYear: padYearCounts(state.veryLowMentalWeeksByYear),
    burnoutCountByYear: padYearCounts(state.burnoutCountByYear),
    // T25: 돈 궤적은 **백필하지 않는다**. 0 배열을 채우면 "한 푼도 안 썼다"가 되어
    // 구세이브가 곧장 '지갑을 안 연 한 해'로 오독된다(T21 0 백필은 스냅샷과 같아 안전했지만
    // 여기선 0이 곧 결론이라 다르다). undefined로 두면 화면이 줄 자체를 생략한다.
    moneySpentByYear: state.moneySpentByYear,
    moneyBlockedWeeksByYear: state.moneyBlockedWeeksByYear,
    moneyBlockedStamp: state.moneyBlockedStamp,
    burnoutCooldown: state.burnoutCooldown ?? 0,
    eventTimeCost: state.eventTimeCost ?? 0,
    idleWeeks: state.idleWeeks ?? 0,
    memorySlots: state.memorySlots || [],
    // 손상된 보류분은 결산 숫자를 조용히 뒤집거나 주 확정을 통째로 터뜨린다 — 위 주석 참조.
    pendingWeekDelta: sanitizePendingWeekDelta(state.pendingWeekDelta),
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
      //
      // **presentEvent로 다시 구워야 한다.** 카탈로그 원본을 그대로 넣으면 EventScene은
      // 자기 쪽에서 다시 구워 변이를 보여주는데 state.currentEvent에는 원본이 남는다 →
      // resolveEvent(store)와 GameScreen 결과 문구가 방금 읽은 장면과 다른 문장을 집는다.
      // 굽는 좌표는 EventScene과 같아야 한다: 발생주(cur.week) + 현재 학년.
      result.currentEvent = presentEvent({ ...fresh, week: cur.week ?? result.week }, result);
    } else {
      // 카탈로그에서 사라진 ID(구세이브 리네임/삭제) → currentEvent 제거 + phase 복구로 soft-lock 차단.
      // weekLog 가 있으면 주간 결산(result)으로, 없으면 일상(weekday)으로 떨어뜨려 진행 가능 상태 보장.
      result.currentEvent = null;
      if (result.phase === 'event') result.phase = result.weekLog ? 'result' : 'weekday';
    }
  }

  // 손상 세이브 방어: phase='result'인데 weekLog가 없으면(정상 플레이선 불가 — 외부 편집/절단)
  // 결산 화면 대신 메인으로 조용히 떨어지던 불일치를 명시적으로 일상(weekday)으로 정리.
  // currentEvent 케이스(위)와 대칭 — phase가 렌더 가능한 상태와 항상 일치하도록 보장.
  if (result.phase === 'result' && !result.weekLog) {
    result.phase = 'weekday';
  }

  return result;
}
