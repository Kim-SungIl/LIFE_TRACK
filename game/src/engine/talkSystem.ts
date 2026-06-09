// ===== Phase 2.1 말걸기 미니 이벤트 — 로직 모듈 =====
// NPC/부모 모달에서 "말 걸기" 시 발동되는 가벼운 미니 이벤트 픽업/필터/RNG.
// 누적 확률(pressure) 시스템 — 안 만나면 점점 차오르고, 한 번 발동하면 0으로 리셋.
// 1회만 발동(A안) — 이미 발동한 이벤트는 talkEventsFired에 기록되어 풀에서 제외.
//
// 데이터 풀(NPC_MINI_EVENTS, PARENT_MINI_EVENTS, 잡담/정적 대사)은 talkData.ts.
// 데이터/로직 분리 P3-9 (2026-05-29).

import { GameState, ParentStrength } from './types';
import { seededRandom } from './rng';
import { getSchoolLevel } from './backgrounds';
import {
  MiniTalkEvent,
  GenderedPool,
  SmalltalkBucket,
  NPC_MINI_EVENTS,
  PARENT_MINI_EVENTS,
  PARENT_STATIC_DIALOGUES,
  NPC_SMALLTALK,
  PARENT_SMALLTALK,
} from './talkData';

// 외부에서 talkSystem 경로로 MiniTalkEvent 타입을 import하는 기존 코드 호환.
export type { MiniTalkEvent } from './talkData';

export function getParentStaticDialogue(state: GameState, strength: ParentStrength): string {
  const pool = PARENT_STATIC_DIALOGUES[strength];
  const idx = Math.floor(seededRandom(state) * pool.length);
  return pool[idx];
}

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

export function getHomeSmalltalk(state: GameState): string {
  // 가정은 단일 엔티티 — 두 부모 강점 풀에서 RNG로 한 줄 픽
  const pools = state.parents
    .map(p => PARENT_SMALLTALK[p] ?? [])
    .flat();
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

// ===== 부모 친밀도 회고 톤 (학년말 일기장 변주) =====
export function getParentIntimacyTone(parentIntimacy: number): 'distant' | 'normal' | 'warm' {
  if (parentIntimacy < 30) return 'distant';
  if (parentIntimacy >= 70) return 'warm';
  return 'normal';
}
