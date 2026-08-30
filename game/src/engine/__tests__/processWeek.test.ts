import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

function fixture(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.weekendChoices = ['self-study'];
  return Object.assign(state, overrides);
}

describe('processWeek', () => {
  it('does not mutate the input state (deep equality vs structuredClone)', () => {
    const state = fixture();
    const before = structuredClone(state);

    processWeek(state);

    expect(state).toEqual(before);
  });

  it('is deterministic for the same rngSeed and choices', () => {
    const a = processWeek(fixture());
    const b = processWeek(fixture());

    expect(a).toEqual(b);
  });

  it('advances rngSeed (seededRandom call order is a contract)', () => {
    // gameEngine.ts prepareWeekContext: seededRandom 2회 호출 순서는 rngSeed 전진 계약.
    // 시드 전진 + 시드 순서 의존 필드를 스냅샷으로 고정해 회귀를 잡는다.
    const input = fixture();
    const inputSeed = input.rngSeed;
    const after = processWeek(input);

    expect(after.rngSeed).not.toBe(inputSeed);

    // 시드 순서에 의존하는 주 시작 필드를 스냅샷으로 고정
    expect({
      rngSeed: after.rngSeed,
      npcEventPendingThisWeek: after.npcEventPendingThisWeek,
      parentEventPendingThisWeek: after.parentEventPendingThisWeek,
      currentEventId: after.currentEvent?.id ?? null,
      phase: after.phase,
    }).toMatchInlineSnapshot(`
      {
        "currentEventId": "first-week",
        "npcEventPendingThisWeek": false,
        "parentEventPendingThisWeek": false,
        "phase": "event",
        "rngSeed": 378494188,
      }
    `);
  });

  it('records that week\'s final mental into the current year slot (low / not-low)', () => {
    const low = processWeek(fixture({
      year: 3,
      week: 10,
      stats: { academic: 40, social: 40, talent: 20, mental: 12, health: 40 },
      weekendChoices: ['rest'],
    }));
    expect(low.stats.mental).toBeLessThan(40);
    expect(low.lowMentalWeeksByYear).toEqual([0, 0, 1, 0, 0, 0, 0]);
    expect(low.lowMentalWeeksByYear.reduce((a, b) => a + b, 0)).toBe(1);

    const ok = processWeek(fixture({
      year: 3,
      week: 10,
      stats: { academic: 40, social: 40, talent: 20, mental: 80, health: 40 },
      weekendChoices: ['rest'],
    }));
    expect(ok.stats.mental).toBeGreaterThanOrEqual(40);
    expect(ok.lowMentalWeeksByYear).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('veryLow (mental<25) increments only the current year; 25 does not', () => {
    const under = processWeek(fixture({
      year: 1,
      week: 2,
      stats: { academic: 40, social: 40, talent: 20, mental: 8, health: 40 },
      weekendChoices: ['rest'],
    }));
    expect(under.stats.mental).toBeLessThan(25);
    expect(under.veryLowMentalWeeksByYear[0]).toBe(1);
    expect(under.veryLowMentalWeeksByYear.slice(1).every(n => n === 0)).toBe(true);

    const at25 = processWeek(fixture({
      year: 1,
      week: 2,
      stats: { academic: 40, social: 40, talent: 20, mental: 25, health: 40 },
      weekendChoices: ['rest'],
      mentalState: 'normal',
      fatigue: 0,
    }));
    // 시험·방치가 없어도 자연 회복이 +될 수 있다. 최종이 25 이상이면 바닥 주가 아니어야 한다.
    if (at25.stats.mental >= 25) {
      expect(at25.veryLowMentalWeeksByYear[0]).toBe(0);
    }
  });

  it('burnout increments burnoutCountByYear on the year it happens, not a neighbor', () => {
    const before = fixture({
      year: 5,
      week: 8,
      mentalState: 'tired',
      fatigue: 80,
      burnoutCooldown: 0,
      consecutiveTiredWeeks: 0,
      stats: { academic: 40, social: 40, talent: 20, mental: 15, health: 40 },
      weekendChoices: ['self-study'],
    });
    const after = processWeek(before);
    expect(after.burnoutCount).toBe(before.burnoutCount + 1);
    expect(after.burnoutCountByYear).toEqual([0, 0, 0, 0, 1, 0, 0]);
    expect(after.burnoutCountByYear.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
