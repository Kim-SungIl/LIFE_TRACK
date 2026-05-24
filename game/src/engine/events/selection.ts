import { GameEvent, GameState } from '../types';
import { seededRandom } from '../rng';
import { ANNUAL_EVENT_IDS } from '../memorySystem';
import {
  FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS, HARD_CRISIS_IDS, SOFT_CRISIS_IDS,
} from './constants';
import { GAME_EVENTS } from './data';
import { SCHOOL_LIFE_EVENTS } from './school-life';


// 고정 주차 이벤트 해결 후 followup 이벤트 가져오기 (주당 1회 제한)
// ANNUAL_EVENT_IDS에 등록된 후속(반장 선거 후속 등)은 매년 재발동 허용

export function getFollowupForWeek(state: GameState, excludeLocation?: string): GameEvent | null {
  return GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id)) &&
    // 같은 장소 이벤트 연쇄 방지 (농구→축구 같은 어색한 연결 차단)
    // DIRECT_SEQUEL_IDS는 자연스러운 직접 후속이라 같은 장소도 허용 (선거→결과 등)
    (!excludeLocation || e.location !== excludeLocation || DIRECT_SEQUEL_IDS.has(e.id))
  ) || null;
}

// 절대 주차 (학년 경계에서 음수가 안 나오도록) — 쿨다운 비교용
function weeksSince(state: GameState, prev: GameEvent): number {
  const curAbs = (state.year - 1) * 48 + state.week;
  const prevAbs = ((prev.year ?? state.year) - 1) * 48 + (prev.week ?? 0);
  return curAbs - prevAbs;
}

// conditional 이벤트 후보 필터링 — getEventForWeek 내부 + chain 픽(getConditionalForWeek)에서 공유
function pickConditionalCandidates(state: GameState): GameEvent[] {
  return GAME_EVENTS.filter(e =>
    !e.week &&
    e.condition &&
    e.condition(state) &&
    !FOLLOWUP_EVENT_IDS.has(e.id) &&
    !HARD_CRISIS_IDS.has(e.id) &&
    !SOFT_CRISIS_IDS.has(e.id) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 10)
  );
}

// E-2: 친밀도 도달형 자동 판별 — condition 함수 소스에서 npc.intimacy >= N 패턴 검사.
// 스토리 핵심 컷이라 일반 풀과 섞이지 않고 별도 풀로 우선 노출되도록 분리한다.
function isIntimacyMilestone(e: GameEvent): boolean {
  if (!e.condition) return false;
  return /\.intimacy\s*>=/.test(e.condition.toString());
}

// fixed/followup 이벤트 resolve 후 chain용 — conditional 이벤트 1개 추가 픽
// 같은 주(week+year)에 한 번만 호출되도록 호출자가 가드
export function getConditionalForWeek(state: GameState): GameEvent | null {
  const candidates = pickConditionalCandidates(state);
  if (candidates.length === 0) return null;

  // 친밀도 도달형 후보가 있으면 일반 풀과 섞지 않고 그중에서 무조건 1개 노출.
  // (도달형이 일반 이벤트와 1/N 경쟁해 묻히면 다음 노출까지 10주 쿨다운에 걸려 답답해진다.)
  const milestone = candidates.filter(isIntimacyMilestone);
  if (milestone.length > 0) {
    return milestone[Math.floor(seededRandom(state) * milestone.length)];
  }

  // 일반 조건부 풀: 기존 동작 유지 (50% 게이트)
  if (seededRandom(state) < 0.5) {
    return candidates[Math.floor(seededRandom(state) * candidates.length)];
  }
  return null;
}

// 옵션 C: chain cap 초과 시 milestone-only 추가 픽용. 일반 조건부는 픽하지 않는다.
// 학년 한정 도달형(예: Y1 한정)이 학년 마감 직전에 발동 못 하고 사라지는 문제 완화.
export function getMilestoneForWeek(state: GameState): GameEvent | null {
  const candidates = pickConditionalCandidates(state);
  const milestone = candidates.filter(isIntimacyMilestone);
  if (milestone.length === 0) return null;
  return milestone[Math.floor(seededRandom(state) * milestone.length)];
}

// 이번 주에 발동할 이벤트 가져오기
export function getEventForWeek(state: GameState): GameEvent | null {
  // 0. 고정 주차 이벤트 최우선 (followup보다 먼저 — 이미 발동한 이벤트 제외)
  // 같은 주에 여러 fixed 이벤트가 매칭될 수 있음 (예: W37의 단원평가 + 유나생일).
  // NPC 이벤트(speakers 보유)는 보통 친밀도/met 같은 추가 조건이 붙어 더 희소하므로 우선.
  // 학교 일정 이벤트는 매년 발동하지만, NPC 생일/관계 이벤트는 한 번 놓치면 끝이라
  // 후자가 우선되도록 stable 정렬.
  const fixedCandidates = GAME_EVENTS.filter(e =>
    e.week === state.week &&
    (!e.condition || e.condition(state)) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  const fixedEvent = fixedCandidates.find(e => (e.speakers?.length ?? 0) > 0) ?? fixedCandidates[0];
  if (fixedEvent) return fixedEvent;

  // 1. 후속 이벤트 체크 (100% 발동) — ANNUAL은 매년 재발동 허용
  const followup = GAME_EVENTS.find(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  if (followup) return followup;

  // v1.2 (§4.3): 2. 하드 위기 — 연간 1회 가드 (state.hardCrisisYears)
  if (!state.hardCrisisYears.includes(state.year)) {
    const hardCrisis = GAME_EVENTS.find(e =>
      HARD_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    );
    if (hardCrisis) {
      state.hardCrisisYears.push(state.year);
      return hardCrisis;
    }
  }

  // v1.2 (§4.3): 3. 소프트 위기 — 연간 2건 상한
  const softCrisisThisYear = state.events.filter(e =>
    e.year === state.year && SOFT_CRISIS_IDS.has(e.id)
  ).length;
  if (softCrisisThisYear < 2) {
    const softCrisis = GAME_EVENTS.find(e =>
      SOFT_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    );
    if (softCrisis) return softCrisis;
  }

  // 4. 조건부 상태 이벤트 (피로/멘탈 등) — 50% 확률
  // 위기 ID는 위에서 이미 처리했으므로 중복 제거
  const conditionalEvents = pickConditionalCandidates(state);
  if (conditionalEvents.length > 0 && seededRandom(state) < 0.5) {
    return conditionalEvents[Math.floor(seededRandom(state) * conditionalEvents.length)];
  }

  // 5. 학교생활 랜덤 이벤트 — 70% 확률
  const availableSchoolEvents = SCHOOL_LIFE_EVENTS.filter(e =>
    (!e.condition || e.condition(state)) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 6)
  );
  if (availableSchoolEvents.length > 0 && seededRandom(state) < 0.7) {
    return availableSchoolEvents[Math.floor(seededRandom(state) * availableSchoolEvents.length)];
  }

  return null;
}
