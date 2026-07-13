/**
 * Y1 시뮬·QA 스크립트 공용 — store.resolveEvent 와 동일한 이벤트 해결
 */
import {
  getFollowupForWeek,
  getConditionalForWeek,
  getMilestoneForWeek,
  FOLLOWUP_EVENT_IDS,
  DIRECT_SEQUEL_IDS,
  type GameEvent,
} from '../../src/engine/events';
import { applyMemorySlotFromChoice, applyMemorySlotFromMiniTalk } from '../../src/engine/memorySystem';
import { scaleStatChange, scaleIntimacyChange } from '../../src/engine/gameEngine';
import { applyParentIntimacyDelta } from '../../src/engine/parentIntimacy';
import { absWeek } from '../../src/engine/weekMath';
import { getAvailableNpcEvents, getNpcSmalltalk } from '../../src/engine/talkSystem';
import { cloneGameState } from '../../src/engine/stateClone';
import type { GameState } from '../../src/engine/types';

export function resolveEventLikeStore(state: GameState, choiceIndex: number): GameState {
  const s = state;
  if (!s.currentEvent) return state;

  const resolvedLocation = s.currentEvent.location;
  const isFemale = s.gender === 'female';
  const choiceList = (isFemale && s.currentEvent.femaleChoices)
    ? s.currentEvent.femaleChoices
    : s.currentEvent.choices;
  const choice = choiceList[choiceIndex];
  if (!choice) return state;

  const newState = JSON.parse(JSON.stringify(s)) as GameState;

  // 이벤트 발생 주(occurrence week). processWeek가 currentEvent.week=N을 박은 뒤 week++(→N+1)이라
  // newState.week은 이미 다음 주다. store.resolveEvent가 occurrenceWeek로 기록·체인캡·냉각을 하는 것과 맞춘다.
  const occurrenceWeek = newState.currentEvent!.week ?? newState.week;

  // 스탯 효과 — store.applyChoiceOutcome와 동일하게 구간감쇠(scaleStatChange) 적용 (게임 본체 일치).
  for (const [key, val] of Object.entries(choice.effects)) {
    const k = key as keyof typeof newState.stats;
    const scaled = scaleStatChange(val as number, newState.stats[k]);
    newState.stats[k] = Math.max(0, Math.min(100, newState.stats[k] + scaled));
  }

  if (choice.fatigueEffect) {
    newState.fatigue = Math.max(0, Math.min(100, newState.fatigue + choice.fatigueEffect));
  }

  if (choice.moneyEffect) {
    newState.money = Math.round((newState.money + choice.moneyEffect) * 10) / 10;
    if (newState.money < 0) newState.money = 0;
  }

  if (choice.npcEffects) {
    for (const ne of choice.npcEffects) {
      const npc = newState.npcs.find(n => n.id === ne.npcId);
      if (npc) {
        // store.applyChoiceOutcome와 동일하게 구간감쇠(scaleIntimacyChange) 적용 — raw 가산 시 tier 게이트 조기도달.
        const scaled = scaleIntimacyChange(ne.intimacyChange, npc.intimacy);
        npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + scaled));
        if (scaled > 0) npc.lastInteractionWeek = absWeek(newState.year, occurrenceWeek);
        npc.met = true;
      }
    }
  }

  const allBranchChoices = [
    ...newState.currentEvent!.choices,
    ...(newState.currentEvent!.femaleChoices || []),
  ];
  for (const c of allBranchChoices) {
    if (c.npcEffects) {
      for (const ne of c.npcEffects) {
        const npc = newState.npcs.find(n => n.id === ne.npcId);
        if (npc) npc.met = true;
      }
    }
  }

  if (newState.currentEvent!.speakers) {
    for (const npcId of newState.currentEvent!.speakers) {
      const npc = newState.npcs.find(n => n.id === npcId);
      if (npc) npc.met = true;
    }
  }

  if (choice.timeCost) newState.eventTimeCost = choice.timeCost;
  if (choice.trackSelect) newState.track = choice.trackSelect;

  // store.applyChoiceOutcome와 동일: 이벤트 선택의 부모 친밀도 반응 + 그 주 평균회귀 면제 플래그.
  if (choice.parentEffect) {
    applyParentIntimacyDelta(newState, choice.parentEffect.baseDelta, choice.parentEffect.tag);
    newState.actedWithParentThisWeek = true;
  }

  applyMemorySlotFromChoice(newState, newState.currentEvent!, choiceIndex, choice);

  if (choice.addBuff) {
    if (!newState.activeBuffs) newState.activeBuffs = [];
    newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
    newState.activeBuffs.push({ ...choice.addBuff });
  }

  const recordedEvent: Partial<GameEvent> = { ...newState.currentEvent! };
  delete recordedEvent.condition;
  newState.events.push({
    ...(recordedEvent as GameEvent),
    resolvedChoice: choiceIndex,
    week: occurrenceWeek,
    year: newState.year,
    resolvedFemale: isFemale && !!s.currentEvent!.femaleChoices,
  });

  if (newState.weekLog) {
    newState.weekLog.messages.push(`📖 ${choice.message}`);
  }

  newState.currentEvent = null;

  const followupFiredThisWeek = newState.events.some(
    prev => prev.week === occurrenceWeek && prev.year === newState.year
      && FOLLOWUP_EVENT_IDS.has(prev.id) && !DIRECT_SEQUEL_IDS.has(prev.id),
  );
  const followup = followupFiredThisWeek ? null : getFollowupForWeek(newState, resolvedLocation);
  if (followup) {
    // 체인 이벤트도 occurrenceWeek 유지 — store.resolveEventChain이 {...ev, week: occurrenceWeek}로 세팅.
    newState.currentEvent = { ...followup, week: occurrenceWeek };
    newState.phase = 'event';
  } else {
    // followup 없으면 conditional chain 시도 — store.resolveEvent와 동일 로직
    // cap=2 (일반) / cap=3 (milestone 잔여 시) — 학년 한정 도달형 누락 방지
    const eventsThisWeek = newState.events.filter(
      prev => prev.week === occurrenceWeek && prev.year === newState.year,
    ).length;
    let chainPick: GameEvent | null = null;
    if (eventsThisWeek < 2) {
      chainPick = getConditionalForWeek(newState);
    } else if (eventsThisWeek < 3) {
      chainPick = getMilestoneForWeek(newState);
    }
    if (chainPick) {
      newState.currentEvent = { ...chainPick, week: occurrenceWeek };
      newState.phase = 'event';
    } else {
      newState.phase = 'weekday';
    }
  }

  return newState;
}

