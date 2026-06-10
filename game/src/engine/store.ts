import { create } from 'zustand';
import { GameState, GameEvent, ParentStrength } from './types';
import { createInitialState, processWeek, getWeekInfo, scaleIntimacyChange, scaleStatChange, applyYearTransition } from './gameEngine';
import { migrateLoadedState } from './stateMigration';
import { cloneGameState } from './stateClone';
import { ShopItem, applyItemEffects } from './shopSystem';
import { getFollowupForWeek, getConditionalForWeek, getMilestoneForWeek, FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS } from './events';
import { applyMemorySlotFromChoice, applyMemorySlotFromMiniTalk, recordMilestoneForYear } from './memorySystem';
import { MiniTalkEvent, getAvailableNpcEvents, getAvailableHomeEvents, getNpcSmalltalk, getHomeSmalltalk } from './talkSystem';
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

    // 스탯 효과 적용 — 구간별 감쇠(scaleStatChange)로 활동과 동일하게 고구간 캡 적용.
    // 이전엔 raw 가산이라 이벤트가 활동 감쇠를 우회 → 빌드 무관 수렴(QA C3 근본원인).
    for (const [key, val] of Object.entries(choice.effects)) {
      const k = key as keyof typeof newState.stats;
      const scaled = scaleStatChange(val as number, newState.stats[k]);
      newState.stats[k] = Math.max(0, Math.min(100, newState.stats[k] + scaled));
    }

    // 피로 효과
    if (choice.fatigueEffect) {
      newState.fatigue = Math.max(0, Math.min(100, newState.fatigue + choice.fatigueEffect));
    }

    // 용돈 효과 — 음수 방지 (gameEngine/shopSystem과 동일 클램프)
    if (choice.moneyEffect) {
      newState.money = Math.round((newState.money + choice.moneyEffect) * 10) / 10;
      if (newState.money < 0) newState.money = 0;
    }

    // NPC 친밀도 효과 + 만남 처리 (구간별 감쇠 적용 — scaleIntimacyChange)
    if (choice.npcEffects) {
      for (const ne of choice.npcEffects) {
        const npc = newState.npcs.find(n => n.id === ne.npcId);
        if (npc) {
          const scaled = scaleIntimacyChange(ne.intimacyChange, npc.intimacy);
          npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + scaled));
          npc.met = true;
        }
      }
    }
    // 이벤트에 등장한 모든 NPC도 met 처리 (선택지 관계없이, 남/여 분기 모두 포함)
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
    // speakers 에 등장한 NPC도 met 처리 (npcEffects 없는 대사 전용 등장도 만남으로 인정)
    if (newState.currentEvent!.speakers) {
      for (const npcId of newState.currentEvent!.speakers) {
        const npc = newState.npcs.find(n => n.id === npcId);
        if (npc) npc.met = true;
      }
    }

    // 시간 소모 이벤트: 다음 주 루틴/주말 슬롯 감소
    if (choice.timeCost) {
      newState.eventTimeCost = choice.timeCost;
    }

    // 문/이과 선택 (Y6 W1 이벤트 전용)
    if (choice.trackSelect) {
      newState.track = choice.trackSelect;
    }

    // v1.2 기억 슬롯 생성 (importance ≥3 + ANNUAL 제외 필터는 내부에서)
    applyMemorySlotFromChoice(newState, newState.currentEvent!, choiceIndex, choice);

    // M4: 버프 추가 (동일 id 있으면 기간 덮어쓰기)
    if (choice.addBuff) {
      if (!newState.activeBuffs) newState.activeBuffs = [];
      newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
      newState.activeBuffs.push({ ...choice.addBuff });
    }

    // 이벤트 기록 (선택 인덱스 + 발생 주차 + 연차 + 성별 분기 정보 포함)
    // condition은 함수라 JSON 직렬화에서 손실되므로 기록 시점에 명시적으로 제거
    // (저장/로드 후 메모리상 객체 일관성 — events 배열 비교 시 함수 비교 회피)
    const recordedEvent: Partial<GameEvent> = { ...newState.currentEvent! };
    delete recordedEvent.condition;
    newState.events.push({
      ...(recordedEvent as GameEvent),
      resolvedChoice: choiceIndex,
      // 발생 주차 = 이벤트가 스탬프된 currentEvent.week (gameEngine:795 / 아래 chain 스탬프).
      // newState.week는 processWeek의 week++ 이후 값이라 그대로 쓰면 발생주+1로 어긋난다(off-by-one).
      week: s.currentEvent!.week ?? newState.week,
      year: newState.year,
      resolvedFemale: isFemale && !!s.currentEvent!.femaleChoices,
    });

    // weekLog에 메시지 추가
    if (newState.weekLog) {
      newState.weekLog.messages.push(`📖 ${choice.message}`);
    }

    newState.currentEvent = null;

    // 이벤트 해결 후 → 대기 중인 followup 이벤트 즉시 연쇄 발동 (같은 장소 제외)
    // 가드: 같은 주(week+year)에 followup이 이미 한 번 발동했으면 추가 발동 안 함
    // (한 주 3+ 이벤트 누적으로 인한 피로감 방지)
    // 단 DIRECT_SEQUEL_IDS(선거→연설→결과 같은 자연 chain)는 가드에서 제외 — 같은 주에 모두 보이는 게 의도
    // 같은 주에 연쇄하는 이벤트는 발생주(currentEvent.week)를 그대로 물려줘 records의 week를 일치시킨다.
    // newState.week는 week++ 이후 값(W48이면 49)이라 이벤트 기록·집계는 occurrenceWeek로 통일한다.
    const occurrenceWeek = s.currentEvent!.week ?? newState.week;
    const followupFiredThisWeek = newState.events.some(
      prev => prev.week === occurrenceWeek && prev.year === newState.year
        && FOLLOWUP_EVENT_IDS.has(prev.id) && !DIRECT_SEQUEL_IDS.has(prev.id),
    );
    const followup = followupFiredThisWeek ? null : getFollowupForWeek(newState, s.currentEvent?.location);
    if (followup) {
      newState.currentEvent = { ...followup, week: occurrenceWeek };
      newState.phase = 'event';
    } else {
      // followup이 없으면 conditional 이벤트 chain 시도 — 한 주에 fixed + conditional 동시 발동 허용
      // (자율 이벤트는 우선순위 마지막이라 chain에서 픽 안 됨 — 사용자 요구대로)
      // chain cap: 일반은 누적 2개, 단 milestone(도달형) 잔여가 있으면 3개까지 허용.
      // 학년 한정 도달형이 졸업 직전에 누락되는 걸 막기 위한 안전판 — 일반 conditional은 3번째 자리에 못 들어옴.
      const eventsThisWeek = newState.events.filter(
        prev => prev.week === occurrenceWeek && prev.year === newState.year,
      ).length;
      let chainPick: ReturnType<typeof getConditionalForWeek> = null;
      if (eventsThisWeek < 2) {
        chainPick = getConditionalForWeek(newState);
      } else if (eventsThisWeek < 3) {
        chainPick = getMilestoneForWeek(newState);
      }
      if (chainPick) {
        newState.currentEvent = { ...chainPick, week: occurrenceWeek };
        newState.phase = 'event';
      } else if (newState.week > 48) {
        // W48 학년말/졸업 주 이벤트가 모두 끝남 → 보류했던 학년 전환을 지금 수행.
        // (processWeek에서 currentEvent 대기로 미뤄둔 transition)
        applyYearTransition(newState);
      } else {
        // 일반 주: 이벤트 종료 후 주간 결산 화면으로 (phase='result' → 새로고침에도 유지)
        newState.phase = 'result';
      }
    }
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
