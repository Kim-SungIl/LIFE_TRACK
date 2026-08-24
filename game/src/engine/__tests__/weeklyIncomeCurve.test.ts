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

  // 위 0은 **학기 중 루틴 원장**의 값이다. 루틴은 방학에 아예 안 돌지만
  // (applyRoutineActivities의 `if (!state.isVacation)`) 용돈은 48주 전부 지급되므로,
  // 방학 활동이 무료인 빌드는 방학 11주에 지출 없이 적립한다 → 고등 1년은 순증이다.
  // 고등 잉여 0의 실제 기능은 "학기 중 유료 주말/방학까지 얹으면 선택을 강요받는다"이지
  // "알바 없이는 루틴도 못 돌린다"가 아니다(그건 B-2 이전 상태였다).
  it('방학엔 루틴 과금이 없어 고등 1년은 순증이다 (학기 잉여 0이 연간 정체가 아니다)', () => {
    const SCHOOL_WEEKS = 37;   // W1~19 + W25~42
    const VACATION_WEEKS = 11; // W20~24 + W43~48
    expect(SCHOOL_WEEKS + VACATION_WEEKS).toBe(48);

    // ⚠ 두 수치 모두 **엔진에서 유도**한다. vacationNet을 income으로 가정해 적으면
    //   applyRoutineActivities의 `if (!state.isVacation)` 게이트를 지워도 통과한다(false lock).
    const withRoutine = (week: number, isVacation: boolean): number => {
      const s = createInitialState('male', PLAIN, { rngSeed: RNG_SEED });
      const next = processWeek(Object.assign(s, {
        year: HIGH_FIRST, week, isVacation,
        routineSlot2: 'academy', routineSlot3: 'gym',
        weekendChoices: [], vacationChoices: [],   // 주말·방학 지출 0 → 루틴 과금만 남는다
        money: 999,                                // 잔액 부족 스킵을 배제(스킵되면 과금이 사라져 게이트와 구분 불가)
      }));
      return next.weekLog!.moneyChange;
    };

    const schoolNet = withRoutine(3, false);
    const vacationNet = withRoutine(21, true);   // 여름방학 W20~24 중 한 주

    expect(schoolNet).toBe(getWeeklyIncome(PLAIN, HIGH_FIRST) - routineCostAt(HIGH_FIRST));
    expect(schoolNet).toBe(0);
    // 방학 주는 루틴비가 전혀 안 빠져 용돈 전액이 남는다
    expect(vacationNet).toBe(getWeeklyIncome(PLAIN, HIGH_FIRST));
    expect(vacationNet).toBeGreaterThan(schoolNet);
    // 연간 합산이 순증 — 학기에 정체돼도 방학 적립이 남는다
    expect(SCHOOL_WEEKS * schoolNet + VACATION_WEEKS * vacationNet).toBeGreaterThan(0);
  });
});
