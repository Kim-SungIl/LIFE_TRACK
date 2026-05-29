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
    && (!e.gender || e.gender === state.gender)
    && !state.talkEventsFired.includes(e.id),
  );
}

export function getAvailableHomeEvents(state: GameState): MiniTalkEvent[] {
  // 가정은 두 부모 강점 풀 합집합에서 픽업
  return PARENT_MINI_EVENTS.filter(e =>
    e.parentStrength
    && state.parents.includes(e.parentStrength)
    && !state.talkEventsFired.includes(e.id),
  );
}

// ===== 부모 친밀도 회고 톤 (학년말 일기장 변주) =====
export function getParentIntimacyTone(parentIntimacy: number): 'distant' | 'normal' | 'warm' {
  if (parentIntimacy < 30) return 'distant';
  if (parentIntimacy >= 70) return 'warm';
  return 'normal';
}
