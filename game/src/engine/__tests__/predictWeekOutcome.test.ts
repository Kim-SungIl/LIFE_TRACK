import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek, predictWeekOutcome } from '../gameEngine';
import type { GameState, ParentStrength, StatKey } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

/** predictWeekOutcome 소스에 인라인된 임계값을 읽어 하드코딩을 피한다. */
function readPredictThresholds(): { hintAbsMin: number; burnoutFatigueMin: number } {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../gameEngine.ts'),
    'utf8',
  );
  const hint = src.match(/Math\.abs\(s\.delta\)\s*>=\s*([0-9.]+)/);
  const burnout = src.match(/burnoutRisk:\s*fatigueAfter\s*>=\s*(\d+)/);
  if (!hint || !burnout) {
    throw new Error('predictWeekOutcome thresholds not found in gameEngine.ts');
  }
  return { hintAbsMin: Number(hint[1]), burnoutFatigueMin: Number(burnout[1]) };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.money = 50;
  return Object.assign(state, overrides);
}

describe('predictWeekOutcome', () => {
  const { hintAbsMin, burnoutFatigueMin } = readPredictThresholds();

  it('fatigueAfter matches Math.round(processWeek(...).fatigue) for the same plan', () => {
    const state = baseState({ weekendChoices: [], isVacation: false, week: 2 });
    const planned = ['self-study', 'rest'];

    const preview = predictWeekOutcome(state, planned);
    const actual = processWeek({ ...state, weekendChoices: planned });

    expect(preview.fatigueAfter).toBe(Math.round(actual.fatigue));
    expect(preview.fatigueBefore).toBe(Math.round(state.fatigue));
    expect(preview.fatigueDelta).toBe(preview.fatigueAfter - preview.fatigueBefore);
  });

  it('statHints directions match processWeek deltas using the source |delta| threshold', () => {
    const state = baseState({ weekendChoices: [], isVacation: false, week: 2 });
    const planned = ['self-study', 'self-study'];

    const preview = predictWeekOutcome(state, planned);
    const actual = processWeek({ ...state, weekendChoices: planned });

    const STAT_KEYS: StatKey[] = ['academic', 'social', 'health', 'talent', 'mental'];
    const expectedHints = STAT_KEYS
      .map(key => ({ key, delta: actual.stats[key] - state.stats[key] }))
      .filter(s => Math.abs(s.delta) >= hintAbsMin)
      .map(s => ({ key: s.key, dir: s.delta > 0 ? ('up' as const) : ('down' as const) }));

    expect(preview.statHints).toEqual(expectedHints);
  });

  it('burnoutRisk follows fatigueAfter >= source threshold at the 79/80 boundary', () => {
    // emotional 회복 보너스가 없는 부모로, rest 1주 후 경계(threshold-1 / threshold)에 착지.
    // (strict+freedom, fatigue 99→79 / 100→80 — 현재 회복 곡선 기준)
    const parents: [ParentStrength, ParentStrength] = ['strict', 'freedom'];
    const low = createInitialState('male', parents, { rngSeed: RNG_SEED });
    low.fatigue = 99;
    low.week = 2;
    low.isVacation = false;
    low.weekendChoices = [];
    const high = createInitialState('male', parents, { rngSeed: RNG_SEED });
    high.fatigue = 100;
    high.week = 2;
    high.isVacation = false;
    high.weekendChoices = [];
    const planned = ['rest'];

    const lowPreview = predictWeekOutcome(low, planned);
    const highPreview = predictWeekOutcome(high, planned);

    expect(lowPreview.fatigueAfter).toBe(burnoutFatigueMin - 1);
    expect(highPreview.fatigueAfter).toBe(burnoutFatigueMin);

    expect(lowPreview.burnoutRisk).toBe(lowPreview.fatigueAfter >= burnoutFatigueMin);
    expect(highPreview.burnoutRisk).toBe(highPreview.fatigueAfter >= burnoutFatigueMin);
    expect(lowPreview.burnoutRisk).toBe(false);
    expect(highPreview.burnoutRisk).toBe(true);
  });

  it('injects plannedChoices into weekendChoices when not on vacation', () => {
    const state = baseState({
      week: 2,
      isVacation: false,
      weekendChoices: [],
      // 잘못된 필드에 둔 decoy — 주입이 weekend면 predict는 decoy와 달라야 함
      vacationChoices: ['academy', 'academy'],
    });
    const planned = ['self-study', 'self-study'];

    const preview = predictWeekOutcome(state, planned);
    const viaWeekend = processWeek({
      ...state,
      weekendChoices: planned,
      vacationChoices: state.vacationChoices,
    });
    const viaVacationOnly = processWeek({
      ...state,
      weekendChoices: [],
      vacationChoices: planned,
    });

    expect(preview.fatigueAfter).toBe(Math.round(viaWeekend.fatigue));
    expect(preview.fatigueAfter).not.toBe(Math.round(viaVacationOnly.fatigue));
  });

  it('injects plannedChoices into vacationChoices when on vacation', () => {
    const state = baseState({
      week: 20, // 여름방학
      isVacation: true,
      vacationChoices: [],
      weekendChoices: ['academy', 'academy', 'academy'], // decoy
    });
    const planned = ['self-study', 'self-study', 'self-study'];

    const preview = predictWeekOutcome(state, planned);
    const viaVacation = processWeek({
      ...state,
      vacationChoices: planned,
      weekendChoices: state.weekendChoices,
    });
    const viaWeekendOnly = processWeek({
      ...state,
      vacationChoices: [],
      weekendChoices: planned,
    });

    expect(preview.fatigueAfter).toBe(Math.round(viaVacation.fatigue));
    expect(preview.fatigueAfter).not.toBe(Math.round(viaWeekendOnly.fatigue));
  });
});
