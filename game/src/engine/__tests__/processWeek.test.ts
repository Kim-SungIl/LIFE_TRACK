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
});
