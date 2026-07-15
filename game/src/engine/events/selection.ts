import { GameEvent, GameState } from '../types';
import { seededRandom } from '../rng';
import { ANNUAL_EVENT_IDS } from '../memorySystem';
import {
  FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS, HARD_CRISIS_IDS, SOFT_CRISIS_IDS,
} from './constants';
import { GAME_EVENTS } from './data';
import { SCHOOL_LIFE_EVENTS } from './school-life';
import { absWeek } from '../weekMath';


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
  const curAbs = absWeek(state.year, state.week);
  const prevAbs = absWeek(prev.year ?? state.year, prev.week ?? 0);
  return curAbs - prevAbs;
}

// conditional 이벤트 후보 필터링 — getEventForWeek 내부 + chain 픽(getConditionalForWeek)에서 공유
function pickConditionalCandidates(state: GameState): GameEvent[] {
  return GAME_EVENTS.filter(e =>
    !e.week &&
    !e.reach &&
    e.condition &&
    e.condition(state) &&
    !FOLLOWUP_EVENT_IDS.has(e.id) &&
    !HARD_CRISIS_IDS.has(e.id) &&
    !SOFT_CRISIS_IDS.has(e.id) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 10)
  );
}

// ===== 도달형(reach) 페이싱 엔진 =====
// 절대 친밀도 임계만으로 게이트하면 친밀도가 미리 높을 때 적격 reach가 한꺼번에 터진다(burst).
// 규칙: ① fresh(이번 주에 임계를 방금 넘음) = 쿨다운 면제, 즉시 발동 → 빠르게 도달한 헌신 플레이어를
//       굶기지 않음. ② pre-met(이미 넘어 있던 임계) = NPC별 쿨다운(48주 ÷ 그 NPC·그 해 reach 수)으로
//       균등 분산. ③ 주당 1개. ④ 영구 1회성.
// 그 NPC·그 해 reach 수로 쿨다운 산출(= 1년 ÷ 이벤트 수). 최소 4주 가드.
function reachCooldown(npc: string, year: number): number {
  const count = GAME_EVENTS.filter(e => e.reach && e.reach.npc === npc && e.reach.year === year).length;
  return count > 0 ? Math.max(4, Math.round(48 / count)) : 48;
}

// 그 NPC의 마지막 reach 발동 절대주차 (없으면 null)
function lastReachAbsWeek(state: GameState, npc: string): number | null {
  let last: number | null = null;
  for (const e of state.events) {
    if (e.reach && e.reach.npc === npc) {
      const abs = absWeek(e.year ?? 1, e.week ?? 0);
      if (last === null || abs > last) last = abs;
    }
  }
  return last;
}

// 이번 주 발동할 도달형 1개 선택 (페이싱 규칙 적용). 없으면 null.
export function getReachForWeek(state: GameState): GameEvent | null {
  // ④ 1회성: 이미 발동한 reach 제외
  const firedIds = new Set(state.events.filter(e => e.reach).map(e => e.id));
  // ③ 주당 1개: 이번 주에 이미 reach 발동했으면 중단
  if (state.events.some(e => e.reach && e.year === state.year && e.week === state.week)) return null;

  const cands = (GAME_EVENTS as GameEvent[]).filter(e =>
    e.reach && !firedIds.has(e.id) && e.condition && e.condition(state),
  );
  if (cands.length === 0) return null;
  const npcOf = (e: GameEvent) => state.npcs.find(n => n.id === e.reach!.npc);

  // ① fresh: 주 시작 친밀도 < 임계 <= 현재 친밀도 (이번 주에 막 넘음) → 쿨다운 면제, 즉시
  const fresh = cands.filter(e => {
    const n = npcOf(e);
    return n && (n.weekStartIntimacy ?? n.intimacy) < e.reach!.tier && n.intimacy >= e.reach!.tier;
  });
  if (fresh.length > 0) return fresh.sort((a, b) => a.reach!.tier - b.reach!.tier)[0];

  // ② pre-met: 이미 임계를 넘어 있던 것 → NPC별 쿨다운 경과분만, 낮은 tier 우선
  const cur = absWeek(state.year, state.week);
  const eligible = cands.filter(e => {
    const n = npcOf(e);
    if (!n || (n.weekStartIntimacy ?? n.intimacy) < e.reach!.tier) return false;
    const last = lastReachAbsWeek(state, e.reach!.npc);
    return last === null || (cur - last) >= reachCooldown(e.reach!.npc, e.reach!.year);
  });
  if (eligible.length === 0) return null;
  return eligible.sort((a, b) => a.reach!.tier - b.reach!.tier)[0];
}

// fixed/followup 이벤트 resolve 후 chain용 — 도달형 우선, 없으면 일반 조건부 1개(50%).
// 같은 주(week+year)에 한 번만 호출되도록 호출자가 가드
export function getConditionalForWeek(state: GameState): GameEvent | null {
  const reach = getReachForWeek(state);
  if (reach) return reach;

  const candidates = pickConditionalCandidates(state);
  if (candidates.length === 0) return null;
  if (seededRandom(state) < 0.5) {
    return candidates[Math.floor(seededRandom(state) * candidates.length)];
  }
  return null;
}

// chain cap 초과 시 도달형 전용 추가 픽 — 학년 한정 reach가 마감 직전 누락되는 것 완화.
export function getMilestoneForWeek(state: GameState): GameEvent | null {
  return getReachForWeek(state);
}

