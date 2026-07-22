// 관계 UI "신호" — 표시 레이어 전용 순수 함수.
// 친밀도 바(숫자)만으로 안 보이는 관계의 온도(방치/최근/임박)를 한 줄 신호로 노출한다.
// 밸런스 불변: 읽기만 하고 seededRandom 미호출. 설계: docs/strategy-signals-design.md (#4),
// 신호-2(정밀판): docs/cast-restoration-master-plan.md Wave 5.
import { GameState, NpcState } from './types';
import { GAME_EVENTS } from './events/data';
import { NPC_MINI_EVENTS } from './talkData/miniEvents';
import { absWeek } from './weekMath';

// 절대주차 SSOT는 ./weekMath로 이전 — 기존 import 경로(shopSystem/store/gameEngine) 유지 위해 재노출.
export { absWeek };

export type RelationSignal = { text: string; tone: 'warn' | 'good' | 'info' } | null;

// 다음 친밀도 임계 — 현재 학년에서 곧 열릴 도달형(reach) 컷의 tier 또는 mini 이벤트 intimacyMin 중,
// 현재 친밀도보다 높은 최소값. 없으면 null.
// 정밀판 핵심: 과거엔 smalltalk 티어 [30,50,70] 하드코딩이라 reach 곡선(예: jihun 고교 80·85·89)을
// 못 봤다. 이제 실제 데이터에서 조회해 "곧 열린다"가 정직해진다.
//  - reach: state.year와 같은 학년 컷만(과거 학년 컷 유실은 의도된 설계, 미래 학년은 아직 못 봄).
//           발동 기록은 state.events의 id로 판별(selection.getReachForWeek와 동일 기준).
//           성별은 reach condition 공통(femaleChoices로만 분기)이라 필터 불요.
//  - mini: yearMin/yearMax·gender 통과 + 미발동(talkEventsFired)인 것만.
export function nextIntimacyThreshold(npc: NpcState, state: GameState): number | null {
  if (!npc.met) return null; // 호출 경로(met 필터)가 보장하지만 직접 호출 대비 방어적으로 명시.
  let best: number | null = null;
  const consider = (t: number) => { if (t > npc.intimacy && (best === null || t < best)) best = t; };

  // 발동 기록 — selection.getReachForWeek와 동일 SSOT(state.events의 reach id, state.talkEventsFired)를 읽는다.
  const firedReach = new Set(state.events.filter(e => e.reach).map(e => e.id));
  const firedMini = new Set(state.talkEventsFired);

  // reach 후보: 친밀도를 그 tier로 올린 가상(probe) state로 condition을 직접 평가한다.
  // year·isVacation·week 등 비-친밀도 게이트를 condition(SSOT) 그대로 반영 → 메타 재현 없이 정합.
  // (예: 방학 중 학기-전용 !isVacation 컷, 다른 학년 컷을 "곧 열린다"로 잘못 띄우지 않는다.)
  for (const e of GAME_EVENTS) {
    if (!e.reach || e.reach.npc !== npc.id || e.reach.tier <= npc.intimacy || firedReach.has(e.id) || !e.condition) continue;
    const tier = e.reach.tier;
    const probe: GameState = { ...state, npcs: state.npcs.map(n => n.id === npc.id ? { ...n, intimacy: tier } : n) };
    if (e.condition(probe)) consider(tier);
  }
  // mini는 reach와 발동 경로가 다르며 isVacation 게이트가 없다(talkSystem.getAvailableNpcEvents와 동일 필터).
  for (const m of NPC_MINI_EVENTS) {
    if (m.npcId !== npc.id || m.intimacyMin === undefined) continue;
    if (m.yearMin !== undefined && state.year < m.yearMin) continue;
    if (m.yearMax !== undefined && state.year > m.yearMax) continue;
    if (m.gender !== undefined && m.gender !== state.gender) continue;
    if (firedMini.has(m.id)) continue;
    consider(m.intimacyMin);
  }
  return best;
}

// ===== 전출(전학으로 떠난) 잔상 =====
// 지정 "작별" 이벤트가 발동한 NPC는 관계 패널에서 "떠난 자리"(흐린 잔상)로 표시한다.
// 감지 = state.events에 그 이벤트 id 존재(발동 기록 SSOT, reach 신호와 동일 방식).
// 대상은 "떠난 뒤 다시 등장하지 않는" NPC만:
//  - doyun: Y2 W2 학군 이사(school-split) 후 재등장 이벤트 전무 → clean transfer-out.
//  - yuna 제외: 애초에 전출하지 않는다. Y3 예고 전학 "소문"은 Y4 clearing-locker에서 "안 감(잔류)"으로
//    해소되고, 고교(Y5~7 yuna-hs-*, yuna-smile) 내내 같은 학교에 재학 → 떠나는 NPC가 아니다.
//  - haeun 제외: Y3 졸업 후 haeun-reunion으로 재회 → 영구 전출 아님. junha 제외: 전입(전학 옴).
const NPC_DEPARTURE: Record<string, { eventId: string; note: string }> = {
  doyun: { eventId: 'doyun-school-split', note: '다른 학교로 떠난 뒤' },
};

export function npcDeparture(npc: NpcState, state: GameState): { note: string } | null {
  const d = NPC_DEPARTURE[npc.id];
  if (!d) return null;
  return state.events.some(e => e.id === d.eventId) ? { note: d.note } : null;
}

// ===== 재적(같은 학교) 여부 — 주말 동행 후보 필터 =====
// 전학 가거나 졸업해서 지금 같은 학교에 없는 친구와 주말 동행이 잡히는 디제시스 붕괴 방지
// (밸런스 검수 ⑥). 관계 패널 노출과는 별개 — 떠난 친구도 패널엔 잔상으로 남는다(#331).
//  - doyun: 전출 이벤트 발동 후 부재 (npcDeparture와 동일 SSOT).
//  - haeun: 1년 위 선배. Y4(중학 졸업 뒤 공백)·Y7(고교 졸업 뒤)은 다른 학교/대학 —
//    reach 사다리(Y2·Y3 / Y5·Y6)와 일치. 재회(haeun-reunion) 전인 Y5도 같은 고교 재학이라 재적.
export function isNpcEnrolled(npc: NpcState, state: GameState): boolean {
  if (npcDeparture(npc, state)) return false;
  if (npc.id === 'haeun') return state.year !== 4 && state.year !== 7;
  return true;
}

// 우선순위: 임박 > 방치 > 최근 (하나만 노출).
// 임박: 다음 실제 도달 임계(nextIntimacyThreshold) 5점 이내 아래 → 곧 더 깊은 무언가가 열림.
// 방치/최근: lastInteractionWeek가 있을 때만. 감쇠 하한 20·약함이라 "잃는다"가 아니라 "멀어지는 중" 톤.
export function relationshipSignal(npc: NpcState, state: GameState): RelationSignal {
  const th = nextIntimacyThreshold(npc, state);
  if (th !== null && npc.intimacy >= th - 5 && npc.intimacy < th) {
    return { text: '✨ 곧 더 가까워질 듯', tone: 'good' };
  }
  if (npc.lastInteractionWeek !== undefined) {
    const weeksSince = absWeek(state.year, state.week) - npc.lastInteractionWeek;
    if (weeksSince >= 8 && npc.intimacy > 20) return { text: '🍂 요즘 뜸하다', tone: 'warn' };
    if (weeksSince <= 2) return { text: '💛 최근 함께함', tone: 'good' };
  }
  return null;
}
