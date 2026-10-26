// 주간 용돈 곡선(v8.2)이 **엔진 경로에서 실제로 연차를 타는지** 잠근다.
//
// parentModifiers.test는 getWeeklyIncome 함수 자체만 본다. 그것만으로는 호출부가
// 연차를 잃어도(예: getWeeklyIncome(state.parents, 1)) 안 잡힌다 — v8.1의 구조가
// 정확히 그거였다(학년 무관 상수). 그래서 여기서는 createInitialState와 processWeek를
// 통해 **지급된 금액**을 본다.
//
// 배경: 고정비(학원 2/3/4 + PT 2 = 4/5/6)는 학교급마다 오르는데 용돈은 7년 내내 3만이라,
// 학원+PT를 고정 루틴으로 깔면 무-wealth 기준 169주가 막혔다. 곡선을 4/5/5로 바꿔 해소.
//
// 그 뒤에도 **고등만** 6만 > 5만으로 남아 주 −1만이었고, sim 실측으로 Y5~Y7 루틴이 48주 중
// 26~29주 실패했다(매주 반복되는 슬롯의 절반이 안 도는 상태). 처방 B-2로 고등 학원비를
// 4만 → 3만으로 내려 고정비 5만 = 수입 5만이 됐다. 아래 단언이 그 균형을 잠근다 —
// 수입을 올리는 B-3이 아니라 고정비를 내린 이유는 무료 루틴(학원을 안 사는 빌드)의
// 사장액 1543만을 더 키우지 않기 위해서다. docs/weekly-loop-diagnosis-2026-08.md 참조.
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { ACTIVITIES, getActivityCost } from '../activities';
import { getWeeklyIncome } from '../parentModifiers';
import type { GameState, ParentStrength } from '../types';

const PLAIN: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RICH: [ParentStrength, ParentStrength] = ['wealth', 'freedom'];
const RNG_SEED = 42;

// 학교급 경계(Y1 / Y2~4 / Y5~7)를 넘는 대표 연차 — 경계 양쪽을 모두 포함한다.
const ELEMENTARY = 1, MIDDLE_FIRST = 2, MIDDLE_LAST = 4, HIGH_FIRST = 5, HIGH_LAST = 7;

// 월 단위 돈(2026-10, monthlyMoney.ts) 이후: 용돈은 **달 첫 주로 넘어갈 때** 그 달 4주치가 들어온다.
// 그래서 "지급된 금액"은 달 마지막 주(W4)를 처리한 그 주 결산의 `weekLog.monthMoney`(달이 넘어가며 들어온 돈)로 본다.
// 곡선(4/5/5, wealth +2)은 그대로이고 시점만 모였다 — 아래 값은 전부 주 단가 × 4다.

/** 활동을 하나도 고르지 않은 주 — 지출을 0으로 만들어 달 초 입금이 곧 그 달 용돈이 되게 한다. */
function idleWeekAt(year: number, parents: [ParentStrength, ParentStrength], week = 4): GameState {
  const s = createInitialState('male', parents, { rngSeed: RNG_SEED });
  return Object.assign(s, {
    year,
    week,                 // 기본 W4 → 처리 뒤 W5(4월 첫 주)로 넘어가며 그 달 용돈이 들어온다
    isVacation: false,
    weekendChoices: [],
    vacationChoices: [],
    routineSlot2: null,   // 루틴 선불 없음 — 달 초 입금을 용돈만으로 남긴다
    routineSlot3: null,
  });
}

/** 그 주를 처리하며 다음 달로 넘어갈 때 들어온 돈(달 초 입금 − 루틴 선불). 달이 안 넘어가면 0. */
const monthStartDelta = (s: GameState): number => {
  const m = processWeek(s).weekLog?.monthMoney;
  return m ? m.allowance - m.routinePaid : 0;
};

