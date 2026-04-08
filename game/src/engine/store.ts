import { create } from 'zustand';
import { GameState, ParentStrength } from './types';
import { createInitialState, processWeek } from './gameEngine';
import { ShopItem, applyItemEffects } from './shopSystem';
import { getFollowupForWeek, GAME_EVENTS } from './events';

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
  history: GameState[];
  npcActivityMap: Record<string, string>; // activityId -> npcId
  startGame: (gender: 'male' | 'female', parents: [ParentStrength, ParentStrength]) => void;
  loadSavedGame: () => boolean;
  resetGame: () => void;
  setRoutine: (slot2: string | null, slot3: string | null) => void;
  setWeekendChoices: (choices: string[]) => void;
  setVacationChoices: (choices: string[]) => void;
  setNpcActivityMap: (map: Record<string, string>) => void;
  advanceWeek: () => void;
  resolveEvent: (choiceIndex: number) => void;
  setPhase: (phase: GameState['phase']) => void;
  buyItem: (item: ShopItem, targetNpcId?: string) => string[];
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  history: [],
  npcActivityMap: {},

  startGame: (gender, parents) => {
    const initial = createInitialState(gender, parents);
    set({ state: initial, history: [] });
    saveToStorage(initial);
    localStorage.removeItem('lifetrack_tutorial_done');
  },

  loadSavedGame: () => {
    const save = loadFromStorage();
    if (!save) return false;
    set({ state: save.state, history: [] });
    return true;
  },

  resetGame: () => {
    deleteSave();
    set({ state: null, history: [], npcActivityMap: {} });
  },

  setRoutine: (slot2, slot3) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, routineSlot2: slot2, routineSlot3: slot3, routineWeeks: 0 } });
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
    const npcMap = get().npcActivityMap;

    // NPC 선택에 따른 친밀도 적용
    const newS = JSON.parse(JSON.stringify(s)) as GameState;
    for (const [, npcId] of Object.entries(npcMap)) {
      const npc = newS.npcs.find(n => n.id === npcId);
      if (npc) {
        npc.intimacy = Math.min(100, npc.intimacy + 3);
      }
    }

    const history = [...get().history, s];
    const newState = processWeek(newS);
    set({ state: newState, history, npcActivityMap: {} });
  },

  resolveEvent: (choiceIndex) => {
    const s = get().state;
    if (!s || !s.currentEvent) return;
    // 성별 분기 적용
    const isFemale = s.gender === 'female';
    const choices = (isFemale && s.currentEvent.femaleChoices) ? s.currentEvent.femaleChoices : s.currentEvent.choices;
    const choice = choices[choiceIndex];
    if (!choice) return;

    const newState = JSON.parse(JSON.stringify(s)) as typeof s;

    // 스탯 효과 적용
    for (const [key, val] of Object.entries(choice.effects)) {
      const k = key as keyof typeof newState.stats;
      newState.stats[k] = Math.max(0, Math.min(100, newState.stats[k] + (val as number)));
    }

    // 피로 효과
    if (choice.fatigueEffect) {
      newState.fatigue = Math.max(0, Math.min(100, newState.fatigue + choice.fatigueEffect));
    }

    // 용돈 효과
    if (choice.moneyEffect) {
      newState.money += choice.moneyEffect;
    }

    // NPC 친밀도 효과 + 만남 처리
    if (choice.npcEffects) {
      for (const ne of choice.npcEffects) {
        const npc = newState.npcs.find(n => n.id === ne.npcId);
        if (npc) {
          npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange));
          npc.met = true;
        }
      }
    }
    // 이벤트에 등장한 모든 NPC도 met 처리 (선택지 관계없이)
    for (const c of newState.currentEvent!.choices) {
      if (c.npcEffects) {
        for (const ne of c.npcEffects) {
          const npc = newState.npcs.find(n => n.id === ne.npcId);
          if (npc) npc.met = true;
        }
      }
    }

    // 시간 소모 이벤트: 다음 주 루틴/주말 슬롯 감소
    if (choice.timeCost) {
      newState.eventTimeCost = choice.timeCost;
    }

    // 고정 주차 이벤트 여부 — 원본 GAME_EVENTS 정의에 week가 있는지로 판별
    const originalEventDef = GAME_EVENTS.find(e => e.id === newState.currentEvent!.id);
    const wasFixedWeekEvent = originalEventDef?.week !== undefined;

    // 이벤트 기록 (선택 인덱스 포함)
    newState.events.push({ ...newState.currentEvent!, resolvedChoice: choiceIndex });

    // weekLog에 메시지 추가
    if (newState.weekLog) {
      newState.weekLog.messages.push(`📖 ${choice.message}`);
    }

    newState.currentEvent = null;

    // 고정 주차 이벤트 해결 후 → followup 이벤트 즉시 발동 (주당 1회)
    if (wasFixedWeekEvent) {
      const followup = getFollowupForWeek(newState);
      if (followup) {
        newState.currentEvent = followup;
        newState.phase = 'event';
      } else {
        newState.phase = 'weekday';
      }
    } else {
      newState.phase = 'weekday';
    }
    set({ state: newState });
  },

  setPhase: (phase) => {
    const s = get().state;
    if (!s) return;
    set({ state: { ...s, phase } });
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
}));

// 상태 변경 시 자동 저장
useGameStore.subscribe((curr, prev) => {
  if (curr.state && curr.state !== prev.state) {
    saveToStorage(curr.state);
  }
});