/**
 * store.talkToNpc(라인 369-414) 순수 미러 — 미니톡 발동 또는 잡담.
 * 미니 이벤트는 선택지 없이 effects 즉시 적용. 발동 여부는 talkEventsFired 길이 변화로 판별.
 */
export function talkToNpcLikeStore(state: GameState, npcId: string): GameState {
  const s = state;
  const npc = s.npcs.find(n => n.id === npcId);
  if (!npc) return state;

  // 친밀도 30+ & 이번 주 pending일 때만 미니 이벤트 후보 — 그 외엔 잡담 한 줄
  const eligible = npc.intimacy >= 30 && s.npcEventPendingThisWeek;
  if (eligible) {
    const available = getAvailableNpcEvents(s, npcId);
    if (available.length > 0) {
      const newState = cloneGameState(s);
      const ev = available[0];
      if (ev.effects.stats) {
        for (const [k, v] of Object.entries(ev.effects.stats)) {
          const key = k as keyof typeof newState.stats;
          newState.stats[key] = Math.max(0, Math.min(100, newState.stats[key] + (v as number)));
        }
      }
      if (ev.effects.fatigue) {
        newState.fatigue = Math.max(0, Math.min(100, newState.fatigue + ev.effects.fatigue));
      }
      if (ev.effects.money) {
        newState.money = Math.round((newState.money + ev.effects.money) * 10) / 10;
        if (newState.money < 0) newState.money = 0;
      }
      if (ev.effects.intimacy && ev.npcId) {
        const target = newState.npcs.find(n => n.id === ev.npcId);
        if (target) target.intimacy = Math.max(0, Math.min(100, target.intimacy + ev.effects.intimacy));
      }
      applyMemorySlotFromMiniTalk(newState, ev.id, ev.memorySlotDraft);
      newState.talkEventsFired = [...newState.talkEventsFired, ev.id];
      newState.talkEventPressure = 0;
      newState.npcEventPendingThisWeek = false;
      // store.talkToNpc와 동일: 말건 상대는 이번 주 상호작용으로 기록(관계 냉각 신호 정합).
      { const t = newState.npcs.find(n => n.id === npcId); if (t) t.lastInteractionWeek = absWeek(newState.year, newState.week); }
      return newState;
    }
  }
  // 잡담 — RNG 진행 위해 새 state로 push (getNpcSmalltalk가 seededRandom mutate)
  const newState = cloneGameState(s);
  getNpcSmalltalk(newState, npcId);
  // 잡담도 상호작용(친밀도 변화 0이라 lastInteractionWeek로만 "최근 함께함"이 잡힘) — store L408 미러.
  { const t = newState.npcs.find(n => n.id === npcId); if (t) t.lastInteractionWeek = absWeek(newState.year, newState.week); }
  return newState;
}
