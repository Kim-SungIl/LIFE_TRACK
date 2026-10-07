// **T66 — 회복을 인정하는 한 줄.** 행복 등급은 그대로 두고(궤적 캡은 의도된 설계), 학년별 궤적이
// "무너졌다가 다시 일어나 끝났다"를 뒷받침하는 판에만 관찰 문장을 낸다.
//
// 잠그는 것:
//   · 근거는 학년별 궤적이다 — 마지막 스냅샷이 좋아도 궤적이 회복을 말하지 않으면 미출력.
//   · 문턱 양방향: 단단한 꼬리 1해/2해, 무너진 해 C/B 경계(저멘탈 10주/9주, 바닥 2주/1주, 번아웃 3/2),
//     단단한 해 A/B 경계(저멘탈 3주/4주), 졸업 순간 mental 40/39.9.
//   · 근거 없는 구세이브(배열 없음·0 백필)는 미출력.
//   · 등급·타이틀·진로 불변 — 회복 판과 같은 판에서 회복 근거만 지운 판의 판정 층이 같다.
import { describe, expect, it } from 'vitest';
import {
  calculateEnding, recoveryClaimOf, recoveryNoteOf, RECOVERY_FINAL_MENTAL, RECOVERY_MIN_CLEAN_YEARS, RECOVERY_NOTE,
} from '../ending';
import { createInitialState } from '../gameEngine';
import { judgmentLine } from './endingStateGrid';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

interface Traj { low?: readonly number[]; vlow?: readonly number[]; bo?: readonly number[]; mental?: number }
const Z = [0, 0, 0, 0, 0, 0, 0];

function st(t: Traj): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 3 });
  s.stats = { academic: 70, talent: 50, social: 60, mental: t.mental ?? 85, health: 70 };
  s.lowMentalWeeksByYear = [...(t.low ?? Z)];
  s.veryLowMentalWeeksByYear = [...(t.vlow ?? Z)];
  s.burnoutCountByYear = [...(t.bo ?? Z)];
  return s;
}

