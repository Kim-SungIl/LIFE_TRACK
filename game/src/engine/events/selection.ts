import { romanceEventEligibility } from '../romance';
import { GameEvent, GameState } from '../types';
import { seededRandom } from '../rng';
// 재발동 여부만 본다 — 기억 슬롯 금지 셋(ANNUAL_EVENT_IDS)과는 다른 축이다.
import { ANNUAL_REFIRE_IDS } from '../memorySystem';
import {
  FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS, HARD_CRISIS_IDS, SOFT_CRISIS_IDS,
} from './constants';
import { GAME_EVENTS } from './data';
import { SCHOOL_LIFE_EVENTS } from './school-life';
import { absWeek } from '../weekMath';

// ===== 사건 예산 (선택 풀 발화율) =====
// 학기 사건 주율을 ~79% → 65~70%로 낮추는 2차 감축 (1차: school-life 0.7→0.5).
// school-life(잡사건)만 깎고 conditional은 유지 — 신규 NPC 첫만남·반장 질감·부모 압박이
// conditional 풀이라, 여길 깎으면 관계 진입과 서사 전제가 같이 굶는다.
// 8시드 실측(scripts/sim/sim-event-frequency.ts): 0.45/0.25에서 학기 사건 주율 65.9~67.9%,
// conditional 총량 ~100(감축 전 98.6와 동일 — 쿨다운 피드백), school 58.6→31.5,
// fixed/followup/reach/위기 불변.
export const EVENT_DENSITY = {
  conditional: 0.45, // getEventForWeek 4번 티어
  schoolLife: 0.25,  // getEventForWeek 5번 티어
  chain: 0.45,       // resolveEventChain의 조건부 추가 픽 (주율이 아니라 주당 몰림에 영향)
} as const;

// 고정 주차 이벤트 해결 후 followup 이벤트 가져오기 (주당 1회 제한)
// ANNUAL_REFIRE_IDS에 등록된 후속(반장 선거 후속 등)은 매년 재발동 허용

export function getFollowupForWeek(state: GameState, excludeLocation?: string): GameEvent | null {
  // getEventForWeek 내부 followup 경로와 동일하게 pickByPriority(speakers tiebreak 없음)로 통일.
  // 복수 followup 동시 적격 시 selectionPriority 존중 — priority 미부여 시 stable sort라 기존 find와 동일.
  return pickByPriority(GAME_EVENTS.map(e => romanceEventEligibility(e, state)).filter(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_REFIRE_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id)) &&
    // 같은 장소 이벤트 연쇄 방지 (농구→축구 같은 어색한 연결 차단)
    // DIRECT_SEQUEL_IDS는 자연스러운 직접 후속이라 같은 장소도 허용 (선거→결과 등)
    (!excludeLocation || e.location !== excludeLocation || DIRECT_SEQUEL_IDS.has(e.id))
  ), false) || null;
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

// ===== 앵커 도달형 예약 =====
// 문장이 달력의 한 시점(졸업식·합격자 발표)을 전제하는 컷은 `reach.anchorWeek`를 단다. 페이싱 엔진은
// 이 컷을 **평소와 똑같이 고른다**(fresh 즉시 / pre-met 쿨다운 / 주당 1개) — 다만 그 주가 앵커 전이면
// 띄우지 않고 예약만 한다(`state.reachReservations[id] = 그 발생주`). 예약분은 앵커 주부터 친밀도를
// 다시 보지 않고 띄운다(얻은 컷은 지킨다).
//
// 왜 주차 게이트(`s.week >= N`)가 아닌가(docs/reach-graduation-timing-options-2026-10-12.md):
//   · 게이트는 fresh 창을 닫고, 같은 NPC 앞 컷의 쿨다운이 게이트 창을 덮고, 고티어는 감쇠로 창 전에 내려간다
//     — 주입 1,008 기회 중 176~210 유실.
//   · 쿨다운 스탬프를 **표시 주**로 찍으면 학년을 넘어 다음 학년 컷이 죽는다(서아 Y4 W46 → Y5 학기 전용
//     `seoa-both-earphones-again`이 방학으로 밀림). 그래서 스탬프는 예약 주 = 원래 떴을 주다.
//
// 발생주 좌표: 메인 슬롯은 `state.week`가 발생주지만 chain은 week++ 뒤라 `state.week − 1`이다
// (`s.week >= N` 게이트가 chain에서 N−1주에 뜨는 함정). 그래서 앵커 판정은 호출자가 넘기는
// occurrenceWeek로 한다 — 조건의 `s.week`를 읽지 않는다.
type Reservations = NonNullable<GameState['reachReservations']>;
const reservationsOf = (state: GameState): Reservations => state.reachReservations ?? {};

