import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { isNpcEnrolled } from '../relationshipSignals';
import type { GameState, NpcState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// npcDeparture SSOT: relationshipSignals.ts NPC_DEPARTURE —
// doyun만 전출 대상, 발동 기록 eventId = 'doyun-school-split'
const DOYUN_DEPARTURE_EVENT_ID = 'doyun-school-split';

function fixture(overrides: Partial<GameState> = {}): GameState {
  return Object.assign(createInitialState('male', PARENTS, { rngSeed: RNG_SEED }), overrides);
}

function npcOf(state: GameState, id: string): NpcState {
  const npc = state.npcs.find(n => n.id === id);
  if (!npc) throw new Error(`NPC ${id} not found`);
  return npc;
}

function stubFired(id: string, year = 2, week = 2): GameState['events'][number] {
  return { id, title: '', description: '', choices: [], year, week };
}

describe('isNpcEnrolled', () => {
  describe('haeun year gate', () => {
    // 소스: npc.id==='haeun' → year !== 4 && year !== 7
    it.each([1, 2, 3, 5, 6] as const)('returns true at year %i (same-school years)', year => {
      const state = fixture({ year });
      expect(isNpcEnrolled(npcOf(state, 'haeun'), state)).toBe(true);
    });

    it.each([4, 7] as const)('returns false at year %i (gap / post-grad)', year => {
      const state = fixture({ year });
      expect(isNpcEnrolled(npcOf(state, 'haeun'), state)).toBe(false);
    });
  });

  describe('departure (npcDeparture)', () => {
    it('returns false for doyun after doyun-school-split has fired', () => {
      // NPC_DEPARTURE.doyun.eventId 가 state.events에 있으면 전출 → 재적 아님
      const state = fixture({
        year: 2,
        week: 3,
        events: [stubFired(DOYUN_DEPARTURE_EVENT_ID)],
      });
      expect(isNpcEnrolled(npcOf(state, 'doyun'), state)).toBe(false);
    });

    it('returns true for doyun when the departure event has not fired', () => {
      const state = fixture({ year: 2, week: 1, events: [] });
      expect(isNpcEnrolled(npcOf(state, 'doyun'), state)).toBe(true);
    });
  });

  describe('ordinary NPC', () => {
    it('returns true when not departed and not haeun', () => {
      const state = fixture({ year: 4, week: 10, events: [] });
      // year 4는 haeun만 false — jihun은 항상 true(전출 맵 없음)
      expect(isNpcEnrolled(npcOf(state, 'jihun'), state)).toBe(true);
      expect(isNpcEnrolled(npcOf(state, 'minjae'), state)).toBe(true);
    });
  });
});