describe('용돈 곡선 — 엔진 경로(월 단위)', () => {
  it('초기 자금이 초등 구간 첫 달 용돈과 일치한다 (주 단가 × 4, wealth 포함)', () => {
    expect(createInitialState('male', PLAIN, { rngSeed: RNG_SEED }).money)
      .toBe(getWeeklyIncome(PLAIN, ELEMENTARY) * 4);
    expect(createInitialState('male', RICH, { rngSeed: RNG_SEED }).money)
      .toBe(getWeeklyIncome(RICH, ELEMENTARY) * 4);
    // 값 자체도 잠근다 — 위 두 줄은 getWeeklyIncome이 통째로 바뀌어도 같이 따라간다.
    expect(createInitialState('male', PLAIN, { rngSeed: RNG_SEED }).money).toBe(16);
    expect(createInitialState('male', RICH, { rngSeed: RNG_SEED }).money).toBe(24);
  });

  it('용돈은 달 초에만 들어온다 — 달 중간 주의 결산엔 용돈이 없다', () => {
    const midMonth = processWeek(idleWeekAt(ELEMENTARY, PLAIN, 2)); // W2 → W3
    expect(midMonth.weekLog?.moneyChange).toBe(0);
    expect(midMonth.weekLog?.monthMoney).toBeUndefined();
    const monthEnd = processWeek(idleWeekAt(ELEMENTARY, PLAIN, 4)); // W4 → W5(4월 초)
    expect(monthEnd.weekLog?.monthMoney).toEqual({ label: '4월', allowance: 16, routinePaid: 0 });
    // 결산의 "이번 주 변화"가 실제 잔액 변화와 같다 — 입금이 다음 주로 미뤄지면 결산이 0이라 말한다
    expect(monthEnd.weekLog?.moneyChange).toBe(16);
  });

  it('중학교로 올라가면 한 달 용돈이 실제로 오른다 (초등 16 → 중학 20)', () => {
    const elementary = monthStartDelta(idleWeekAt(ELEMENTARY, PLAIN));
    const middle = monthStartDelta(idleWeekAt(MIDDLE_FIRST, PLAIN));
    expect(elementary).toBe(16);
    expect(middle).toBe(20);
    expect(middle).toBeGreaterThan(elementary); // 상수로 회귀하면 두 값이 같아진다
  });

  it('중학교 끝과 고등학교 시작은 같다 (4/5/5 — 고등 인상 없음이 의도)', () => {
    expect(monthStartDelta(idleWeekAt(MIDDLE_LAST, PLAIN))).toBe(20);
    expect(monthStartDelta(idleWeekAt(HIGH_FIRST, PLAIN))).toBe(20);
  });

  it('wealth 부모는 전 학년에서 한 달 +8만원(주 +2 × 4)을 더 받는다', () => {
    for (const year of [ELEMENTARY, MIDDLE_FIRST, MIDDLE_LAST, HIGH_FIRST, HIGH_LAST]) {
      expect(monthStartDelta(idleWeekAt(year, RICH)) - monthStartDelta(idleWeekAt(year, PLAIN))).toBe(8);
    }
  });

  it('1년 용돈 합 = 주 단가 × 48 — 시점만 모였고 총액은 예전 매주 지급과 같다', () => {
    // 학년 안의 12번 달 초를 전부 지나며 들어온 돈을 센다(초기 자금 = 첫 달 몫 포함).
    let s = idleWeekAt(MIDDLE_FIRST, PLAIN, 1);
    s.money = getWeeklyIncome(PLAIN, MIDDLE_FIRST) * 4; // W1 몫(학년 전환이 주는 첫 달)을 손으로 넣어 둔다
    let received = s.money;
    for (let w = 1; w <= 47; w++) {
      s.weekendChoices = []; s.vacationChoices = [];
      s = processWeek(s);
      s.currentEvent = null;
      if (s.phase === 'event') s.phase = 'weekday';
      received += s.weekLog?.monthMoney?.allowance ?? 0;
    }
    expect(received).toBe(getWeeklyIncome(PLAIN, MIDDLE_FIRST) * 48);
  });

  // 이 게임의 주력 고정비 — 이게 수입을 넘으면 MainWeekScreen의 routineTooExpensive가
  // 확정 버튼을 잠근다(주를 못 넘김). 학교급마다 "학원+PT vs 용돈"을 직접 확인한다.
  //
  // ⚠ 고정비를 리터럴로 적지 말 것. { elementary: 2+2, ... } 로 하드코딩했더니 학원 yearlyCost를
  //   { 3, 5, 6 }으로 올려 169주 막힘 버그를 그대로 재도입해도 전 테스트가 통과했다(false lock).
  //   비용은 반드시 ACTIVITIES에서 getActivityCost로 유도해 **수입축과 비용축 양쪽**을 잠근다.
  const routineCostAt = (year: number) => {
    const academy = ACTIVITIES.find(a => a.id === 'academy');
    const gym = ACTIVITIES.find(a => a.id === 'gym');
    if (!academy || !gym) throw new Error('academy/gym 활동이 없습니다 — 고정비 계산 불가');
    return getActivityCost(academy, year) + getActivityCost(gym, year);
  };

  it('학원+PT 고정비가 초·중에서는 주간 용돈 이내다 (기본 부모)', () => {
    // 초등 수지균형이 이 PR의 핵심 — 여기가 음수면 이벤트 수입 적립이 안 되고
    // 그 상태로 중학교에 들어가면 초기자금을 25만 줘도 막힘이 안 풀린다.
    expect(getWeeklyIncome(PLAIN, ELEMENTARY) - routineCostAt(ELEMENTARY)).toBe(0);
    expect(getWeeklyIncome(PLAIN, MIDDLE_FIRST) - routineCostAt(MIDDLE_FIRST)).toBe(0);
    expect(getWeeklyIncome(PLAIN, MIDDLE_LAST) - routineCostAt(MIDDLE_LAST)).toBe(0);
  });

  it('고등도 학기 중 잉여 0이다 (B-2 — 정확히 0이라 인상·인하 양쪽을 잡는다)', () => {
    // 0은 "재량 예산이 없다"는 뜻이고 적자는 아니다. 음수면 루틴이 매주 실패하고(실측 26~29주),
    // 양수로 올리면 학원을 사는 빌드에 재량 예산이 생겨 지출형과 무료 루틴의 격차가 줄어든다.
    expect(getWeeklyIncome(PLAIN, HIGH_FIRST) - routineCostAt(HIGH_FIRST)).toBe(0);
    expect(getWeeklyIncome(PLAIN, HIGH_LAST) - routineCostAt(HIGH_LAST)).toBe(0);
    // wealth는 같은 구간에서 +2 — 부모 경제력은 이제 "적자냐"가 아니라 "재량이 있냐"를 가른다.
    expect(getWeeklyIncome(RICH, HIGH_FIRST) - routineCostAt(HIGH_FIRST)).toBe(2);
  });

  // 위 0은 **학기 중 루틴 원장**의 값이다. 루틴은 방학에 아예 안 돌므로 방학 달엔 선불도 0이고,
  // 용돈은 방학 달에도 4주치 들어온다 → 방학 활동이 무료인 빌드는 방학 달에 적립한다(고등 1년 순증).
  // 월 단위에서는 이게 "달 초 입금 − 루틴 선불"로 보인다: 학기 달 0, 방학 달 = 용돈 전액.
  it('방학 달엔 루틴 선불이 없어 고등 1년은 순증이다 (학기 잉여 0이 연간 정체가 아니다)', () => {
    // ⚠ 두 수치 모두 **엔진에서 유도**한다. 방학 달 선불을 0으로 가정해 적으면
    //   remainingSemesterWeeks의 방학 제외를 지워도 통과한다(false lock).
    const monthStartWithRoutine = (lastWeekOfPrevMonth: number): number => {
      const s = createInitialState('male', PLAIN, { rngSeed: RNG_SEED });
      return monthStartDelta(Object.assign(s, {
        year: HIGH_FIRST, week: lastWeekOfPrevMonth, isVacation: lastWeekOfPrevMonth >= 20 && lastWeekOfPrevMonth <= 24,
        routineSlot2: 'academy', routineSlot3: 'gym',
        weekendChoices: [], vacationChoices: [],
        money: 999, // 잔액 부족으로 선불이 안 되는 경우를 배제
      }));
    };
    const semesterMonth = monthStartWithRoutine(4);   // → 4월(W5~8, 학기 4주)
    const vacationMonth = monthStartWithRoutine(20);  // → 8월(W21~24, 방학 4주)
    const mixedMonth = monthStartWithRoutine(16);     // → 7월(W17~20, 학기 3 + 방학 1)

    expect(semesterMonth).toBe(4 * (getWeeklyIncome(PLAIN, HIGH_FIRST) - routineCostAt(HIGH_FIRST)));
    expect(semesterMonth).toBe(0);
    expect(vacationMonth).toBe(4 * getWeeklyIncome(PLAIN, HIGH_FIRST)); // 방학 달은 루틴비가 전혀 없다
    expect(mixedMonth).toBe(4 * getWeeklyIncome(PLAIN, HIGH_FIRST) - 3 * routineCostAt(HIGH_FIRST)); // 학기 3주만 선불
    expect(vacationMonth).toBeGreaterThan(mixedMonth);
    expect(mixedMonth).toBeGreaterThan(semesterMonth);
  });
});