/** 이미 소비된 도달형 — 표시됐거나 예약됐다. 페이싱·관계 신호(relationshipSignals)가 같은 기준을 쓴다. */
export function consumedReachIds(state: GameState): Set<string> {
  const ids = new Set(state.events.filter(e => e.reach).map(e => e.id));
  for (const id of Object.keys(reservationsOf(state))) ids.add(id);
  return ids;
}

// 그 NPC의 마지막 reach 발동 절대주차 (없으면 null). 예약된 컷은 표시 주가 아니라 **예약 주**로 센다.
function lastReachAbsWeek(state: GameState, npc: string): number | null {
  const res = reservationsOf(state);
  let last: number | null = null;
  const take = (abs: number) => { if (last === null || abs > last) last = abs; };
  for (const e of state.events) {
    if (e.reach && e.reach.npc === npc && !res[e.id]) take(absWeek(e.year ?? 1, e.week ?? 0));
  }
  for (const [id, r] of Object.entries(res)) {
    if (GAME_EVENTS.find(e => e.id === id)?.reach?.npc === npc) take(absWeek(r.year, r.week));
  }
  return last;
}

// ③ 주당 1개 — 기록의 발생주를 `state.week`와 비교하는 기존 규칙 그대로. 예약은 여기에 따로 넣지 않는다:
// 제품 좌표에선 메인 슬롯이 주마다 한 번 돌고 chain은 week++ 뒤라 같은 주 재호출이 없어서, 예약을 넣어도
// 동작이 같은 등가 변이였다(뮤테이션 확인). 이 가드가 실제로 걸리는 건 같은 state로 거듭 부르는 진단 스크립트뿐이다.
function reachSlotTaken(state: GameState): boolean {
  return state.events.some(e => e.reach && e.year === state.year && e.week === state.week);
}

/** 예약됐고 아직 안 떴고, 발생주가 앵커에 닿은 그 해의 컷 — 앵커 이른 순(같으면 배열 순). */
export function getDueReservedReach(state: GameState, occurrenceWeek: number): GameEvent | null {
  const res = reservationsOf(state);
  const shown = new Set(state.events.map(e => e.id));
  const due = (GAME_EVENTS as GameEvent[]).filter(e =>
    e.reach?.anchorWeek !== undefined && res[e.id]?.year === state.year && !shown.has(e.id)
    && occurrenceWeek >= e.reach.anchorWeek,
  );
  if (due.length === 0) return null;
  const first = [...due].sort((a, b) => a.reach!.anchorWeek! - b.reach!.anchorWeek!)[0];
  // 연애 판본은 문장·메타만 바꾼다 — 조건은 다시 보지 않는다(친밀도 재검사 없음).
  return romanceEventEligibility(first, state);
}

// 학년 마지막 발생주 — 여기서 못 띄우면 학년 전환이 예약을 영영 묻는다. 그래서 이 주엔 주당 1개·chain cap을
// 넘어서라도 남은 예약을 다 비운다(앵커는 전부 46 이하라 정상 흐름에선 그 전에 다 뜬다 — 안전망).
const LAST_OCCURRENCE_WEEK = 48;

/**
 * 이번 주 도달형 판정. `event` = 지금 띄울 컷, `reserve` = 지금 예약할 앵커 컷 id들(호출자가 applyReachReservation).
 *
 * 예약하면 같은 판정 안에서 **다음 컷을 이어서 고른다.** 기준선에선 그 컷이 화면에 떠서 그 뒤 chain이 다시
 * 도달형을 골랐다 — 같은 주에 임계를 함께 넘은 다른 컷(fresh)이 거기서 소화됐다. 예약은 사건을 안 만들어
 * chain이 없으니, 여기서 이어 고르지 않으면 그 컷이 fresh 창을 놓치고 쿨다운·감쇠로 유실된다
 * (실측: Y7 여름에 4건이 한 주에 넘는 판에서 서아 90이 2/168판 유실 — 이 루프로 0).
 */
