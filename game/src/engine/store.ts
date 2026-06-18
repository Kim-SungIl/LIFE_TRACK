import { create } from 'zustand';
import { GameState, GameEvent, EventChoice, ParentStrength } from './types';
import { createInitialState, processWeek, getWeekInfo, scaleIntimacyChange, scaleStatChange, applyYearTransition } from './gameEngine';
import { migrateLoadedState } from './stateMigration';
import { cloneGameState } from './stateClone';
import { ShopItem, applyItemEffects } from './shopSystem';
import { getFollowupForWeek, getConditionalForWeek, getMilestoneForWeek, FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS } from './events';
import { applyMemorySlotFromChoice, applyMemorySlotFromMiniTalk, recordMilestoneForYear } from './memorySystem';
import { MiniTalkEvent, getAvailableNpcEvents, getAvailableHomeEvents, getEligibleParentClimax, getNpcSmalltalk, getHomeSmalltalk } from './talkSystem';
import { PARENT_MINI_EVENTS } from './talkData';
import { applyParentIntimacyDelta } from './parentIntimacy';

// 가시 효과(스탯/피로/돈) 적용 헬퍼 — 미니이벤트/선택지 공통.
function applyVisibleTalkEffects(
  state: GameState,
  effects: { stats?: Partial<GameState['stats']>; fatigue?: number; money?: number } | undefined,
): void {
  if (!effects) return;
  if (effects.stats) {
    for (const [k, v] of Object.entries(effects.stats)) {
      const key = k as keyof GameState['stats'];
      state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + (v as number)));
    }
  }
  if (effects.fatigue) {
    state.fatigue = Math.max(0, Math.min(100, state.fatigue + effects.fatigue));
  }
  if (effects.money) {
    state.money = Math.round((state.money + effects.money) * 10) / 10;
    if (state.money < 0) state.money = 0;
  }
}

// 부모 미니이벤트 발동 기록(쿨다운/로테이션용) — id당 마지막 발동 주차만 유지.
function recordParentEventFired(state: GameState, id: string): void {
  const prev = (state.parentEventsFired ?? []).filter(f => f.id !== id);
  state.parentEventsFired = [...prev, { id, week: state.totalWeeksPlayed ?? 0 }];
}

// 말걸기 결과 — 사전 결정 모델
// - 'event': 이번 주 사전 결정에서 발동 + 풀에 가용 이벤트 있음 → 미니 이벤트 발동
// - 'smalltalk': 그 외 모든 경우 → 잠깐의 잡담 한 줄 (클릭마다 다른 라인)
export type TalkActionResult =
  | { kind: 'event'; event: MiniTalkEvent }
  | { kind: 'smalltalk'; line: string };

const SAVE_KEY = 'lifetrack_save';
const SAVE_VERSION = 1;

interface SaveData {
  version: number;
  state: GameState;
  savedAt: string;
}

