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
import { scaleStatChange } from '../../src/engine/gameEngine';
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
        npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange));
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
    week: newState.week,
    year: newState.year,
    resolvedFemale: isFemale && !!s.currentEvent!.femaleChoices,
  });

  if (newState.weekLog) {
    newState.weekLog.messages.push(`📖 ${choice.message}`);
  }

  newState.currentEvent = null;

  const followupFiredThisWeek = newState.events.some(
    prev => prev.week === newState.week && prev.year === newState.year
      && FOLLOWUP_EVENT_IDS.has(prev.id) && !DIRECT_SEQUEL_IDS.has(prev.id),
  );
  const followup = followupFiredThisWeek ? null : getFollowupForWeek(newState, resolvedLocation);
  if (followup) {
    newState.currentEvent = followup;
    newState.phase = 'event';
  } else {
    // followup 없으면 conditional chain 시도 — store.resolveEvent와 동일 로직
    // cap=2 (일반) / cap=3 (milestone 잔여 시) — 학년 한정 도달형 누락 방지
    const eventsThisWeek = newState.events.filter(
      prev => prev.week === newState.week && prev.year === newState.year,
    ).length;
    let chainPick: GameEvent | null = null;
    if (eventsThisWeek < 2) {
      chainPick = getConditionalForWeek(newState);
    } else if (eventsThisWeek < 3) {
      chainPick = getMilestoneForWeek(newState);
    }
    if (chainPick) {
      newState.currentEvent = chainPick;
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
      return newState;
    }
  }
  // 잡담 — RNG 진행 위해 새 state로 push (getNpcSmalltalk가 seededRandom mutate)
  const newState = cloneGameState(s);
  getNpcSmalltalk(newState, npcId);
  return newState;
}
