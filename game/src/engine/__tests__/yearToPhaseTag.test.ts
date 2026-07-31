import { describe, expect, it } from 'vitest';
import { yearToPhaseTag } from '../memorySystem';

// yearToPhaseTag 분기 — memorySystem.ts와 동일한 계약 상수.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
// early: year <= 2 / mid: year <= 4 / else late
const EARLY_MAX = 2;
const MID_MAX = 4;

describe('yearToPhaseTag', () => {
  it('locks phase for every school year 1~7 including 2/3 and 4/5 boundaries', () => {
    // 손계산 리터럴 — year<=2 early, <=4 mid, else late
    expect(yearToPhaseTag(1)).toBe('early');
    expect(yearToPhaseTag(EARLY_MAX)).toBe('early');
    expect(yearToPhaseTag(EARLY_MAX + 1)).toBe('mid'); // 3: early→mid
    expect(yearToPhaseTag(MID_MAX)).toBe('mid'); // 4
    expect(yearToPhaseTag(MID_MAX + 1)).toBe('late'); // 5: mid→late
    expect(yearToPhaseTag(6)).toBe('late');
    expect(yearToPhaseTag(7)).toBe('late');
  });
});
