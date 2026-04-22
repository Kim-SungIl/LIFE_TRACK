import { create } from 'zustand';
import { GameState, ParentStrength } from './types';
import { createInitialState, processWeek, hashInitialState, getWeekInfo } from './gameEngine';
import { ShopItem, applyItemEffects } from './shopSystem';
import { getFollowupForWeek } from './events';
import { applyMemorySlotFromChoice } from './memorySystem';

const SAVE_KEY = 'lifetrack_save';
const SAVE_VERSION = 1;

interface SaveData {
  version: number;
  state: GameState;
  savedAt: string;
}

// v1.2 로드 시 누락 필드 백필 (processWeek 미경유 경로 보호)
// SAVE_VERSION을 올리지 않고 부재 필드 초기화로 호환 유지
function migrateLoadedState(state: GameState): GameState {
  return {
    ...state,
    memorySlots: state.memorySlots || [],
    socialRipples: state.socialRipples || [],
    milestoneScenes: state.milestoneScenes || [],
    rngSeed: (state.rngSeed && state.rngSeed !== 0)
      ? state.rngSeed
      : hashInitialState({ gender: state.gender, parents: state.parents }),
    hardCrisisYears: state.hardCrisisYears || [],
    unlockedEvents: state.unlockedEvents || [],
  };
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
  advanceFromYearEnd: () => void;
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
    set({ state: migrateLoadedState(save.state), history: [] });
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
      newState.money = Math.round((newState.money + choice.moneyEffect) * 10) / 10;
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

    // 문/이과 선택 (Y6 W1 이벤트 전용)
    if (choice.trackSelect) {
      newState.track = choice.trackSelect;
    }

    // v1.2 기억 슬롯 생성 (importance ≥3 + ANNUAL 제외 필터는 내부에서)
    applyMemorySlotFromChoice(newState, newState.currentEvent!, choiceIndex, choice);

    // v1.2 ripple 활성화
    if (choice.activateRipples) {
      for (const rid of choice.activateRipples) {
        // ripple 정의는 이벤트 콘텐츠 측에서 등록 가정. 여기서는 activatedAt만 갱신.
        const ripple = newState.socialRipples.find(r => r.id === rid);
        if (ripple && !ripple.activatedAt) ripple.activatedAt = newState.week;
      }
    }

    // 이벤트 기록 (선택 인덱스 + 발생 주차 + 연차 + 성별 분기 정보 포함)
    newState.events.push({
      ...newState.currentEvent!,
      resolvedChoice: choiceIndex,
      week: newState.week,
      year: newState.year,
      resolvedFemale: isFemale && !!s.currentEvent!.femaleChoices,
    });

    // weekLog에 메시지 추가
    if (newState.weekLog) {
      newState.weekLog.messages.push(`📖 ${choice.message}`);
    }

    newState.currentEvent = null;

    // 이벤트 해결 후 → 대기 중인 followup 이벤트 즉시 연쇄 발동 (같은 장소 제외)
    const followup = getFollowupForWeek(newState, s.currentEvent?.location);
    if (followup) {
      newState.currentEvent = followup;
      newState.phase = 'event';
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

  advanceFromYearEnd: () => {
    const s = get().state;
    if (!s || s.phase !== 'year-end') return;
    const newState = JSON.parse(JSON.stringify(s)) as GameState;
    newState.week = 1;
    newState.year++;
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
}));

// 상태 변경 시 자동 저장
useGameStore.subscribe((curr, prev) => {
  if (curr.state && curr.state !== prev.state) {
    saveToStorage(curr.state);
  }
});