export interface ReachPick { event: GameEvent | null; reserve: string[] }

export function pickReachForWeek(state: GameState, occurrenceWeek: number = state.week): ReachPick {
  const reserve: string[] = [];
  const slotTaken = reachSlotTaken(state);
  if (!slotTaken) {
    let probe = state;
    for (let winner = pickPacedReach(probe); winner; winner = pickPacedReach(probe)) {
      const anchor = winner.reach!.anchorWeek;
      if (anchor === undefined || occurrenceWeek >= anchor) return { event: winner, reserve };
      // 같은 컷을 두 번 고르면 소비 판정(consumedReachIds)이 깨진 것이다 — 무한 루프 대신 멈춘다.
      if (reserve.includes(winner.id)) break;
      reserve.push(winner.id);
      probe = { ...probe, reachReservations: { ...reservationsOf(probe), [winner.id]: { year: state.year, week: occurrenceWeek } } };
    }
  }
  // 예약분은 일반 도달형이 고를 게 없을 때만 띄운다 — 다른 NPC의 fresh 창(그 주에 못 뜨면 쿨다운으로 밀린다)을
  // 빼앗지 않는다. 학년 마지막 주의 cap 초과 비우기는 pickChainForWeek가 한다.
  if (!slotTaken && reserve.length === 0) {
    const due = getDueReservedReach(state, occurrenceWeek);
    if (due) return { event: due, reserve };
  }
  return { event: null, reserve };
}

export function applyReachReservation(state: GameState, ids: readonly string[], occurrenceWeek: number): void {
  if (ids.length === 0) return;
  const next = { ...reservationsOf(state) };
  for (const id of ids) next[id] = { year: state.year, week: occurrenceWeek };
  state.reachReservations = next;
}

