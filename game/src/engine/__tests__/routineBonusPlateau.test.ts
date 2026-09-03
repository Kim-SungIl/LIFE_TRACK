// 루틴 보너스의 평탄화 지점 계약.
//
// UI(WeekPlanner)가 연속 주차를 `ROUTINE_BONUS_PLATEAU_WEEKS`부터 "8주+"로 접는다.
// 그 상수가 실제 평탄화 지점과 어긋나면 UI가 다시 거짓말을 한다 — 예전엔 실제 주차를
// 그대로 뿌려서 "88주 연속"이 계속 쌓이는 보상으로 읽혔다.
//
// 함정이었던 것: 코드 주석은 "12주 캡"이라고 적혀 있었지만 최고 임계가 `capped >= 8`이라
// `Math.min(weeks, 12)`은 값을 전혀 바꾸지 않았다. 즉 **주석의 숫자와 실제 평탄화 지점이
// 달랐다.** 그래서 이 테스트는 상수를 믿지 않고 함수를 직접 훑어 평탄화 지점을 찾는다.
import { describe, it, expect } from 'vitest';
import { getRoutineBonus, ROUTINE_BONUS_PLATEAU_WEEKS } from '../gameEngine';

describe('루틴 보너스 평탄화 지점', () => {
  it('상수가 가리키는 주차에서 보너스가 실제로 마지막으로 오른다 (양방향)', () => {
    // 상향 뮤테이션 방지: 상수를 9로 올리면 bonus(8)===bonus(9)라 이 단언이 깨진다.
    expect(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS - 1))
      .toBeLessThan(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS));

    // 하향 뮤테이션 방지: 상수를 6으로 낮추면 8주에서 또 올라 이 단언이 깨진다.
    const atPlateau = getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS);
    for (let w = ROUTINE_BONUS_PLATEAU_WEEKS; w <= 400; w++) {
      expect(getRoutineBonus(w)).toBe(atPlateau);
    }
  });

  it('평탄화 값을 착지값으로 못박는다 — 티어 표가 바뀌면 UI 접기 기준도 다시 볼 것', () => {
    expect(ROUTINE_BONUS_PLATEAU_WEEKS).toBe(8);
    expect(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS)).toBe(0.3);
  });

  it('상한 아래 구간은 단조 증가하고 구간마다 값이 다르다 (구간 전체를 잠근다)', () => {
    // 특정 length/임계에 기대지 않고 0..상한 구간 전수로 본다.
    for (let w = 1; w <= ROUTINE_BONUS_PLATEAU_WEEKS; w++) {
      expect(getRoutineBonus(w)).toBeGreaterThanOrEqual(getRoutineBonus(w - 1));
    }
    // 3 / 6 / 8 세 티어가 서로 다른 값을 준다 — 하나라도 병합되면 배지 접두(✨⭐🔥)가 거짓이 된다.
    const tiers = [getRoutineBonus(3), getRoutineBonus(6), getRoutineBonus(8)];
    expect(new Set(tiers).size).toBe(3);
    expect(getRoutineBonus(2)).toBe(0);
  });
});
