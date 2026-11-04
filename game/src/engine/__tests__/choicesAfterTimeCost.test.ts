// 시간 소모로 빠지는 칸 — 배열 길이가 아니라 **칸 수** 기준으로 뒤에서부터 지운다.
// 배열 길이로 자르면 토요일만 채운 주(`['hang-out']`)에 토요일이 지워져, 같은 화면이 저장 모양에 따라 갈렸다
// (약속 칸 경고 3자 검수). 엔진(applyWeekendActivities)과 재생 기록(monthPlayback.recordWeek)이 이 함수 하나를 쓴다.
import { describe, expect, it } from 'vitest';
import { choicesAfterTimeCost, SEMESTER_WEEKEND_SLOTS, VACATION_BASE_SLOTS } from '../slotCount';

describe('choicesAfterTimeCost', () => {
  it('주말 — 토요일만 채운 주는 빈 일요일이 빠지고 토요일은 남는다', () => {
    expect(choicesAfterTimeCost(['hang-out'], SEMESTER_WEEKEND_SLOTS, 1)).toEqual(['hang-out']);
    expect(choicesAfterTimeCost(['hang-out', ''], SEMESTER_WEEKEND_SLOTS, 1)).toEqual(['hang-out']);
    expect(choicesAfterTimeCost(['hang-out', 'rest'], SEMESTER_WEEKEND_SLOTS, 1)).toEqual(['hang-out']);
  });

  it('주말 — 일요일 칸은 시간 소모 1에 빠지고, 2면 둘 다 빠진다', () => {
    expect(choicesAfterTimeCost(['', 'hang-out'], SEMESTER_WEEKEND_SLOTS, 1)).toEqual(['']);
    expect(choicesAfterTimeCost(['rest', 'hang-out'], SEMESTER_WEEKEND_SLOTS, 2)).toEqual([]);
    expect(choicesAfterTimeCost(['rest'], SEMESTER_WEEKEND_SLOTS, 2)).toEqual([]);
  });

  it('방학 — 앞 3칸만 채운 주는 빈 꼬리 칸이 빠진다', () => {
    const plan = ['self-study', 'creative', 'rest'];
    expect(choicesAfterTimeCost(plan, VACATION_BASE_SLOTS, 1)).toEqual([...plan, '']);
    expect(choicesAfterTimeCost(plan, VACATION_BASE_SLOTS, 2)).toEqual(plan);
    expect(choicesAfterTimeCost(plan, VACATION_BASE_SLOTS + 1, 2), 'freedom 보너스 칸').toEqual([...plan, '']);
  });

  it('시간 소모 0은 칸 수만큼 구멍 없이 채워 그대로 둔다', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(choicesAfterTimeCost([, 'rest'] as string[], SEMESTER_WEEKEND_SLOTS, 0)).toEqual(['', 'rest']);
    expect(choicesAfterTimeCost(['rest'], SEMESTER_WEEKEND_SLOTS, 0)).toEqual(['rest', '']);
  });

  it('칸 수보다 긴 입력은 그 길이 기준으로 자른다(잘못된 입력에서 칸을 늘리지 않는다)', () => {
    expect(choicesAfterTimeCost(['a', 'b', 'c'], SEMESTER_WEEKEND_SLOTS, 1)).toEqual(['a', 'b']);
  });
});