function saveToStorage(state: GameState) {
  try {
    const data: SaveData = { version: SAVE_VERSION, state, savedAt: new Date().toISOString() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage full or unavailable — silently skip */ }
}

export function loadFromStorage(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION || !data.state) return null;
    return data;
  } catch {
    return null;
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

interface GameStore {
  state: GameState | null;
  npcActivityMap: Record<string, string>; // activityId -> npcId
  startGame: (gender: 'male' | 'female', parents: [ParentStrength, ParentStrength], options?: { useReducedRecovery?: boolean }) => void;
  loadSavedGame: () => boolean;
  resetGame: () => void;
  setRoutine: (slot2: string | null, slot3: string | null) => void;
  setWeekendChoices: (choices: string[]) => void;
  setVacationChoices: (choices: string[]) => void;
  setNpcActivityMap: (map: Record<string, string>) => void;
  advanceWeek: () => void;
  resolveEvent: (choiceIndex: number) => void;
  advanceFromYearEnd: () => void;
  setPhase: (phase: GameState['phase']) => void;
  buyItem: (item: ShopItem, targetNpcId?: string) => string[];
  // Phase 2.1 말걸기 — 결과(event/smalltalk) 반환, 효과는 즉시 적용
  // 무한 클릭 가능 — 사전 결정에 따라 이벤트가 떨어지거나 잡담 한 줄
  talkToNpc: (npcId: string) => TalkActionResult;
  talkToHome: () => TalkActionResult;
  // Phase 2A — 부모 ±선택지 이벤트의 선택 적용 (talkToHome이 띄운 choice 이벤트에 대해 호출)
  resolveParentTalkChoice: (eventId: string, choiceIdx: number) => void;
  // ===== 개발 환경 한정 디버그 메서드 (DebugPanel에서 호출) =====
  debugAdvanceToYearEnd: () => void;
  debugSkipToEnding: () => void;
  debugSetStat: (key: 'academic' | 'social' | 'talent' | 'mental' | 'health', value: number) => void;
  debugForceParentEvent: () => void;
}

// ===== resolveEvent 단계 헬퍼 (순수 추출 — state 직접 mutate, 동작 보존) =====

// 선택 결과 적용: 스탯(구간감쇠)/피로/용돈 + 이벤트 등장 NPC met + timeCost/문이과/부모 친밀도.
function applyChoiceOutcome(state: GameState, event: GameEvent, choice: EventChoice): void {
  // 스탯 효과 — 구간별 감쇠(scaleStatChange)로 활동과 동일하게 고구간 캡 적용 (QA C3 근본원인).
  for (const [key, val] of Object.entries(choice.effects)) {
    const k = key as keyof typeof state.stats;
    const scaled = scaleStatChange(val as number, state.stats[k]);
    state.stats[k] = Math.max(0, Math.min(100, state.stats[k] + scaled));
  }
  // 피로 효과
  if (choice.fatigueEffect) {
    state.fatigue = Math.max(0, Math.min(100, state.fatigue + choice.fatigueEffect));
  }
  // 용돈 효과 — 음수 방지
  if (choice.moneyEffect) {
    state.money = Math.round((state.money + choice.moneyEffect) * 10) / 10;
    if (state.money < 0) state.money = 0;
  }
  // NPC 친밀도 효과 + 만남 처리 (구간별 감쇠)
  if (choice.npcEffects) {
    for (const ne of choice.npcEffects) {
      const npc = state.npcs.find(n => n.id === ne.npcId);
      if (npc) {
        const scaled = scaleIntimacyChange(ne.intimacyChange, npc.intimacy);
        npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + scaled));
        npc.met = true;
      }
    }
  }
  // 이벤트에 등장한 모든 NPC도 met (선택지 무관, 남/여 분기 모두)
  const allBranchChoices = [...event.choices, ...(event.femaleChoices || [])];
  for (const c of allBranchChoices) {
    if (c.npcEffects) {
      for (const ne of c.npcEffects) {
        const npc = state.npcs.find(n => n.id === ne.npcId);
        if (npc) npc.met = true;
      }
    }
  }
  // speakers 등장 NPC도 met (대사 전용 등장도 만남으로 인정)
  if (event.speakers) {
    for (const npcId of event.speakers) {
      const npc = state.npcs.find(n => n.id === npcId);
      if (npc) npc.met = true;
    }
  }
  // 시간 소모: 다음 주 루틴/주말 슬롯 감소
  if (choice.timeCost) {
    state.eventTimeCost = choice.timeCost;
  }
  // 문/이과 선택 (Y6 W1 이벤트 전용)
  if (choice.trackSelect) {
    state.track = choice.trackSelect;
  }
  // Phase 4C: 이벤트 선택의 부모 친밀도 반응 — 단일 진입점. 그 주는 평균회귀 면제.
  if (choice.parentEffect) {
    applyParentIntimacyDelta(state, choice.parentEffect.baseDelta, choice.parentEffect.tag);
    state.actedWithParentThisWeek = true;
  }
}

