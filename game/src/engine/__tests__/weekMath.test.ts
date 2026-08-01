import { describe, expect, it } from 'vitest';
import { absWeek } from '../weekMath';

// absWeek 계약: (year-1)*48 + week — 한 학년 48주 가정.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const WEEKS_PER_YEAR = 48;

describe('absWeek', () => {
  it('locks year-1 week boundaries with hand-computed literals', () => {
    // Y1W1 = 0*48 + 1 = 1
    expect(absWeek(1, 1)).toBe(1);
    // Y1W48 = 48
    expect(absWeek(1, WEEKS_PER_YEAR)).toBe(48);
  });

  it('locks Y1→Y2 and mid-game boundaries', () => {
    // Y2W1 = 1*48 + 1 = 49
    expect(absWeek(2, 1)).toBe(49);
    // Y2W48 = 96
    expect(absWeek(2, WEEKS_PER_YEAR)).toBe(96);
    // Y3W1 = 97
    expect(absWeek(3, 1)).toBe(97);
    // Y7W48 = 6*48 + 48 = 336
    expect(absWeek(7, WEEKS_PER_YEAR)).toBe(336);
  });

  it('locks a mid-game in-range value', () => {
    expect(absWeek(4, 20)).toBe(164); // 3*48 + 20
  });
});
