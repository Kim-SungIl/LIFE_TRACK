import { create } from 'zustand';
import { GameState, ParentStrength } from './types';
import { createInitialState, processWeek } from './gameEngine';
import { ShopItem, applyItemEffects } from './shopSystem';

interface GameStore {
  state: GameState | null;
  history: GameState[];
  npcActivityMap: Record<string, string>; // activityId -> npcId
  startGame: (gender: 'male' | 'female', parents: [ParentStrength, ParentStrength]) => void;
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
    localStorage.removeItem('lifetrack_tutorial_done');
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
    const choice = s.currentEvent.choices[choiceIndex];
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

    // 이벤트 기록
    newState.events.push(newState.currentEvent!);

    // weekLog에 메시지 추가
    if (newState.weekLog) {
      newState.weekLog.messages.push(`📖 ${choice.message}`);
    }

    newState.currentEvent = null;
    newState.phase = 'weekday';
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