// 이벤트 기록 — condition(함수)은 JSON 직렬화 손실 방지 위해 제거, 발생주차는 occurrenceWeek로 통일.
function recordResolvedEvent(state: GameState, event: GameEvent, choiceIndex: number, occurrenceWeek: number, isFemale: boolean): void {
  const recordedEvent: Partial<GameEvent> = { ...event };
  delete recordedEvent.condition;
  state.events.push({
    ...(recordedEvent as GameEvent),
    resolvedChoice: choiceIndex,
    week: occurrenceWeek,
    year: state.year,
    resolvedFemale: isFemale && !!event.femaleChoices,
  });
}

// 이벤트 종료 후 연쇄: followup → conditional/milestone chain(주당 cap) → 학년전환/주간결산 분기.
// occurrenceWeek = 발생주차(currentEvent.week, clone 이전 원본). location도 clone 이전 원본을 받는다.
function resolveEventChain(state: GameState, location: string | undefined, occurrenceWeek: number): void {
  // 가드: 같은 주(week+year)에 followup이 이미 발동했으면 추가 발동 안 함 (DIRECT_SEQUEL은 제외).
  const followupFiredThisWeek = state.events.some(
    prev => prev.week === occurrenceWeek && prev.year === state.year
      && FOLLOWUP_EVENT_IDS.has(prev.id) && !DIRECT_SEQUEL_IDS.has(prev.id),
  );
  const followup = followupFiredThisWeek ? null : getFollowupForWeek(state, location);
  if (followup) {
    state.currentEvent = { ...followup, week: occurrenceWeek };
    state.phase = 'event';
  } else {
    // chain cap: 일반 누적 2개, milestone(도달형) 잔여 있으면 3개까지 (졸업 직전 누락 방지).
    const eventsThisWeek = state.events.filter(
      prev => prev.week === occurrenceWeek && prev.year === state.year,
    ).length;
    let chainPick: ReturnType<typeof getConditionalForWeek> = null;
    if (eventsThisWeek < 2) {
      chainPick = getConditionalForWeek(state);
    } else if (eventsThisWeek < 3) {
      chainPick = getMilestoneForWeek(state);
    }
    if (chainPick) {
      state.currentEvent = { ...chainPick, week: occurrenceWeek };
      state.phase = 'event';
    } else if (state.week > 48) {
      // W48 학년말/졸업 주 이벤트 종료 → processWeek가 미뤄둔 학년 전환을 지금 수행.
      applyYearTransition(state);
    } else {
      // 일반 주: 주간 결산 화면으로 (phase='result')
      state.phase = 'result';
    }
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  npcActivityMap: {},

  startGame: (gender, parents, options) => {
    const initial = createInitialState(gender, parents, options);
    set({ state: initial });
    saveToStorage(initial);
    localStorage.removeItem('lifetrack_tutorial_done');
  },

  loadSavedGame: () => {
    const save = loadFromStorage();
    if (!save) return false;
    set({ state: migrateLoadedState(save.state) });
    return true;
  },

  resetGame: () => {
    deleteSave();
    set({ state: null, npcActivityMap: {} });
  },

  setRoutine: (slot2, slot3) => {
    const s = get().state;
    if (!s) return;
    // 슬롯별로 변경 여부 판단 — 안 바뀐 슬롯은 보너스 카운터 유지
    const slot2Weeks = s.routineSlot2 === slot2 ? s.routineSlot2Weeks : 0;
    const slot3Weeks = s.routineSlot3 === slot3 ? s.routineSlot3Weeks : 0;
    set({ state: {
      ...s, routineSlot2: slot2, routineSlot3: slot3,
      routineSlot2Weeks: slot2Weeks, routineSlot3Weeks: slot3Weeks,
    } });
  },

  setWeekendChoices: (choices) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, weekendChoices: choices } });
  },

  setVacationChoices: (choices) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, vacationChoices: choices } });
  },

  setNpcActivityMap: (map) => {
    set({ npcActivityMap: map });
  },

  advanceWeek: () => {
    const s = get().state;
    if (!s) return;
    if (s.phase === 'event' || s.phase === 'result' || s.phase === 'year-end' || s.phase === 'ending') return;
    const newState = processWeek(s, get().npcActivityMap);
    // 이벤트/학년말/엔딩이 아니면 주간 결산 단계(phase='result')로 전환.
    // 결산을 React 로컬 state가 아닌 phase로 표현해 새로고침 후에도 결산 화면이 유지되게 한다.
    if (newState.phase !== 'event' && newState.phase !== 'year-end' && newState.phase !== 'ending') {
      newState.phase = 'result';
    }
    set({ state: newState, npcActivityMap: {} });
  },

  resolveEvent: (choiceIndex) => {
    const s = get().state;
    if (!s || !s.currentEvent) return;
    // 성별 분기 적용
    const isFemale = s.gender === 'female';
    const choices = (isFemale && s.currentEvent.femaleChoices) ? s.currentEvent.femaleChoices : s.currentEvent.choices;
    // B-2 안전망: 모든 선택지가 비용 부족으로 잠겼을 때 EventScene이 sentinel(-1)을 보내면
    // 효과 0인 "지나친다"로 처리해 이벤트만 닫고 다음 주로 진행 가능하게 한다.
    const choice = choices[choiceIndex] ?? {
      text: '지나친다',
      effects: {},
      message: '잠시 머뭇거리다 자리를 떴다.',
    };

    const newState = cloneGameState(s);
    const event = newState.currentEvent!;
    // 발생 주차 = currentEvent.week (clone 이전 원본). newState.week는 processWeek의 week++ 이후라
    // 그대로 쓰면 발생주+1로 어긋난다(off-by-one) → record/chain이 이 값을 공유한다.
    const occurrenceWeek = s.currentEvent!.week ?? newState.week;

    // 선택 결과 적용 (스탯/피로/용돈 + NPC met + timeCost/문이과/부모 친밀도)
    applyChoiceOutcome(newState, event, choice);

    // v1.2 기억 슬롯 생성 (importance ≥3 + ANNUAL 제외 필터는 내부에서)
    applyMemorySlotFromChoice(newState, event, choiceIndex, choice);

    // M4: 버프 추가 (동일 id 있으면 기간 덮어쓰기)
    if (choice.addBuff) {
      if (!newState.activeBuffs) newState.activeBuffs = [];
      newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
      newState.activeBuffs.push({ ...choice.addBuff });
    }

    // 이벤트 기록 (선택 인덱스 + 발생주차 + 연차 + 성별 분기)
    recordResolvedEvent(newState, event, choiceIndex, occurrenceWeek, isFemale);

    // weekLog 메시지 + 이벤트 닫기
    if (newState.weekLog) {
      newState.weekLog.messages.push(`📖 ${choice.message}`);
    }
    newState.currentEvent = null;

    // followup/conditional/milestone chain + 학년 전환·결산 분기 (location은 clone 이전 원본)
    resolveEventChain(newState, s.currentEvent?.location, occurrenceWeek);

    set({ state: newState });
  },

  setPhase: (phase) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, phase } });
  },

  advanceFromYearEnd: () => {
    const s = get().state;
    if (!s || s.phase !== 'year-end') return;
    const newState = cloneGameState(s);
    newState.week = 1;
    newState.year++;
    newState.currentEvent = null;
    if (newState.year > 7) {
      newState.phase = 'ending';
    } else {
      newState.phase = 'weekday';
      const nextInfo = getWeekInfo(newState.week);
      newState.semester = nextInfo.semester;
      newState.isVacation = nextInfo.isVacation;
    }
    set({ state: newState });
  },

  buyItem: (item, targetNpcId) => {
    const s = get().state;
    if (!s) return [];
    const { newState, messages } = applyItemEffects(item, s, targetNpcId);
    // 구매 횟수 추적
    newState.weekPurchases = { ...newState.weekPurchases };
    newState.weekPurchases[item.id] = (newState.weekPurchases[item.id] || 0) + 1;
    set({ state: newState });
    return messages;
  },

  // ===== Phase 2.1 말걸기 (사전 결정 모델) =====
  // 사전 결정: processWeek에서 npcEventPendingThisWeek/parentEventPendingThisWeek 굴림.
  // 클릭은 결과 보는 행위 — 무한 가능. pending+풀 가용시 fire, 그 외엔 잡담.
  // pressure는 fire 시점에만 0 리셋 (놓친 주는 누적 유지 → 오래 안 만나면 자연스럽게 100% 보장).
  talkToNpc: (npcId) => {
    const s = get().state;
    if (!s) return { kind: 'smalltalk', line: '' };
    const npc = s.npcs.find(n => n.id === npcId);
    if (!npc) return { kind: 'smalltalk', line: '' };

    // 친밀도 30+ 일 때만 미니 이벤트 후보 — 그 외엔 잡담 한 줄
    const eligible = npc.intimacy >= 30 && s.npcEventPendingThisWeek;
    if (eligible) {
      const available = getAvailableNpcEvents(s, npcId);
      if (available.length > 0) {
        // fire — 효과 적용 + pressure 리셋 + pending 소비 + fired 기록
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
        set({ state: newState });
        return { kind: 'event', event: ev };
      }
      // pending이지만 이 NPC 풀 비어있음 → 잡담 (pending은 다른 NPC를 위해 보존)
    }
    // 잡담 한 줄 — RNG 진행 위해 새 state로 push
    const newState = cloneGameState(s);
    const line = getNpcSmalltalk(newState, npcId);
    set({ state: newState });
    return { kind: 'smalltalk', line };
  },

  talkToHome: () => {
    const s = get().state;
    if (!s) return { kind: 'smalltalk', line: '' };

    // Phase 4B: 강점별 "절정 순간" — 미니이벤트보다 우선. 선택지 없는 단일 컷, 평생 1회.
    // pressure RNG와 무관하게(결정론적 마일스톤) 발동 가능 시점에 가정 대화로 surface된다.
    const climax = getEligibleParentClimax(s);
    if (climax) {
      const newState = cloneGameState(s);
      applyVisibleTalkEffects(newState, climax.effects);  // strict만 멘탈 +2, 나머지 스탯 0(친밀도 가산 없음)
      applyMemorySlotFromMiniTalk(newState, climax.id, climax.memorySlotDraft);
      newState.parentClimaxFired = [...(newState.parentClimaxFired ?? []), climax.parentStrength];
      newState.actedWithParentThisWeek = true;
      newState.parentTalkPressure = 0;
      newState.parentEventPendingThisWeek = false;
      set({ state: newState });
      return { kind: 'event', event: climax };
    }

    if (s.parentEventPendingThisWeek) {
      const available = getAvailableHomeEvents(s);
      if (available.length > 0) {
        const ev = available[0];
        // Phase 2A — ±선택지 이벤트: 효과는 선택 시점(resolveParentTalkChoice)에 적용.
        // 여기선 상태를 건드리지 않으므로 모달을 닫았다 다시 눌러도 같은 이벤트가 뜬다(선택 전 = 보류).
        if (ev.choices && ev.choices.length > 0) {
          return { kind: 'event', event: ev };
        }
        // 레거시(선택지 없는) 이벤트: 기존처럼 즉시 적용 + 발동 기록.
        const newState = cloneGameState(s);
        applyVisibleTalkEffects(newState, ev.effects);
        if (ev.effects.parentIntimacy) {
          // 단일 진입점 통합 — 강점 반응 배율·구간 감쇠 적용 (직접 가산 금지)
          applyParentIntimacyDelta(newState, ev.effects.parentIntimacy, ev.parentTag ?? 'familyTime');
        }
        applyMemorySlotFromMiniTalk(newState, ev.id, ev.memorySlotDraft);
        recordParentEventFired(newState, ev.id);
        newState.actedWithParentThisWeek = true; // 부모와 상호작용 → 이번 주 평균 회귀 면제
        newState.parentTalkPressure = 0;
        newState.parentEventPendingThisWeek = false;
        set({ state: newState });
        return { kind: 'event', event: ev };
      }
    }
    const newState = cloneGameState(s);
    newState.actedWithParentThisWeek = true; // 부모와 대화 → 이번 주 평균 회귀 면제
    const line = getHomeSmalltalk(newState);
    set({ state: newState });
    return { kind: 'smalltalk', line };
  },

  // Phase 2A — 부모 ±선택지 이벤트의 선택 적용(선택-후-적용).
  // talkToHome이 효과 없이 이벤트만 띄우고, 사용자가 모달에서 고른 선택을 여기서 정산한다.
  // parentEventPendingThisWeek 가드로 중복 클릭/이미 소비된 주를 방어.
  resolveParentTalkChoice: (eventId, choiceIdx) => {
    const s = get().state;
    if (!s || !s.parentEventPendingThisWeek) return;
    const ev = PARENT_MINI_EVENTS.find(e => e.id === eventId);
    const choice = ev?.choices?.[choiceIdx];
    if (!ev || !choice) return;
    // 가용성 가드 — talkToHome과 대칭. 보유하지 않은 강점/쿨다운 중 이벤트가 stale·외부 호출로
    // 정산되는 것을 방어(현재 UI 경로는 안전하나 단일 진입점 불변식을 코드로 강제).
    if (!getAvailableHomeEvents(s).some(e => e.id === eventId)) return;

    const newState = cloneGameState(s);
    applyVisibleTalkEffects(newState, choice.effects);
    if (choice.parentEffect) {
      applyParentIntimacyDelta(newState, choice.parentEffect.baseDelta, choice.parentEffect.tag);
    }
    // 선택에 달린 회상 슬롯(있으면) → 학년말/엔딩 회상에 등장. sourceEventId당 1회(재발동해도 중복 방지).
    applyMemorySlotFromMiniTalk(newState, ev.id, choice.memorySlotDraft, choiceIdx);
    recordParentEventFired(newState, ev.id);
    newState.actedWithParentThisWeek = true;
    newState.parentTalkPressure = 0;
    newState.parentEventPendingThisWeek = false;
    set({ state: newState });
  },

  // ===== 디버그 메서드 (DebugPanel에서 호출, import.meta.env.DEV 가드는 컴포넌트 쪽에서) =====
  debugAdvanceToYearEnd: () => {
    const s = get().state;
    if (!s || s.phase === 'ending') return;
    const newState = cloneGameState(s);
    // milestone 미생성 시 생성 (학년말 카드 fallback 막기 위함)
    if (!newState.milestoneScenes.find(m => m.year === newState.year)) {
      recordMilestoneForYear(newState, newState.year);
    }
    newState.phase = 'year-end';
    newState.currentEvent = null;
    set({ state: newState });
  },

  debugSkipToEnding: () => {
    const s = get().state;
    if (!s) return;
    const newState = cloneGameState(s);
    // Y1~현재까지 누락된 milestone 채우기 (엔딩 회상 fallback 방지)
    for (let y = 1; y <= 7; y++) {
      if (!newState.milestoneScenes.find(m => m.year === y)) {
        recordMilestoneForYear(newState, y);
      }
    }
    newState.year = 8;
    newState.week = 1;
    newState.phase = 'ending';
    newState.currentEvent = null;
    set({ state: newState });
  },

  debugSetStat: (key, value) => {
    const s = get().state;
    if (!s) return;
    const clamped = Math.max(0, Math.min(100, value));
    set({ state: { ...s, stats: { ...s.stats, [key]: clamped } } });
  },

  // DEV 전용 — 다음 "가정에 말 걸기" 클릭에서 부모 미니이벤트를 즉시 발동시킨다.
  // 기존 발동기록의 쿨다운을 풀어(week=-999) 두 강점 이벤트가 번갈아(로테이션) 뜨게 한다.
  debugForceParentEvent: () => {
    const s = get().state;
    if (!s) return;
    const newState = cloneGameState(s);
    newState.parentEventPendingThisWeek = true;
    newState.parentTalkPressure = 1;
    newState.parentEventsFired = (newState.parentEventsFired ?? []).map(f => ({ ...f, week: -999 }));
    set({ state: newState });
  },
}));

// 상태 변경 시 자동 저장
useGameStore.subscribe((curr, prev) => {
  if (curr.state && curr.state !== prev.state) {
    saveToStorage(curr.state);
  }
});