// getEventForWeek 결과 — 선택된 이벤트 + state patch (사이드이펙트를 호출자에 위임)
// patch 가 null 이 아니면 호출자가 명시적으로 newState 에 적용해야 함.
export type EventSelection = {
  event: GameEvent | null;
  patch: Pick<GameState, 'hardCrisisYears'> | null;
};

const noPatch = (event: GameEvent | null): EventSelection => ({ event, patch: null });

// 같은 슬롯 후보 경합의 단일 해소 규칙 — selectionPriority 내림차순(기본 0), 마지막은 배열 순서(stable).
// speakersTiebreak: 동순위에서 speakers 보유 우선(일회성 관계 이벤트 보호용 레거시 휴리스틱).
//   fixed 경로 전용 — followup/hardCrisis 경로는 기존 find(순수 배열 순서) 동작 보존을 위해 끈다.
// 주의: annual vs annual 경합은 우선순위로 풀 수 없다(한쪽이 영구히 가려짐) —
//   그 경우는 주차를 분리해야 한다 (선례: yuna-birthday W37→W38, minjae-birthday W7→W13).
function pickByPriority(candidates: GameEvent[], speakersTiebreak = true): GameEvent | undefined {
  if (candidates.length <= 1) return candidates[0];
  return [...candidates].sort((a, b) =>
    ((b.selectionPriority ?? 0) - (a.selectionPriority ?? 0)) ||
    (speakersTiebreak ? ((b.speakers?.length ? 1 : 0) - (a.speakers?.length ? 1 : 0)) : 0)
  )[0];
}

// 이번 주에 발동할 이벤트 가져오기 — 순수 함수 (state mutation 없음)
export function getEventForWeek(state: GameState): EventSelection {
  // 0. 고정 주차 이벤트 최우선 (followup보다 먼저 — 이미 발동한 이벤트 제외)
  // 같은 주에 여러 fixed 이벤트가 매칭될 수 있음. 경합 해소는 pickByPriority 규칙 참조.
  const fixedCandidates = GAME_EVENTS.filter(e =>
    e.week === state.week &&
    (!e.condition || e.condition(state)) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  const fixedEvent = pickByPriority(fixedCandidates);
  if (fixedEvent) return noPatch(fixedEvent);

  // 1. 후속 이벤트 체크 (100% 발동) — ANNUAL은 매년 재발동 허용
  // 복수 매칭 시 pickByPriority(speakers tiebreak 없음) — priority 미부여 시 기존 find와 완전 동일.
  const followup = pickByPriority(GAME_EVENTS.filter(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_EVENT_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  ), false);
  if (followup) return noPatch(followup);

  // v1.2 (§4.3): 2. 하드 위기 — 연간 1회 가드 (state.hardCrisisYears)
  if (!state.hardCrisisYears.includes(state.year)) {
    const hardCrisis = pickByPriority(GAME_EVENTS.filter(e =>
      HARD_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    ), false);
    if (hardCrisis) {
      // 발동 시 연간 가드 갱신을 patch 로 반환 (호출자가 적용)
      return {
        event: hardCrisis,
        patch: { hardCrisisYears: [...state.hardCrisisYears, state.year] },
      };
    }
  }

  // v1.2 (§4.3): 3. 소프트 위기 — 연간 2건 상한
  const softCrisisThisYear = state.events.filter(e =>
    e.year === state.year && SOFT_CRISIS_IDS.has(e.id)
  ).length;
  if (softCrisisThisYear < 2) {
    // followup/hardCrisis 경로와 동일하게 pickByPriority(speakers tiebreak 없음) —
    // priority 미부여 시 stable sort라 기존 find(배열 순서)와 완전 동일하게 동작.
    const softCrisis = pickByPriority(GAME_EVENTS.filter(e =>
      SOFT_CRISIS_IDS.has(e.id) &&
      e.condition && e.condition(state) &&
      !state.events.some(prev => prev.id === e.id)
    ), false);
    if (softCrisis) return noPatch(softCrisis);
  }

  // 3.5 도달형(reach) — 페이싱 엔진이 적격 판정(fresh 즉시 / pre-met 쿨다운). 적격이면 확정 발동.
  // 일반 조건부보다 우선(스토리 핵심 컷) — pickConditionalCandidates 는 reach 를 제외하므로 중복 없음.
  const reach = getReachForWeek(state);
  if (reach) return noPatch(reach);

  // 4. 조건부 상태 이벤트 (피로/멘탈 등) — 50% 확률
  // 위기 ID는 위에서 이미 처리했으므로 중복 제거
  const conditionalEvents = pickConditionalCandidates(state);
  if (conditionalEvents.length > 0 && seededRandom(state) < 0.5) {
    return noPatch(conditionalEvents[Math.floor(seededRandom(state) * conditionalEvents.length)]);
  }

  // 5. 학교생활 랜덤 이벤트 — 50% 확률
  // (방학엔 개별 이벤트 condition의 !isVacation으로 원천 차단 → 학기 주에만 발동)
  // 70%→50%: 학기 주 이벤트 발생률 ~85%→~77%로 완화, "매주 뭔가 터지는" 압박 축소.
  // 다중시드 sim 측정치는 scripts/sim/sim-event-frequency.ts 참고.
  const availableSchoolEvents = SCHOOL_LIFE_EVENTS.filter(e =>
    (!e.condition || e.condition(state)) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 6)
  );
  if (availableSchoolEvents.length > 0 && seededRandom(state) < 0.5) {
    return noPatch(availableSchoolEvents[Math.floor(seededRandom(state) * availableSchoolEvents.length)]);
  }

  return noPatch(null);
}
