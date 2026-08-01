import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import {
  applyParentIntimacyDelta,
  applyParentMeanReversion,
  examParentEffect,
  reactionMultiplier,
} from '../parentIntimacy';
import type { ExamResult, GameState, ParentStrength, SubjectKey } from '../types';

const RNG_SEED = 42;

// parentIntimacy 계약 상수 — parentIntimacy.ts 분기와 동일.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
// 사춘기 골짜기: year∈{3,4} ∧ tag∈{familyTime,shareWorry} → ×0.75
const ADOLESCENCE_YEARS = [3, 4] as const; // 중2~중3
const ADOLESCENCE_TAGS = ['familyTime', 'shareWorry'] as const;
// 천장/바닥 감쇠: factor = delta>0 ? (100-pi)/50 : pi/50, clamp[0.2, 1.0]
// 평균 회귀: target 50, k = pi<50 ? 0.006 : 0.01
const MEAN_REVERT_TARGET = 50;

/** 반응 테이블 미정의 태그용 — familyTime/shareWorry/keepPromise/overspend 모두 ×1.0 */
const NEUTRAL_PARENTS: [ParentStrength, ParentStrength] = ['info', 'resilience'];

function fixture(
  parents: [ParentStrength, ParentStrength],
  overrides: Partial<GameState> = {},
): GameState {
  const state = createInitialState('male', parents, { rngSeed: RNG_SEED });
  return Object.assign(state, overrides);
}

function exam(partial: Partial<ExamResult>): ExamResult {
  const emptySubjects = {} as Record<SubjectKey, ExamResult['subjects'][SubjectKey]>;
  return {
    subjects: emptySubjects,
    average: 60,
    rank: null,
    prevRank: null,
    comment: '',
    parentReaction: '',
    teacherReaction: '',
    examType: 'midterm',
    schoolLevel: 'middle',
    year: 3,
    semester: 1,
    ...partial,
  };
}

describe('reactionMultiplier', () => {
  it('hits known table entries (sensitive 1.4 / dull 0.6)', () => {
    expect(reactionMultiplier('emotional', 'shareWorry')).toBe(1.4);
    expect(reactionMultiplier('emotional', 'familyTime')).toBe(1.4);
    expect(reactionMultiplier('emotional', 'gradeImprove')).toBe(0.6);
    expect(reactionMultiplier('strict', 'gradeImprove')).toBe(1.4);
    expect(reactionMultiplier('strict', 'familyTime')).toBe(0.6);
    expect(reactionMultiplier('strict', 'recoveryAction')).toBe(1.4);
    expect(reactionMultiplier('wealth', 'overspend')).toBe(1.4);
    expect(reactionMultiplier('wealth', 'moneyRequest')).toBe(0.6);
    expect(reactionMultiplier('info', 'careerTalk')).toBe(1.4);
    expect(reactionMultiplier('resilience', 'gradeDrop')).toBe(0.6);
    expect(reactionMultiplier('resilience', 'recoveryAction')).toBe(1.4);
    expect(reactionMultiplier('freedom', 'autonomyChoice')).toBe(1.4);
    expect(reactionMultiplier('freedom', 'familyTime')).toBe(0.6);
  });

  it('falls back to 1.0 for undefined strength×tag pairs', () => {
    expect(reactionMultiplier('emotional', 'keepPromise')).toBe(1.0);
    expect(reactionMultiplier('info', 'familyTime')).toBe(1.0);
    expect(reactionMultiplier('resilience', 'shareWorry')).toBe(1.0);
    expect(reactionMultiplier('freedom', 'careerTalk')).toBe(1.0);
    expect(reactionMultiplier('wealth', 'gradeImprove')).toBe(1.0);
  });
});