describe('recoveryClaimOf — 궤적이 회복을 뒷받침할 때만', () => {
  it('중2에 크게 무너지고(저멘탈 20주) 고1~고3을 단단하게 보낸 판 → 출력', () => {
    const c = recoveryClaimOf(st({ low: [0, 0, 20, 5, 0, 0, 0] }));
    expect(c).toEqual({ lastFallenYear: 3, cleanTailYears: 3 });
    expect(recoveryNoteOf(st({ low: [0, 0, 20, 5, 0, 0, 0] }))).toBe(RECOVERY_NOTE);
  });

  it('한 번도 무너지지 않은 판 → 미출력(회복할 게 없다)', () => {
    expect(recoveryClaimOf(st({}))).toBeNull();
    expect(recoveryClaimOf(st({ low: [3, 9, 0, 0, 0, 0, 0] }))).toBeNull(); // B·A만 있는 판
  });

  it('끝까지 무너져 있던 판 → 미출력', () => {
    expect(recoveryClaimOf(st({ low: [0, 20, 20, 20, 20, 20, 20], mental: 85 }))).toBeNull();
  });

  // 꼬리 길이 문턱 — 양방향.
  it(`단단한 꼬리 ${RECOVERY_MIN_CLEAN_YEARS}해 → 출력 / ${RECOVERY_MIN_CLEAN_YEARS - 1}해 → 미출력`, () => {
    expect(RECOVERY_MIN_CLEAN_YEARS).toBe(2);
    expect(recoveryClaimOf(st({ low: [0, 0, 0, 0, 20, 0, 0] }))?.cleanTailYears).toBe(2);
    expect(recoveryClaimOf(st({ low: [0, 0, 0, 0, 0, 20, 0] }))).toBeNull();
  });

  // 무너진 해 = 그 해 궤적 C 이상(학년말 카드와 같은 산식). 경계 양쪽.
  it.each([
    ['저멘탈 10주(20.8%) → 무너진 해', { low: [0, 0, 10, 0, 0, 0, 0] }, true],
    ['저멘탈 9주(18.8%) → 흔들린 해(B)일 뿐', { low: [0, 0, 9, 0, 0, 0, 0] }, false],
    ['바닥 2주(4.2%) → 무너진 해', { low: [0, 0, 2, 0, 0, 0, 0], vlow: [0, 0, 2, 0, 0, 0, 0] }, true],
    ['바닥 1주(2.1%) → 흔들린 해(B)', { low: [0, 0, 1, 0, 0, 0, 0], vlow: [0, 0, 1, 0, 0, 0, 0] }, false],
    ['번아웃 3회 → 무너진 해', { bo: [0, 0, 3, 0, 0, 0, 0] }, true],
    ['번아웃 2회 → 흔들린 해(B)', { bo: [0, 0, 2, 0, 0, 0, 0] }, false],
  ] as const)('%s', (_l, t, shown) => {
    expect(recoveryClaimOf(st(t)) !== null).toBe(shown);
  });

  // 단단한 해 = 그 해 궤적 S·A. A/B 경계 양쪽 — B 한 해가 꼬리를 끊는다.
  it.each([
    ['꼬리에 저멘탈 3주인 해(A) → 꼬리 유지', { low: [0, 20, 0, 0, 0, 3, 3] }, true],
    ['꼬리에 저멘탈 4주인 해(B) → 꼬리가 끊긴다', { low: [0, 20, 0, 0, 0, 0, 4] }, false],
    ['꼬리에 번아웃 1회(B) → 꼬리가 끊긴다', { low: [0, 20, 0, 0, 0, 0, 0], bo: [0, 0, 0, 0, 0, 0, 1] }, false],
  ] as const)('%s', (_l, t, shown) => {
    expect(recoveryClaimOf(st(t)) !== null).toBe(shown);
  });

  it(`졸업 순간 mental ${RECOVERY_FINAL_MENTAL} → 출력 / 39.9 → 미출력(궤적이 좋아도 다시 가라앉아 끝났다)`, () => {
    const t = { low: [0, 20, 0, 0, 0, 0, 0] };
    expect(recoveryClaimOf(st({ ...t, mental: 40 }))).not.toBeNull();
    expect(recoveryClaimOf(st({ ...t, mental: 39.9 }))).toBeNull();
  });

  it('스냅샷만으로는 주장하지 않는다 — mental 100이어도 궤적에 무너진 해가 없으면 미출력', () => {
    expect(recoveryClaimOf(st({ mental: 100 }))).toBeNull();
  });

  it('구세이브: 학년별 배열 중 하나라도 없으면 판정 불가 — 남은 배열이 무너진 해를 말해도 미출력', () => {
    // 번아웃 배열은 Y2 C(번아웃 3)를 말하지만 저멘탈 배열이 없다 — 없는 배열을 0으로 읽으면
    // "그 뒤 단단한 해"를 지어내게 된다(저멘탈 주가 실제로 있었는지 모른다).
    const s = st({ bo: [0, 3, 0, 0, 0, 0, 0] }) as Partial<GameState> & GameState;
    expect(recoveryClaimOf(s), '전제: 배열이 다 있으면 출력되는 판').not.toBeNull();
    delete (s as Partial<GameState>).lowMentalWeeksByYear;
    expect(recoveryClaimOf(s)).toBeNull();
    expect(calculateEnding(s).recoveryNote).toBeNull();
  });

  it('구세이브: T21 이전처럼 0 백필된 배열은 무너진 해를 못 찾아 미출력', () => {
    expect(recoveryClaimOf(st({ low: [...Z], vlow: [...Z], bo: [...Z] }))).toBeNull();
  });
});

describe('calculateEnding — 회복 층은 판정을 하나도 바꾸지 않는다', () => {
  it('회복 근거만 다른 두 판(무너진 해 저멘탈 10주 vs 9주, 행복은 둘 다 A)은 판정 층이 같고 회복 문장만 다르다', () => {
    // 같은 판정 층을 보려면 행복 궤적 캡이 같아야 한다 — 7년 창에서 둘 다 A가 되는 쌍을 쓴다.
    // 회복 판: 저멘탈 10주 한 해(7년 창 10/336 = 3% → A). 비교 판: 9주(2.7% → A).
    const recovered = calculateEnding(st({ low: [0, 10, 0, 0, 0, 0, 0] }));
    const shaky = calculateEnding(st({ low: [0, 9, 0, 0, 0, 0, 0] }));
    expect(recovered.recoveryNote).toBe(RECOVERY_NOTE);
    expect(shaky.recoveryNote).toBeNull();
    expect(recovered.happiness).toBe('A');
    expect(judgmentLine(recovered)).toBe(judgmentLine(shaky));
  });

  it('엔딩 데이터의 recoveryNote는 recoveryNoteOf와 같은 값이다(두 층이 따로 계산하지 않는다)', () => {
    for (const t of [{}, { low: [0, 0, 20, 0, 0, 0, 0] }, { low: [0, 0, 0, 0, 0, 20, 0] }] as Traj[]) {
      const s = st(t);
      expect(calculateEnding(s).recoveryNote).toBe(recoveryNoteOf(s));
    }
  });
});