// 페이싱 규칙(①~④) — 예약 여부와 무관하게 "이번 주 고를 컷". 예약된 컷은 소비된 것으로 본다(④).
function pickPacedReach(state: GameState): GameEvent | null {
  const firedIds = consumedReachIds(state);
  const cands = (GAME_EVENTS as GameEvent[]).map(e => romanceEventEligibility(e, state)).filter(e =>
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

/**
 * 이번 주 **띄울** 도달형 1개(예약은 버린다) — 진단 스크립트·단위 테스트용 조회.
 * 게임 루프는 pickReachForWeek/pickChainForWeek를 쓴다: 이걸 쓰면 앵커 컷의 예약이 증발한다.
 */
export function getReachForWeek(state: GameState): GameEvent | null {
  return pickReachForWeek(state).event;
}

/**
 * fixed/followup 이벤트 resolve 후 chain 픽 — store.resolveEventChain과 sim 미러(scripts/lib/y1-sim-resolve)가
 * **이 함수 하나**를 쓴다(같은 규칙을 두 자리에 쓰면 갈린다). eventsThisWeek = 그 발생주에 이미 뜬 사건 수.
 *   < 2 : 도달형 우선, 없으면 일반 조건부 1개(EVENT_DENSITY.chain)
 *   < 3 : 도달형 전용 추가 픽(milestone) — 학년 한정 reach가 마감 직전 누락되는 것 완화
 *   ≥ 3 : 없음. 단 학년 마지막 발생주엔 남은 예약을 비운다(전환이 예약을 묻지 않게).
 * 호출자는 늘 applyReachReservation(state, pick.reserve, occurrenceWeek)를 부른다(비어 있으면 아무 일 없음).
 */
export function pickChainForWeek(state: GameState, occurrenceWeek: number, eventsThisWeek: number): ReachPick {
  if (eventsThisWeek >= 3) {
    return { event: occurrenceWeek >= LAST_OCCURRENCE_WEEK ? getDueReservedReach(state, occurrenceWeek) : null, reserve: [] };
  }
  const reach = pickReachForWeek(state, occurrenceWeek);
  if (reach.event || eventsThisWeek >= 2) return reach;

  const candidates = pickConditionalCandidates(state);
  if (candidates.length === 0) return reach;
  if (seededRandom(state) < EVENT_DENSITY.chain) {
    return { event: candidates[Math.floor(seededRandom(state) * candidates.length)], reserve: reach.reserve };
  }
  return reach;
}

// getEventForWeek 결과 — 선택된 이벤트 + state patch (사이드이펙트를 호출자에 위임)
// patch 가 null 이 아니면 호출자가 명시적으로 newState 에 적용해야 함.
export type EventSelection = {
  event: GameEvent | null;
  patch: Partial<Pick<GameState, 'hardCrisisYears' | 'reachReservations'>> | null;
};

const noPatch = (event: GameEvent | null): EventSelection => ({ event, patch: null });

// 같은 슬롯 후보 경합의 단일 해소 규칙 — selectionPriority 내림차순(기본 0), 마지막은 배열 순서(stable).
// speakersTiebreak: 동순위에서 speakers 보유 우선(일회성 관계 이벤트 보호용 레거시 휴리스틱).
//   fixed 경로 전용 — followup/hardCrisis 경로는 기존 find(순수 배열 순서) 동작 보존을 위해 끈다.
// 주의: annual vs annual 경합은 우선순위로 풀 수 없다(한쪽이 영구히 가려짐) —
//   그 경우는 주차를 분리해야 한다 (선례: yuna-birthday W37→W38, minjae-birthday W7→W13,
//   elementary-semester2-start W25→W26 — class-president-2와 Y1 경합).
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
    (ANNUAL_REFIRE_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
  );
  const fixedEvent = pickByPriority(fixedCandidates);
  if (fixedEvent) return noPatch(fixedEvent);

  // 1. 후속 이벤트 체크 (100% 발동) — ANNUAL은 매년 재발동 허용
  // 복수 매칭 시 pickByPriority(speakers tiebreak 없음) — priority 미부여 시 기존 find와 완전 동일.
  const followup = pickByPriority(GAME_EVENTS.map(e => romanceEventEligibility(e, state)).filter(e =>
    FOLLOWUP_EVENT_IDS.has(e.id) &&
    e.condition && e.condition(state) &&
    (ANNUAL_REFIRE_IDS.has(e.id) || !state.events.some(prev => prev.id === e.id))
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
  // 앵커 컷을 예약하면 이 주의 도달형 슬롯은 쓴 것이고(페이싱 = 원래 떴을 주), 사건 슬롯은 아래로 흐른다.
  // 예약과 표시가 한 판정에서 같이 나올 수 있다(예약 뒤 이어 고른 컷) — 둘 다 patch로 넘긴다.
  const reach = pickReachForWeek(state);
  const after = (event: GameEvent | null): EventSelection => {
    if (reach.reserve.length === 0) return noPatch(event);
    const next = { ...(state.reachReservations ?? {}) };
    for (const id of reach.reserve) next[id] = { year: state.year, week: state.week };
    return { event, patch: { reachReservations: next } };
  };
  if (reach.event) return after(reach.event);

  // 4. 조건부 상태 이벤트 (피로/멘탈 등) — EVENT_DENSITY.conditional 확률
  // 위기 ID는 위에서 이미 처리했으므로 중복 제거
  const conditionalEvents = pickConditionalCandidates(state);
  if (conditionalEvents.length > 0 && seededRandom(state) < EVENT_DENSITY.conditional) {
    return after(conditionalEvents[Math.floor(seededRandom(state) * conditionalEvents.length)]);
  }

  // 5. 학교생활 랜덤 이벤트 — EVENT_DENSITY.schoolLife 확률
  // (방학엔 개별 이벤트 condition의 !isVacation으로 원천 차단 → 학기 주에만 발동)
  // 감축 이력: 0.7→0.5(~85%→~77%), 0.5→0.25(~79%→~66%, conditional 0.5→0.45와 함께).
  // 다중시드 sim 측정치는 scripts/sim/sim-event-frequency.ts 참고.
  const availableSchoolEvents = SCHOOL_LIFE_EVENTS.filter(e =>
    (!e.condition || e.condition(state)) &&
    !state.events.some(prev => prev.id === e.id && weeksSince(state, prev) < 6)
  );
  if (availableSchoolEvents.length > 0 && seededRandom(state) < EVENT_DENSITY.schoolLife) {
    return after(availableSchoolEvents[Math.floor(seededRandom(state) * availableSchoolEvents.length)]);
  }

  return after(null);
}
