import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { getEventForWeek } from '../events';
import type { EventSelection } from '../events/selection';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

function fixture(overrides: Partial<GameState> = {}): GameState {
  return Object.assign(createInitialState('male', PARENTS, { rngSeed: RNG_SEED }), overrides);
}

function stubFired(
  id: string,
  year: number,
  week: number,
  resolvedChoice = 0,
): GameState['events'][number] {
  return { id, title: '', description: '', choices: [], year, week, resolvedChoice };
}

function selectionKey(sel: EventSelection): { eventId: string | null; patch: EventSelection['patch'] } {
  return { eventId: sel.event?.id ?? null, patch: sel.patch };
}

describe('getEventForWeek', () => {
  describe('determinism', () => {
    it('is deterministic across independent clones with the same rngSeed (deep-equal)', () => {
      // ⚠️ getEventForWeek는 conditional/학교랜덤 분기에서 seededRandom(state)로 rngSeed를 mutate.
      // 같은 state를 두 번 호출하면 결과가 달라질 수 있으므로, 동일 시드의 독립 clone으로 검증한다.
      const make = () => fixture({ year: 1, week: 8 }); // fixed/followup/crisis 없는 조용한 주 → RNG 분기
      const a = structuredClone(make());
      const b = structuredClone(make());

      const ra = getEventForWeek(a);
      const rb = getEventForWeek(b);

      expect(ra).toEqual(rb);
      // 손계산 스냅샷: seed 42에서 Y1 W8 RNG 경로 → class-prank, patch 없음
      expect(selectionKey(ra)).toEqual({ eventId: 'class-prank', patch: null });
      expect(a.rngSeed).toBe(b.rngSeed);
      expect(a.rngSeed).not.toBe(RNG_SEED);
    });

    it('same state called twice on RNG path can diverge (mutation contract)', () => {
      const state = fixture({ year: 1, week: 8 });
      const first = getEventForWeek(state).event?.id ?? null;
      const second = getEventForWeek(state).event?.id ?? null;
      // 첫 호출이 rngSeed를 전진시켜 두 번째 굴림이 달라짐 — 현재 동작 고정
      expect(first).toBe('class-prank');
      expect(second).not.toBe(first);
    });
  });

  describe('priority: fixed before followup / crisis / reach', () => {
    it('selects fixed-week first-week over eligible followup class-president-speech', () => {
      // Y1 W1: first-week(fixed). class-president c0 이력이 있어 speech followup도 적격.
      const state = fixture({
        year: 1,
        week: 1,
        events: [stubFired('class-president', 1, 3, 0)],
      });
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('first-week');
      expect(sel.patch).toBeNull();
    });

    it('selects followup when no fixed-week matches (class-president-speech)', () => {
      const state = fixture({
        year: 1,
        week: 8,
        events: [stubFired('class-president', 1, 3, 0)],
      });
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('class-president-speech');
      expect(sel.patch).toBeNull();
    });

    it('selects fixed middle2-start over eligible hard crisis middle-burnout', () => {
      // Y3 W1: middle2-start(fixed). idleWeeks·mental로 middle-burnout도 적격이지만 fixed 우선.
      const state = fixture({
        year: 3,
        week: 1,
        idleWeeks: 3,
        stats: { academic: 30, social: 25, talent: 15, mental: 50, health: 40 },
      });
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('middle2-start');
      expect(sel.patch).toBeNull();
    });

    it('selects fixed middle-school-entrance over eligible reach jihun-locker-code', () => {
      // Y2 W1: 입학식 fixed. jihun fresh reach(tier 45)도 적격이지만 fixed 우선.
      // haeun.met으로 haeun-meet followup을 막아 reach까지 내려가게 한 뒤 fixed가 가로챔을 확인.
      const state = fixture({ year: 2, week: 1, isVacation: false });
      state.npcs.find(n => n.id === 'haeun')!.met = true;
      const jihun = state.npcs.find(n => n.id === 'jihun')!;
      jihun.intimacy = 45;
      jihun.weekStartIntimacy = 40;
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('middle-school-entrance');
      expect(sel.patch).toBeNull();
    });
  });

  describe('hardCrisis patch contract', () => {
    it('returns patch.hardCrisisYears when middle-burnout fires', () => {
      // Y3 W8: fixed 없음. idleWeeks>=3 & mental<=55 → middle-burnout (HARD_CRISIS)
      const state = fixture({
        year: 3,
        week: 8,
        idleWeeks: 3,
        hardCrisisYears: [],
        stats: { academic: 30, social: 25, talent: 15, mental: 50, health: 40 },
      });
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('middle-burnout');
      expect(sel.patch).toEqual({ hardCrisisYears: [3] });
    });

    it('returns patch.hardCrisisYears when high-panic fires', () => {
      // Y5 W8: mental<=55 & academic>=50 → high-panic
      const state = fixture({
        year: 5,
        week: 8,
        hardCrisisYears: [],
        stats: { academic: 50, social: 25, talent: 15, mental: 50, health: 40 },
      });
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('high-panic');
      expect(sel.patch).toEqual({ hardCrisisYears: [5] });
    });

    it('returns noPatch on soft crisis path (jihun-envy)', () => {
      // Y3 W8: hardCrisisYears에 3 포함 → hard 스킵. jihun 친밀·academic으로 soft jihun-envy.
      // haeun.met으로 year2 전용 followup 간섭 없음(year3).
      const state = fixture({
        year: 3,
        week: 8,
        idleWeeks: 0,
        isVacation: false,
        hardCrisisYears: [3],
        stats: { academic: 65, social: 25, talent: 15, mental: 80, health: 40 },
      });
      state.npcs.find(n => n.id === 'haeun')!.met = true;
      state.npcs.find(n => n.id === 'jihun')!.intimacy = 50;
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('jihun-envy');
      expect(sel.patch).toBeNull();
    });

    it('returns noPatch on reach path (jihun-locker-code fresh)', () => {
      const state = fixture({ year: 2, week: 8, isVacation: false });
      state.npcs.find(n => n.id === 'haeun')!.met = true; // haeun-meet followup 차단
      const jihun = state.npcs.find(n => n.id === 'jihun')!;
      jihun.intimacy = 45;
      jihun.weekStartIntimacy = 40; // fresh: weekStart < tier <= intimacy
      const sel = getEventForWeek(state);
      expect(sel.event?.id).toBe('jihun-locker-code');
      expect(sel.patch).toBeNull();
    });
  });

  describe('input immutability (non-RNG tiers)', () => {
    it('does not mutate state on fixed-week path', () => {
      const state = fixture({ year: 1, week: 1 });
      const before = structuredClone(state);
      getEventForWeek(state);
      expect(state).toEqual(before);
    });

    it('does not mutate state on followup path', () => {
      const state = fixture({
        year: 1,
        week: 8,
        events: [stubFired('class-president', 1, 3, 0)],
      });
      const before = structuredClone(state);
      getEventForWeek(state);
      expect(state).toEqual(before);
    });

    it('does not mutate state on hardCrisis path (patch only; caller applies)', () => {
      const state = fixture({
        year: 3,
        week: 8,
        idleWeeks: 3,
        hardCrisisYears: [],
        stats: { academic: 30, social: 25, talent: 15, mental: 50, health: 40 },
      });
      const before = structuredClone(state);
      const sel = getEventForWeek(state);
      expect(state).toEqual(before);
      // patch는 반환만 — state.hardCrisisYears는 그대로 []
      expect(state.hardCrisisYears).toEqual([]);
      expect(sel.patch).toEqual({ hardCrisisYears: [3] });
    });
  });
});
