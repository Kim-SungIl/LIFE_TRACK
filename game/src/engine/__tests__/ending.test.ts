import { describe, expect, it } from 'vitest';
import { calculateEnding, calculateHappinessGrade } from '../ending';
import { createInitialState } from '../gameEngine';
import type { GameState, ParentStrength, Stats } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// calculateHappinessGrade 임계 — ending.ts 분기와 동일한 계약 상수.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const S_MENTAL = 80;
const S_SOCIAL = 60;
const S_HEALTH = 20;
const A_MENTAL = 60;
const A_SOCIAL = 40;
const B_MENTAL = 40;
const C_MENTAL = 25;

// calculateEnding achievement: bestAxis = max(academic, talent, (mental+health+social)/3)
const ACH_S = 85;
const ACH_A = 70;
const ACH_B = 50;
const ACH_C = 30;

function endingState(stats: Stats, overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.stats = { ...stats };
  return Object.assign(state, overrides);
}

/** academic을 bestAxis로 두고, 약점/붕괴 강등을 피하려고 나머지 축을 floor로 고정 */
function achievementFixture(academic: number, floor = 20): GameState {
  return endingState({
    academic,
    talent: floor,
    mental: floor,
    health: floor,
    social: floor,
  });
}

describe('calculateHappinessGrade', () => {
  it('locks S/A/B/C/D at mental·social·health boundaries', () => {
    // S: mental>=80 && social>=60 && health>=20
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH)).toBe('S');
    expect(calculateHappinessGrade(S_MENTAL - 1, S_SOCIAL, S_HEALTH)).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL - 1, S_HEALTH)).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH - 1)).toBe('A');

    // A: mental>=60 && social>=40
    expect(calculateHappinessGrade(A_MENTAL, A_SOCIAL, 100)).toBe('A');
    expect(calculateHappinessGrade(A_MENTAL - 1, A_SOCIAL, 100)).toBe('B');
    expect(calculateHappinessGrade(A_MENTAL, A_SOCIAL - 1, 100)).toBe('B');

    // B: mental>=40
    expect(calculateHappinessGrade(B_MENTAL, 0, 100)).toBe('B');
    expect(calculateHappinessGrade(B_MENTAL - 1, 0, 100)).toBe('C');

    // C: mental>=25 / else D
    expect(calculateHappinessGrade(C_MENTAL, 0, 100)).toBe('C');
    expect(calculateHappinessGrade(C_MENTAL - 1, 0, 100)).toBe('D');
  });

  it('defaults health to 100 when omitted', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL)).toBe('S');
  });
});

describe('calculateEnding', () => {
  it('locks achievement grades at bestAxis boundaries 29/30·49/50·69/70·84/85', () => {
    expect(calculateEnding(achievementFixture(ACH_S)).achievement).toBe('S');
    expect(calculateEnding(achievementFixture(ACH_S - 1)).achievement).toBe('A');

    expect(calculateEnding(achievementFixture(ACH_A)).achievement).toBe('A');
    expect(calculateEnding(achievementFixture(ACH_A - 1)).achievement).toBe('B');

    expect(calculateEnding(achievementFixture(ACH_B)).achievement).toBe('B');
    expect(calculateEnding(achievementFixture(ACH_B - 1)).achievement).toBe('C');

    expect(calculateEnding(achievementFixture(ACH_C)).achievement).toBe('C');
    expect(calculateEnding(achievementFixture(ACH_C - 1)).achievement).toBe('D');
  });

  it('is deterministic for the same state (deep equality)', () => {
    const state = achievementFixture(ACH_A);
    const a = calculateEnding(state);
    const b = calculateEnding(state);
    expect(a).toEqual(b);
  });

  it('returns core fields with expected types (grade strings, finite total)', () => {
    const result = calculateEnding(achievementFixture(ACH_B));

    expect(result.achievement).toMatch(/^[SABCD]$/);
    expect(result.happiness).toMatch(/^[SABCD]$/);
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(typeof result.career).toBe('string');
    expect(typeof result.careerDetail).toBe('string');
    expect(Number.isFinite(result.total)).toBe(true);
    expect(Array.isArray(result.npcStories)).toBe(true);
    expect(Array.isArray(result.memorialHighlights)).toBe(true);
    expect(Array.isArray(result.regretHighlights)).toBe(true);
    expect(Array.isArray(result.yearClosings)).toBe(true);
    expect(result.parentEpilogue).toEqual(
      expect.objectContaining({
        tier: expect.stringMatching(/^(distant|normal|warm)$/),
        intro: expect.any(String),
        beats: expect.any(Array),
      }),
    );

    // 핵심 필드 존재·등급 스냅샷 (초기 fixture 기준 — 진로/타이틀은 수능 없음 경로)
    expect({
      achievement: result.achievement,
      happiness: result.happiness,
      career: result.career,
      suneungGrade: result.suneungGrade,
      total: result.total,
      parentTier: result.parentEpilogue.tier,
    }).toMatchInlineSnapshot(`
      {
        "achievement": "B",
        "career": "전문대 / 재수",
        "happiness": "D",
        "parentTier": "normal",
        "suneungGrade": null,
        "total": 130,
      }
    `);
  });
});