describe('applyParentIntimacyDelta', () => {
  it('multiplies both parent reaction multipliers (hand-computed)', () => {
    // emotional gradeImprove 0.6 × strict gradeImprove 1.4 = 0.84
    // baseDelta 25 → 25×0.6×1.4 = 21; pi=50 → attenuation ×1.0; year=1 → no valley
    const state = fixture(['emotional', 'strict'], {
      year: 1,
      parentIntimacy: 50,
      parentPositiveTags: {},
    });
    const applied = applyParentIntimacyDelta(state, 25, 'gradeImprove');
    expect(applied).toBe(21);
    expect(state.parentIntimacy).toBe(71);
  });

  it('applies adolescence valley ×0.75 at Y3/Y4 for familyTime/shareWorry', () => {
    // NEUTRAL_PARENTS × familyTime = 1.0×1.0; pi=50 → atten ×1.0
    // baseDelta 8 → Y2: 8 / Y3·Y4: 8×0.75=6 / Y5: 8
    for (const tag of ADOLESCENCE_TAGS) {
      const y2 = fixture(NEUTRAL_PARENTS, { year: 2, parentIntimacy: 50, parentPositiveTags: {} });
      expect(applyParentIntimacyDelta(y2, 8, tag)).toBe(8);
      expect(y2.parentIntimacy).toBe(58);

      const y3 = fixture(NEUTRAL_PARENTS, { year: ADOLESCENCE_YEARS[0], parentIntimacy: 50, parentPositiveTags: {} });
      expect(applyParentIntimacyDelta(y3, 8, tag)).toBe(6);
      expect(y3.parentIntimacy).toBe(56);

      const y4 = fixture(NEUTRAL_PARENTS, { year: ADOLESCENCE_YEARS[1], parentIntimacy: 50, parentPositiveTags: {} });
      expect(applyParentIntimacyDelta(y4, 8, tag)).toBe(6);
      expect(y4.parentIntimacy).toBe(56);

      const y5 = fixture(NEUTRAL_PARENTS, { year: 5, parentIntimacy: 50, parentPositiveTags: {} });
      expect(applyParentIntimacyDelta(y5, 8, tag)).toBe(8);
      expect(y5.parentIntimacy).toBe(58);
    }
    // 사춘기 연도라도 비대상 태그는 감쇠 없음
    const other = fixture(NEUTRAL_PARENTS, { year: 3, parentIntimacy: 50, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(other, 8, 'keepPromise')).toBe(8);
  });

  it('locks ceiling/floor attenuation factor at pi landmarks', () => {
    // NEUTRAL × keepPromise = 1.0; year=1; baseDelta ±10
    // factor+ = (100-pi)/50 clamp[0.2,1]; factor- = pi/50 clamp[0.2,1]
    const pos50 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 50, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(pos50, 10, 'keepPromise')).toBe(10); // ×1.0
    expect(pos50.parentIntimacy).toBe(60);

    const pos70 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 70, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(pos70, 10, 'keepPromise')).toBe(6); // ×0.6
    expect(pos70.parentIntimacy).toBe(76);

    const pos85 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 85, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(pos85, 10, 'keepPromise')).toBe(3); // ×0.3
    expect(pos85.parentIntimacy).toBe(88);

    const pos90 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 90, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(pos90, 10, 'keepPromise')).toBe(2); // ×0.2 (floor clamp)
    expect(pos90.parentIntimacy).toBe(92);

    // pi=100: factor raw 0 → clamp 0.2 → delta 2, but next clamp[0,100] → return 0
    const pos100 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 100, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(pos100, 10, 'keepPromise')).toBe(0);
    expect(pos100.parentIntimacy).toBe(100);

    // overspend: info·resilience 모두 미정의 → ×1.0 (hideProblem은 둘 다 테이블에 있어 부적합)
    const neg50 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 50, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(neg50, -10, 'overspend')).toBe(-10); // ×1.0
    expect(neg50.parentIntimacy).toBe(40);

    const neg30 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 30, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(neg30, -10, 'overspend')).toBe(-6); // ×0.6
    expect(neg30.parentIntimacy).toBe(24);

    // pi=0: factor raw 0 → clamp 0.2 → delta -2, next clamp → 0, return 0
    const neg0 = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 0, parentPositiveTags: {} });
    expect(applyParentIntimacyDelta(neg0, -10, 'overspend')).toBe(0);
    expect(neg0.parentIntimacy).toBe(0);
  });

  it('clamps parentIntimacy into [0, 100]', () => {
    const low = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 1, parentPositiveTags: {} });
    // factor- = 1/50=0.02 → clamp 0.2; base -100 → delta -20 → next max(0,1-20)=0; return -1
    expect(applyParentIntimacyDelta(low, -100, 'overspend')).toBe(-1);
    expect(low.parentIntimacy).toBe(0);

    const high = fixture(NEUTRAL_PARENTS, { year: 1, parentIntimacy: 99, parentPositiveTags: {} });
    // factor+ = (100-99)/50=0.02 → 0.2; base 100 → delta 20 → next min(100,119)=100; return 1
    expect(applyParentIntimacyDelta(high, 100, 'keepPromise')).toBe(1);
    expect(high.parentIntimacy).toBe(100);
  });

  it('credits parentPositiveTags when baseDelta > 0 even if applied ≈ 0', () => {
    const state = fixture(NEUTRAL_PARENTS, {
      year: 1,
      parentIntimacy: 100,
      parentPositiveTags: {},
    });
    const applied = applyParentIntimacyDelta(state, 10, 'keepPromise');
    expect(applied).toBe(0);
    expect(state.parentIntimacy).toBe(100);
    // 천장 감쇠로 적용량 0이어도 의도(baseDelta>0) 기준 적립
    expect(state.parentPositiveTags).toEqual({ keepPromise: 1 });

    // 두 번째 호출 → 카운트 +1
    applyParentIntimacyDelta(state, 5, 'keepPromise');
    expect(state.parentPositiveTags?.keepPromise).toBe(2);

    // baseDelta ≤ 0 → 적립 없음
    const neg = fixture(NEUTRAL_PARENTS, {
      year: 1,
      parentIntimacy: 50,
      parentPositiveTags: { overspend: 3 },
    });
    applyParentIntimacyDelta(neg, -4, 'overspend');
    expect(neg.parentPositiveTags).toEqual({ overspend: 3 });
    applyParentIntimacyDelta(neg, 0, 'keepPromise');
    expect(neg.parentPositiveTags).toEqual({ overspend: 3 });
  });

  it('initializes parentPositiveTags when undefined and baseDelta > 0', () => {
    const state = fixture(NEUTRAL_PARENTS, {
      year: 1,
      parentIntimacy: 50,
    });
    delete state.parentPositiveTags;
    // keepPromise: NEUTRAL_PARENTS 모두 미정의 → ×1.0, applied 2
    applyParentIntimacyDelta(state, 2, 'keepPromise');
    expect(state.parentPositiveTags).toEqual({ keepPromise: 1 });
    expect(state.parentIntimacy).toBe(52);
  });
});

