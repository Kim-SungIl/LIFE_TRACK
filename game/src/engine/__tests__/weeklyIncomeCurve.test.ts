// 주간 용돈 곡선(v8.2)이 **엔진 경로에서 실제로 연차를 타는지** 잠근다.
//
// parentModifiers.test는 getWeeklyIncome 함수 자체만 본다. 그것만으로는 호출부가
// 연차를 잃어도(예: getWeeklyIncome(state.parents, 1)) 안 잡힌다 — v8.1의 구조가
// 정확히 그거였다(학년 무관 상수). 그래서 여기서는 createInitialState와 processWeek를
// 통해 **지급된 금액**을 본다.
//
// 배경: 고정비(학원 2/3/4 + PT 2 = 4/5/6)는 학교급마다 오르는데 용돈은 7년 내내 3만이라,
// 학원+PT를 고정 루틴으로 깔면 무-wealth 기준 169주가 막혔다. 곡선을 4/5/5로 바꿔 해소.
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { getWeeklyIncome } from '../parentModifiers';
import type { GameState, ParentStrength } from '../types';

const PLAIN: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RICH: [ParentStrength, ParentStrength] = ['wealth', 'freedom'];
const RNG_SEED = 42;

// 학교급 경계(Y1 / Y2~4 / Y5~7)를 넘는 대표 연차 — 경계 양쪽을 모두 포함한다.
const ELEMENTARY = 1, MIDDLE_FIRST = 2, MIDDLE_LAST = 4, HIGH_FIRST = 5, HIGH_LAST = 7;

/** 활동을 하나도 고르지 않은 주 — moneyChange가 곧 순 용돈이 되도록 지출을 0으로 만든다. */
function idleWeekAt(year: number, parents: [ParentStrength, ParentStrength]): GameState {
  const s = createInitialState('male', parents, { rngSeed: RNG_SEED });
  return Object.assign(s, {
    year,
    week: 3,              // 시험 주(W8·12·17·30·33·38)·방학(W20~24·43~48) 회피
    isVacation: false,
    weekendChoices: [],
    vacationChoices: [],
    routineSlot2: null,   // 루틴 과금 없음 — moneyChange를 용돈만으로 남긴다
    routineSlot3: null,
  });
}

describe('주간 용돈 곡선 — 엔진 경로', () => {
  it('초기 자금이 초등 구간 용돈과 일치한다 (wealth 포함)', () => {
    expect(createInitialState('male', PLAIN, { rngSeed: RNG_SEED }).money)
      .toBe(getWeeklyIncome(PLAIN, ELEMENTARY));
    expect(createInitialState('male', RICH, { rngSeed: RNG_SEED }).money)
      .toBe(getWeeklyIncome(RICH, ELEMENTARY));
    // 값 자체도 잠근다 — 위 두 줄은 getWeeklyIncome이 통째로 바뀌어도 같이 따라간다.
    expect(createInitialState('male', PLAIN, { rngSeed: RNG_SEED }).money).toBe(4);
    expect(createInitialState('male', RICH, { rngSeed: RNG_SEED }).money).toBe(6);
  });

  it('중학교로 올라가면 주간 지급액이 실제로 오른다 (초등 4 → 중학 5)', () => {
    const elementary = processWeek(idleWeekAt(ELEMENTARY, PLAIN));
    const middle = processWeek(idleWeekAt(MIDDLE_FIRST, PLAIN));

    expect(elementary.weekLog?.moneyChange).toBe(4);
    expect(middle.weekLog?.moneyChange).toBe(5);
    // 부등호까지 — 상수로 회귀하면 두 값이 같아진다
    expect(middle.weekLog!.moneyChange).toBeGreaterThan(elementary.weekLog!.moneyChange);
  });

  it('중학교 끝과 고등학교 시작은 같다 (4/5/5 — 고등 인상 없음이 의도)', () => {
    const middleLast = processWeek(idleWeekAt(MIDDLE_LAST, PLAIN));
    const highFirst = processWeek(idleWeekAt(HIGH_FIRST, PLAIN));

    expect(middleLast.weekLog?.moneyChange).toBe(5);
    expect(highFirst.weekLog?.moneyChange).toBe(5);
  });

  it('wealth 부모는 전 학년에서 +2만원을 더 받는다', () => {
    for (const year of [ELEMENTARY, MIDDLE_FIRST, MIDDLE_LAST, HIGH_FIRST, HIGH_LAST]) {
      const plain = processWeek(idleWeekAt(year, PLAIN));
      const rich = processWeek(idleWeekAt(year, RICH));
      expect(rich.weekLog!.moneyChange - plain.weekLog!.moneyChange).toBe(2);
    }
  });

  // 이 게임의 주력 고정비 — 이게 수입을 넘으면 MainWeekScreen의 routineTooExpensive가
  // 확정 버튼을 잠근다(주를 못 넘김). 학교급마다 "학원+PT ≤ 용돈"인지 직접 확인한다.
  it('학원+PT 고정비가 어느 학교급에서도 주간 용돈을 넘지 않는다 (기본 부모)', () => {
    const academyPlusGym = { elementary: 2 + 2, middle: 3 + 2, high: 4 + 2 };
    expect(getWeeklyIncome(PLAIN, ELEMENTARY)).toBeGreaterThanOrEqual(academyPlusGym.elementary);
    expect(getWeeklyIncome(PLAIN, MIDDLE_FIRST)).toBeGreaterThanOrEqual(academyPlusGym.middle);
    // 고등만 -1만원/주 — 의도된 적자(알바 unlockYear 4가 이미 열려 있어 탈출구가 있다).
    // 등호가 아니라 부등호로 두면 "고등도 균형(4/5/6)"으로 바뀌어도 통과하므로 정확히 -1을 잠근다.
    expect(getWeeklyIncome(PLAIN, HIGH_FIRST) - academyPlusGym.high).toBe(-1);
  });
});
