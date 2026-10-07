/**
 * T67 — 결산의 두 화자가 반대로 말하지 않는다.
 *
 * 결산 독백(getResultDialogue)의 "잘 늘었다" 풀과 성장 둔화 줄은 같은 화면에 선다. 엔진은 잘 는 주
 * (GOOD_WEEK_AXIS_GAIN)에 둔화 줄을 안 내지만, 이벤트 몫이 결산 뒤에 로그로 접히면 둘이 겹칠 수 있다.
 * 그때 독백이 "공부가 손에 잡힌 한 주였다"를 고르면 바로 아래 줄의 "피곤해서 집중하지 못했다"와
 * 정면으로 부딪힌다 — 그래서 독백 쪽이 물러선다. 주당 상한 줄은 잘 는 주의 해설이라 예외다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getResultDialogue } from '../dialogues';
import { createInitialState } from '../gameEngine';
import { GOOD_WEEK_AXIS_GAIN } from '../growthDrag';
import type { WeekLog } from '../types';

const GOOD_ACADEMIC = ['공부가 손에 잡힌 한 주였다.', '머리가 잘 돌아간 느낌이야.', '문제집 한 권을 끝낸 기분.'];

function goodWeek(reason?: WeekLog['growthReason']): WeekLog {
  return {
    statChanges: { academic: GOOD_WEEK_AXIS_GAIN + 0.3 }, fatigueChange: 0, moneyChange: 0,
    messages: [], skipped: [], milestoneMessages: [], parentBonusesApplied: [],
    growthReason: reason,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('결산 독백 × 성장 둔화 줄', () => {
  const s = createInitialState('male', ['emotional', 'freedom'], { rngSeed: 3 });

  it('둔화 줄이 없으면 잘 는 주의 독백이 뜬다 (양성 대조)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(GOOD_ACADEMIC).toContain(getResultDialogue(s, goodWeek()));
  });

  it('피로 둔화 줄이 떠 있으면 "잘 늘었다" 독백을 고르지 않는다', () => {
    for (const r of [0, 0.4, 0.8]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      expect(GOOD_ACADEMIC).not.toContain(getResultDialogue(s, goodWeek({ factor: 'fatigue', axis: 'academic', variant: 0 })));
    }
  });

  it('주당 상한 줄은 잘 는 주와 함께 설 수 있다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(GOOD_ACADEMIC).toContain(getResultDialogue(s, goodWeek({ factor: 'weeklyCap', axis: 'academic', variant: 0 })));
  });
});