describe('examParentEffect', () => {
  it('locks elementary average thresholds 75 / 45', () => {
    expect(examParentEffect(exam({ schoolLevel: 'elementary', average: 75 }))).toEqual({
      baseDelta: 0.8,
      tag: 'gradeImprove',
    });
    expect(examParentEffect(exam({ schoolLevel: 'elementary', average: 74 }))).toBeNull();
    expect(examParentEffect(exam({ schoolLevel: 'elementary', average: 45 }))).toBeNull();
    expect(examParentEffect(exam({ schoolLevel: 'elementary', average: 44.9 }))).toEqual({
      baseDelta: -1.0,
      tag: 'gradeDrop',
    });
  });

  it('prefers rank improvement over mentalDelta for middle/high', () => {
    // rank < prevRank → gradeImprove (mentalDelta 무시)
    expect(
      examParentEffect(exam({ schoolLevel: 'middle', rank: 5, prevRank: 10, mentalDelta: -3 })),
    ).toEqual({ baseDelta: 0.8, tag: 'gradeImprove' });
  });

  it('uses mentalDelta sign when rank did not improve', () => {
    expect(
      examParentEffect(exam({ schoolLevel: 'high', rank: 10, prevRank: 8, mentalDelta: 2 })),
    ).toEqual({ baseDelta: 0.8, tag: 'gradeImprove' });
    expect(
      examParentEffect(exam({ schoolLevel: 'middle', rank: 10, prevRank: 8, mentalDelta: -1 })),
    ).toEqual({ baseDelta: -1.0, tag: 'gradeDrop' });
    expect(
      examParentEffect(exam({ schoolLevel: 'middle', rank: 10, prevRank: 10, mentalDelta: 0 })),
    ).toBeNull();
  });
});

describe('applyParentMeanReversion', () => {
  it('noops when actedWithParentThisWeek is true', () => {
    const state = fixture(NEUTRAL_PARENTS, {
      parentIntimacy: 70,
      actedWithParentThisWeek: true,
    });
    applyParentMeanReversion(state);
    expect(state.parentIntimacy).toBe(70);
  });

  it('reverts toward 50 with asymmetric k (high faster than low)', () => {
    // pi=60 → k=0.01 → 60 + (50-60)*0.01 = 59.9
    const high = fixture(NEUTRAL_PARENTS, {
      parentIntimacy: 60,
      actedWithParentThisWeek: false,
    });
    applyParentMeanReversion(high);
    expect(high.parentIntimacy).toBe(59.9);

    // pi=40 → k=0.006 → 40 + (50-40)*0.006 = 40.06
    const low = fixture(NEUTRAL_PARENTS, {
      parentIntimacy: 40,
      actedWithParentThisWeek: false,
    });
    applyParentMeanReversion(low);
    expect(low.parentIntimacy).toBe(40.06);

    // 이미 평균이면 변화 없음
    const mid = fixture(NEUTRAL_PARENTS, {
      parentIntimacy: MEAN_REVERT_TARGET,
      actedWithParentThisWeek: false,
    });
    applyParentMeanReversion(mid);
    expect(mid.parentIntimacy).toBe(50);
  });
});
