// ===== Phase 2.1 말걸기 미니 이벤트 — 로직 모듈 =====
// NPC/부모 모달에서 "말 걸기" 시 발동되는 가벼운 미니 이벤트 픽업/필터/RNG.
// 누적 확률(pressure) 시스템 — 안 만나면 점점 차오르고, 한 번 발동하면 0으로 리셋.
// 1회만 발동(A안) — 이미 발동한 이벤트는 talkEventsFired에 기록되어 풀에서 제외.
//
// 데이터 풀(NPC_MINI_EVENTS, PARENT_MINI_EVENTS, 잡담/정적 대사)은 talkData.ts.
// 데이터/로직 분리 P3-9 (2026-05-29).

import { GameState } from './types';
import { seededRandom } from './rng';
import { getSchoolLevel } from './backgrounds';
import {
  MiniTalkEvent,
  ParentClimaxEvent,
  GenderedPool,
  SmalltalkBucket,
  NPC_MINI_EVENTS,
  PARENT_MINI_EVENTS,
  PARENT_CLIMAX_EVENTS,
  NPC_SMALLTALK,
  PARENT_SMALLTALK,
} from './talkData';

// 외부에서 talkSystem 경로로 MiniTalkEvent 타입을 import하는 기존 코드 호환.
export type { MiniTalkEvent } from './talkData';

function pickRandomLine(state: GameState, pool: string[]): string {
  if (pool.length === 0) return '오늘은 별 다른 일 없이 지나갔다.';
  const idx = Math.floor(seededRandom(state) * pool.length);
  return pool[idx];
}

export function getNpcSmalltalk(state: GameState, npcId: string): string {
  const entry = NPC_SMALLTALK[npcId];
  if (!entry) return pickRandomLine(state, []);
  const intimacy = state.npcs.find(n => n.id === npcId)?.intimacy ?? 0;
  const level = getSchoolLevel(state.year); // Y1=elementary / Y2~Y4=middle / Y5~Y7=high
  // common + 현재 성별 풀을 합침 (events.ts 분기와 톤 일치)
  const genderLines = (p?: GenderedPool): string[] =>
    p ? [...(p.common ?? []), ...(state.gender === 'female' ? p.female ?? [] : p.male ?? [])] : [];
  // 친밀도가 오를수록 warm/close/deep 티어의 "현재 학교급" 셀을 base 위에 누적.
  const tierLines = (b?: SmalltalkBucket): string[] => genderLines(b?.[level]);
  const pool = [
    ...genderLines(entry),
    ...(intimacy >= 30 ? tierLines(entry.warm) : []),
    ...(intimacy >= 50 ? tierLines(entry.close) : []),
    ...(intimacy >= 70 ? tierLines(entry.deep) : []),
  ];
  return pickRandomLine(state, pool);
}

// 고3(Y7) 입시 시점 — getExamSchedule(7)의 수능=35주차 기준.
//   early: 원서 전(~27주, 3월~여름) — 과정·각오·건강 톤
//   rush:  수시 원서~수능(28~35주) — 수시/정시/긴장 톤
//   after: 수능 후(36주~, 면접·정시·결과) — 마무리·결과 톤
// senior 풀(시점 무관)에 위 시점 풀을 누적해, "수능 끝나면"·"수시 카드" 같은 시점 의존
// 대사가 봄에 뜨던 모순(QA Y7 [상])을 막는다.
export function getSeniorPhase(week: number): 'early' | 'rush' | 'after' {
  if (week <= 27) return 'early';
  if (week <= 35) return 'rush';
  return 'after';
}

export function getHomeSmalltalk(state: GameState): string {
  // 가정은 단일 엔티티 — 두 부모 강점 풀에서 RNG로 한 줄 픽.
  // 학교급(elementary/middle/high)별 셀 + 고3(Y7) senior(시점 무관) + 입시 시점별 풀을
  // common 위에 누적해 초6과 고3, 또 고3 안에서도 봄/수능기/수능후 톤이 달라지게 한다.
  const level = getSchoolLevel(state.year); // Y1=elementary / Y2~Y4=middle / Y5~Y7=high
  const isSenior = state.year === 7;        // 고3 — high 위에 senior + 시점 풀 추가 누적
  const phase = isSenior ? getSeniorPhase(state.week) : null;
  const pools = state.parents.flatMap(p => {
    const pool = PARENT_SMALLTALK[p];
    if (!pool) return [];
    return [
      ...(pool.common ?? []),
      ...(pool[level] ?? []),
      ...(isSenior ? pool.senior ?? [] : []),
      ...(phase === 'early' ? pool.seniorEarly ?? [] : []),
      ...(phase === 'rush' ? pool.seniorRush ?? [] : []),
      ...(phase === 'after' ? pool.seniorAfter ?? [] : []),
    ];
  });
  return pickRandomLine(state, pools);
}

