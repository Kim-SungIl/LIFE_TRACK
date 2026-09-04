// 루틴 보너스 티어 표의 계약.
//
// UI(WeekPlanner)가 배지 접두(✨⭐🔥)와 "· 최대" 표기를 `routineTierIndex`로 고른다. 그래서 표가
// 어긋나면 UI가 그대로 거짓말을 한다 — 실제 보너스는 0.2인데 🔥를 붙이는 식으로.
//
// 함정이었던 것 둘:
// 1) 코드 주석은 "12주 캡"이라 했지만 최고 임계가 8이라 `Math.min(weeks, 12)`은 값을 전혀 바꾸지
//    않았다. **주석의 숫자와 실제 평탄화 지점이 달랐다.** 그래서 상수를 믿지 않고 함수를 훑는다.
// 2) 예전엔 엔진과 UI가 3/6/8을 각자 하드코딩했다. 임계를 한쪽에서만 옮기는 뮤테이션 3건이 전체
//    테스트를 통과했다. 지금은 배열이 SSOT라 구조적으로 갈라질 수 없지만, 그 배열과 함수가
//    갈라지는 것은 여전히 가능하므로 아래에서 잠근다.
import { describe, it, expect } from 'vitest';
import {
  getRoutineBonus, routineTierIndex,
  ROUTINE_TIER_WEEKS, ROUTINE_TIER_BONUS, ROUTINE_BONUS_PLATEAU_WEEKS,
} from '../gameEngine';
import { getParentMods } from '../parentModifiers';

describe('루틴 보너스 티어 표', () => {
  it('상수가 가리키는 주차에서 보너스가 실제로 마지막으로 오른다 (양방향)', () => {
    // 상향 뮤테이션 방지: 상한을 9로 올리면 bonus(8)===bonus(9)라 이 단언이 깨진다.
    expect(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS - 1))
      .toBeLessThan(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS));

    // 하향 뮤테이션 방지: 상한을 6으로 낮추면 8주에서 또 올라 이 단언이 깨진다.
    const atPlateau = getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS);
    for (let w = ROUTINE_BONUS_PLATEAU_WEEKS; w <= 400; w++) {
      expect(getRoutineBonus(w)).toBe(atPlateau);
    }
  });

  it('착지값을 못박는다 — 표가 바뀌면 여기가 먼저 깨져야 한다', () => {
    // 아래 "표와 함수가 일치한다"는 표를 옮기면 같이 움직이므로 그것만으론 항진명제가 된다.
    // 실제 숫자를 여기서 고정해 임계 변경이 반드시 의도적으로 드러나게 한다.
    expect([...ROUTINE_TIER_WEEKS]).toEqual([3, 6, 8]);
    expect([...ROUTINE_TIER_BONUS]).toEqual([0.1, 0.2, 0.3]);
    expect(ROUTINE_BONUS_PLATEAU_WEEKS).toBe(8);
    expect(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS)).toBe(0.3);
  });

  it('표와 함수가 일치한다 — 각 임계에서 정확히 그 티어 값으로 올라선다', () => {
    expect(ROUTINE_TIER_BONUS.length).toBe(ROUTINE_TIER_WEEKS.length);
    ROUTINE_TIER_WEEKS.forEach((w, i) => {
      // 임계 주차에 닿는 순간 그 티어 값이고, 한 주 전에는 아직 아니다.
      expect(getRoutineBonus(w)).toBe(ROUTINE_TIER_BONUS[i]);
      expect(getRoutineBonus(w - 1)).toBeLessThan(ROUTINE_TIER_BONUS[i]);
      expect(routineTierIndex(w)).toBe(i);
      expect(routineTierIndex(w - 1)).toBe(i - 1);
      // 임계는 오름차순이어야 인덱스 탐색이 성립한다.
      if (i > 0) expect(w).toBeGreaterThan(ROUTINE_TIER_WEEKS[i - 1]);
    });
    expect(ROUTINE_BONUS_PLATEAU_WEEKS).toBe(ROUTINE_TIER_WEEKS[ROUTINE_TIER_WEEKS.length - 1]);
  });

  it('상한 아래 구간은 단조 증가하고 구간마다 값이 다르다 (구간 전체를 잠근다)', () => {
    for (let w = 1; w <= ROUTINE_BONUS_PLATEAU_WEEKS; w++) {
      expect(getRoutineBonus(w)).toBeGreaterThanOrEqual(getRoutineBonus(w - 1));
    }
    // 티어끼리 값이 겹치면 배지 접두(✨⭐🔥)가 서로 다른 보너스를 구분하지 못한다.
    const tiers = ROUTINE_TIER_WEEKS.map(getRoutineBonus);
    expect(new Set(tiers).size).toBe(ROUTINE_TIER_WEEKS.length);
    expect(getRoutineBonus(ROUTINE_TIER_WEEKS[0] - 1)).toBe(0);
    expect(routineTierIndex(ROUTINE_TIER_WEEKS[0] - 1)).toBe(-1);
  });

  it('12주 위에 티어를 더해도 죽지 않는다 (예전 min(weeks,12)이 조용히 삼키던 자리)', () => {
    // 회귀 방지용 대역 확인 — min이 되살아나면 12를 넘는 주차가 전부 같은 값으로 눌린다.
    // 지금은 표가 8에서 끝나므로 "상한 이후 일정"이 정상이지만, 임계를 12 위로 옮겼을 때
    // 함수가 따라 올라갈 수 있는 구조인지를 표-함수 일치(위 테스트)와 함께 본다.
    expect(getRoutineBonus(12)).toBe(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS));
    expect(getRoutineBonus(13)).toBe(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS));
    expect(routineTierIndex(9999)).toBe(ROUTINE_TIER_WEEKS.length - 1);
  });

  it('strict 부모는 실효 도달이 1주 빠르다 — UI 판정도 이 보정을 얹어야 한다', () => {
    // 엔진이 `getRoutineBonus(weeks + boost)`로 부른다(applyRoutineActivities).
    // 즉 strict 판에서 실제 평탄화는 생주차 7이다. UI가 8로 판정하면 한 주 동안 거짓말을 한다.
    const boost = getParentMods(['strict', 'info']).routineWeeksBoost;
    expect(boost).toBe(1);
    expect(getParentMods(['emotional', 'info']).routineWeeksBoost).toBe(0);

    // 상한 한 주 전 = strict가 이미 최대인 주차. 같은 생주차에서 두 판이 실제로 갈린다.
    // boost를 0으로 지우는 뮤테이션은 첫 단언에서 걸린다(raw+0 < 상한).
    const rawAtStrictMax = ROUTINE_BONUS_PLATEAU_WEEKS - 1;
    expect(getRoutineBonus(rawAtStrictMax + boost)).toBe(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS));
    expect(getRoutineBonus(rawAtStrictMax)).toBeLessThan(getRoutineBonus(ROUTINE_BONUS_PLATEAU_WEEKS));
  });
});
