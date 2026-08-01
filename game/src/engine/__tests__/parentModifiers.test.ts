import { describe, expect, it } from 'vitest';
import { getParentMods } from '../parentModifiers';
import type { ParentStrength } from '../types';

// getParentMods 계약 상수 — parentModifiers.ts 분기와 동일.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const RESILIENCE_ACADEMIC = 5;
const RESILIENCE_HEALTH = 5;
const RESILIENCE_FATIGUE_MULT = 0.85;
const RESILIENCE_EXERCISE_BONUS = 0.1;
const STRICT_ACADEMIC = 5;
const STRICT_MENTAL = -3;
const STRICT_ROUTINE_BOOST = 1;
const EMOTIONAL_MENTAL = 10;
const EMOTIONAL_FATIGUE_RECOVERY = 2;
const INFO_STUDY_BONUS = 0.1;
const WEALTH_WEEKLY_INCOME = 5;
const DEFAULT_WEEKLY_INCOME = 3;
const FREEDOM_IDLE_MULT = 0.5;
const FREEDOM_VACATION_SLOT = 1;
const DEFAULT_FATIGUE_MULT = 1.0;
const DEFAULT_IDLE_MULT = 1.0;

describe('getParentMods', () => {
  it('locks resilience solo contributions', () => {
    const mods = getParentMods(['resilience']);
    expect(mods.initStatBonus).toEqual({
      academic: RESILIENCE_ACADEMIC,
      mental: 0,
      health: RESILIENCE_HEALTH,
    });
    expect(mods.fatigueIncreaseMult).toBe(RESILIENCE_FATIGUE_MULT);
    expect(mods.exerciseEfficiencyBonus).toBe(RESILIENCE_EXERCISE_BONUS);
    // 해당 강점 없을 때 기본값
    expect(mods.weeklyIncome).toBe(DEFAULT_WEEKLY_INCOME);
    expect(mods.studyEfficiencyBonus).toBe(0);
    expect(mods.fatigueRecoveryBonus).toBe(0);
    expect(mods.routineWeeksBoost).toBe(0);
    expect(mods.idlePenaltyMult).toBe(DEFAULT_IDLE_MULT);
    expect(mods.vacationSlotBonus).toBe(0);
    expect(mods.livingCost).toBe(0);
  });

  it('locks strict solo contributions', () => {
    const mods = getParentMods(['strict']);
    expect(mods.initStatBonus).toEqual({
      academic: STRICT_ACADEMIC,
      mental: STRICT_MENTAL,
      health: 0,
    });
    expect(mods.routineWeeksBoost).toBe(STRICT_ROUTINE_BOOST);
    expect(mods.fatigueIncreaseMult).toBe(DEFAULT_FATIGUE_MULT);
    expect(mods.weeklyIncome).toBe(DEFAULT_WEEKLY_INCOME);
  });

  it('locks emotional solo contributions', () => {
    const mods = getParentMods(['emotional']);
    expect(mods.initStatBonus).toEqual({
      academic: 0,
      mental: EMOTIONAL_MENTAL,
      health: 0,
    });
    expect(mods.fatigueRecoveryBonus).toBe(EMOTIONAL_FATIGUE_RECOVERY);
  });

  it('locks info solo contributions', () => {
    const mods = getParentMods(['info']);
    expect(mods.studyEfficiencyBonus).toBe(INFO_STUDY_BONUS);
    expect(mods.initStatBonus).toEqual({ academic: 0, mental: 0, health: 0 });
  });

  it('locks wealth solo contributions', () => {
    const mods = getParentMods(['wealth']);
    expect(mods.weeklyIncome).toBe(WEALTH_WEEKLY_INCOME);
    expect(mods.livingCost).toBe(0);
  });

  it('locks freedom solo contributions', () => {
    const mods = getParentMods(['freedom']);
    expect(mods.idlePenaltyMult).toBe(FREEDOM_IDLE_MULT);
    expect(mods.vacationSlotBonus).toBe(FREEDOM_VACATION_SLOT);
    expect(mods.weeklyIncome).toBe(DEFAULT_WEEKLY_INCOME);
  });

  it('sums initStatBonus across two strengths (strict + emotional)', () => {
    const mods = getParentMods(['strict', 'emotional']);
    // academic: strict 5 / mental: emotional 10 + strict -3 = 7 / health: 0
    expect(mods.initStatBonus).toEqual({
      academic: 5,
      mental: 7,
      health: 0,
    });
    expect(mods.routineWeeksBoost).toBe(STRICT_ROUTINE_BOOST);
    expect(mods.fatigueRecoveryBonus).toBe(EMOTIONAL_FATIGUE_RECOVERY);
  });

  it('locks defaults when no matching strengths are present', () => {
    const empty: readonly ParentStrength[] = [];
    const mods = getParentMods(empty);
    expect(mods.initStatBonus).toEqual({ academic: 0, mental: 0, health: 0 });
    expect(mods.studyEfficiencyBonus).toBe(0);
    expect(mods.exerciseEfficiencyBonus).toBe(0);
    expect(mods.fatigueIncreaseMult).toBe(DEFAULT_FATIGUE_MULT);
    expect(mods.fatigueRecoveryBonus).toBe(0);
    expect(mods.routineWeeksBoost).toBe(0);
    expect(mods.weeklyIncome).toBe(DEFAULT_WEEKLY_INCOME);
    expect(mods.livingCost).toBe(0);
    expect(mods.idlePenaltyMult).toBe(DEFAULT_IDLE_MULT);
    expect(mods.vacationSlotBonus).toBe(0);
  });

  it('sums resilience + wealth without cross-contaminating fields', () => {
    const mods = getParentMods(['resilience', 'wealth']);
    expect(mods.initStatBonus).toEqual({
      academic: RESILIENCE_ACADEMIC,
      mental: 0,
      health: RESILIENCE_HEALTH,
    });
    expect(mods.fatigueIncreaseMult).toBe(RESILIENCE_FATIGUE_MULT);
    expect(mods.exerciseEfficiencyBonus).toBe(RESILIENCE_EXERCISE_BONUS);
    expect(mods.weeklyIncome).toBe(WEALTH_WEEKLY_INCOME);
  });
});