// ===== 풀 필터 — store에서 사전 결정 결과로 미니 이벤트 픽업 =====
export function getAvailableNpcEvents(state: GameState, npcId: string): MiniTalkEvent[] {
  const npc = state.npcs.find(n => n.id === npcId);
  if (!npc) return [];
  return NPC_MINI_EVENTS.filter(e =>
    e.npcId === npcId
    && (!e.intimacyMin || npc.intimacy >= e.intimacyMin)
    && (!e.yearMin || state.year >= e.yearMin)
    && (!e.yearMax || state.year <= e.yearMax)
    && (!e.gender || e.gender === state.gender)
    && !state.talkEventsFired.includes(e.id),
  );
}

// Phase 2A: 부모 미니이벤트는 영구 1회가 아니라 쿨다운 후 재발동.
// ±선택지로 하강압력을 주려면 같은 이벤트가 다시 떠야 하므로(긍정만 1회면 인플레),
// parentEventsFired의 마지막 발동 주차로 쿨다운을 판정하고, 가장 오래전(또는 미발동) 이벤트를
// 우선해 두 강점 이벤트가 자연스럽게 번갈아 나오게 한다(로테이션).
export const PARENT_EVENT_COOLDOWN_WEEKS = 4;

function lastFiredWeek(state: GameState, id: string): number {
  const recs = (state.parentEventsFired ?? []).filter(f => f.id === id);
  return recs.length ? Math.max(...recs.map(f => f.week)) : -Infinity;
}

export function getAvailableHomeEvents(state: GameState): MiniTalkEvent[] {
  const now = state.totalWeeksPlayed ?? 0;
  // 가정은 두 부모 강점 풀 합집합 — 쿨다운 지난 것만 가용
  const avail = PARENT_MINI_EVENTS.filter(e =>
    e.parentStrength
    && state.parents.includes(e.parentStrength)
    && (!e.yearMin || state.year >= e.yearMin)   // NPC 경로와 동일하게 학년 게이트 적용(진학 이벤트가 초등 발동 방지)
    && (!e.yearMax || state.year <= e.yearMax)
    && now - lastFiredWeek(state, e.id) >= PARENT_EVENT_COOLDOWN_WEEKS,
  );
  // 로테이션: 가장 오래전 발동(미발동 = -Infinity가 최우선) 순 → available[0]이 자연 교대
  return avail.sort((a, b) => lastFiredWeek(state, a.id) - lastFiredWeek(state, b.id));
}

// ===== Phase 4B — 강점별 "절정 순간" 트리거 =====
// 복합 게이트(검토 합의): 친밀도 자격 + 해당 강점 긍정 태그 누적 + 연령 창 + 평생 1회.
// 친밀도 단독 임계는 금지(숨은 스탯 그라인딩) — 누적 행동이 "쌓을 이유"가 되어야 한다.
export const PARENT_CLIMAX_INTIMACY_GATE = 60;  // 자격(충분히 쌓은 관계). warm 전용 아님 — "착한 플레이만 보상" 방지
export const PARENT_CLIMAX_TAG_THRESHOLD = 2;   // 해당 강점 긍정 태그 누적 하한
export const PARENT_CLIMAX_RESCUE_WEEK = 36;    // 고3 수능 후(getExamSchedule(7) 수능=35주) 구제 발동창 진입
export const PARENT_CLIMAX_RESCUE_GATE = 45;    // 구제 발동 시 친밀도 하한(normal+). distant는 미발동이 서사

// 이번 시점에 발동 가능한 절정 1건(우선 강점 순)을 반환. 없으면 null.
//  - 일반: 친밀도≥GATE AND 긍정태그≥THRESHOLD AND year≥climaxYearMin
//  - 구제: 고3 수능 후 미발동분은 누적 무시, 친밀도≥RESCUE_GATE면 발동(놓침 방지)
export function getEligibleParentClimax(state: GameState): ParentClimaxEvent | null {
  const fired = state.parentClimaxFired ?? [];
  const pi = state.parentIntimacy ?? 50;
  const tags = state.parentPositiveTags ?? {};
  const isRescue = state.year === 7 && state.week >= PARENT_CLIMAX_RESCUE_WEEK;

  for (const strength of state.parents) {
    if (fired.includes(strength)) continue;
    const c = PARENT_CLIMAX_EVENTS.find(e => e.parentStrength === strength);
    if (!c) continue;
    if (state.year < c.climaxYearMin) continue;
    if (isRescue) {
      if (pi >= PARENT_CLIMAX_RESCUE_GATE) return c;
    } else if (pi >= PARENT_CLIMAX_INTIMACY_GATE
        && (tags[c.triggerTag] ?? 0) >= PARENT_CLIMAX_TAG_THRESHOLD) {
      return c;
    }
  }
  return null;
}

// ===== 부모 친밀도 회고 톤 (학년말 일기장 변주) =====
export function getParentIntimacyTone(parentIntimacy: number): 'distant' | 'normal' | 'warm' {
  if (parentIntimacy < 30) return 'distant';
  if (parentIntimacy >= 70) return 'warm';
  return 'normal';
}
