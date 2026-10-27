// 월 단위 돈 — 달 초 용돈·학원 한 달 등록·달 중간 변경(디렉터 결정 (가))·이벤트 결석 무환불·구세이브 이행.
// 규칙의 근거는 monthlyMoney.ts 머리 주석과 docs/monthly-plan-design-2026-10.md §4.
import { beforeAll, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { ACTIVITIES, getActivityCost } from '../activities';
import {
  getMonthlyAllowance, getRoutineDueCost, isMonthStartWeek, payMonthStart, prepaidRoutineSkippedBy,
  remainingSemesterWeeks,
} from '../monthlyMoney';
import { getConfirmGate } from '../weekendPlan';
import { installMemoryStorage } from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';
import type { GameState, ParentStrength } from '../types';

const PLAIN: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const unit = (id: string, year: number) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

let store: typeof UseGameStore;
beforeAll(async () => {
  installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

/** Y2(중학) 학기 주에 서 있는 판 — 학원 3 + 헬스 2 = 주 5 = 주 용돈 5. */
function at(week: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PLAIN, { rngSeed: 7 });
  return Object.assign(s, {
    year: 2, week, phase: 'weekday' as const, currentEvent: null,
    isVacation: (week >= 20 && week <= 24) || week >= 43,
    routineSlot2: 'academy', routineSlot3: 'gym', weekendChoices: [], vacationChoices: [],
    money: 100,
  }, patch);
}

describe('달 첫 주 · 학기 주 수', () => {
  it('달 첫 주는 W1·W5·…·W45 열두 번뿐이고 W49는 아니다', () => {
    const starts = Array.from({ length: 49 }, (_, i) => i + 1).filter(isMonthStartWeek);
    expect(starts).toEqual([1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45]);
  });

  it('남은 학기 주 — 학기 달 4, 7월 3(방학 1), 8월 0, 1월 2, 달 중간은 그 뒤만', () => {
    expect(remainingSemesterWeeks(5)).toBe(4);
    expect(remainingSemesterWeeks(17)).toBe(3);
    expect(remainingSemesterWeeks(21)).toBe(0);
    expect(remainingSemesterWeeks(41)).toBe(2);
    expect(remainingSemesterWeeks(7)).toBe(2); // W7·W8
    expect(remainingSemesterWeeks(49)).toBe(0);
  });
});

describe('달 초 — 그 달 용돈을 받고 학원을 선불한다', () => {
  it.each([
    [5, 4, '학기 달'],
    [17, 3, '7월(학기 3 + 방학 1)'],
    [41, 2, '1월(학기 2 + 방학 2)'],
    [21, 0, '8월(방학) — 루틴비 없음'],
  ])('W%i — 선불 %i주치 (%s)', (week, weeks) => {
    const s = at(week);
    const paid = payMonthStart(s)!;
    const weekly = unit('academy', 2) + unit('gym', 2);
    expect(paid.allowance).toBe(getMonthlyAllowance(s));
    expect(paid.allowance).toBe(20);
    expect(paid.routinePaid).toBe(weekly * weeks);
    expect(s.money).toBe(100 + 20 - weekly * weeks);
    expect(getRoutineDueCost(s), '선불한 달에 또 내라고 한다').toBe(0);
  });

  it('달 첫 주가 아니면 아무것도 안 한다', () => {
    const s = at(6);
    expect(payMonthStart(s)).toBeNull();
    expect(s.money).toBe(100);
  });

  it('돈이 모자라면 학원을 안 내고 두며, 확정 잠금이 루틴을 바꾸라고 막는다', () => {
    // 학원+헬스는 학교급마다 한 달 용돈과 정확히 같게 짜여 있어(학기 잉여 0) 잔액 0이어도 그 달 용돈으로 낸다.
    // 용돈을 넘는 과외(고등)로 모자라는 경우를 만든다.
    const s = at(5, { year: 5, routineSlot2: 'private-tutoring', routineSlot3: null, money: 0 });
    const due = unit('private-tutoring', 5) * 4;
    expect(due, '전제: 한 달 과외비가 한 달 용돈보다 크다').toBeGreaterThan(getMonthlyAllowance(s));
    const paid = payMonthStart(s)!;
    expect(paid.routinePaid).toBe(0);
    expect(s.money).toBe(getMonthlyAllowance(s)); // 용돈은 받았다
    const gate = getConfirmGate(s, { skipped: [] });
    expect(gate.routineCost).toBe(due);
    expect(gate.routineTooExpensive).toBe(true);
    expect(gate.disabled).toBe(true);
  });
});

describe('선불한 학원은 실행할 때 돈을 다시 보지도 빼지도 않는다', () => {
  it('잔액이 0이어도 이미 낸 학원·헬스가 돈다 (자기 비용 requires에 막히지 않는다)', () => {
    // 회귀: 달 초에 한 달 몫을 내면 잔액이 비용보다 작아져 requires(잔액 ≥ 비용)가 이미 낸 학원을 건너뛰었다.
    const s = at(5, { money: 20 });
    payMonthStart(s); // 20 + 20 − 20 = 20 → 다시 0으로 맞춘다
    s.money = 0;
    const next = processWeek(s);
    expect(next.weekLog!.skipped).toEqual([]);
    expect(next.routineSlot2Weeks).toBe(1);
    expect(next.routineSlot3Weeks).toBe(1);
    expect(next.money, '선불했는데 실행 때 또 뺐다').toBe(0);
  });
});

describe('달 중간에 루틴을 바꾸면 — (가) 남은 학기 주 × 새 단가를 바로, 낸 돈은 안 돌아온다', () => {
  it('W6에 헬스 → 무료로, 다시 헬스로: 되돌아와도 남은 주 몫을 또 낸다', () => {
    const s = at(5);
    payMonthStart(s);
    const afterStart = s.money; // 100 + 20 − 20 = 100
    store.setState({ state: { ...s, week: 6 } });
    store.getState().setRoutine('academy', 'light-exercise'); // 헬스(유료) → 가벼운 운동(무료)
    expect(store.getState().state!.money, '무료로 바꿨는데 돈이 돌아왔다/나갔다').toBe(afterStart);
    store.getState().setRoutine('academy', 'gym'); // 다시 헬스 — 기록이 덮였으니 W6~W8 3주 몫을 낸다
    expect(store.getState().state!.money).toBe(afterStart - unit('gym', 2) * 3);
    // 학원은 그대로라 다시 안 낸다
    expect(getRoutineDueCost(store.getState().state!)).toBe(0);
    // 계획 단계의 지출이라 이 주 결산에 보인다(보류분)
    expect(store.getState().state!.pendingWeekDelta?.money).toBe(-unit('gym', 2) * 3);
  });

  it('바꿀 돈이 모자라면 안 내고, 확정할 때 낼 수 있게 됐으면 그때 낸다', () => {
    const s = at(5);
    payMonthStart(s);
    store.setState({ state: { ...s, week: 6, money: 1 } });
    store.getState().setRoutine('academy', 'light-exercise');
    store.getState().setRoutine('academy', 'gym'); // 헬스 3주 몫 6 > 잔액 1 → 못 낸다
    expect(store.getState().state!.money).toBe(1);
    expect(getRoutineDueCost(store.getState().state!)).toBe(unit('gym', 2) * 3);
    store.setState({ state: { ...store.getState().state!, money: 50 } });
    store.getState().confirmWeek([], {});
    const after = store.getState().state!;
    // 확정 직전에 W6~W8 몫(6)을 내고 W6를 진행했다 — 진행 중 학원·헬스는 선불이라 추가 차감이 없다
    expect(after.routinePrepaid?.slot3).toBe('gym');
    expect(after.weekLog!.moneyChange).toBe(-unit('gym', 2) * 3);
  });
});

describe('이벤트로 학원을 빠져도 낸 돈은 안 돌아온다 — 선택지가 미리 말한다', () => {
  it('timeCost 1은 둘째 칸, 2는 두 칸 다 — 이미 낸 유료 칸 이름을 댄다', () => {
    const s = at(5);
    payMonthStart(s);
    expect(prepaidRoutineSkippedBy(s, 1)).toEqual(['헬스/PT']);
    expect(prepaidRoutineSkippedBy(s, 2)).toEqual(['학원 수업', '헬스/PT']);
    expect(prepaidRoutineSkippedBy(s, 0)).toEqual([]);
  });

  it('안 낸 칸·무료 칸·방학 주에는 말하지 않는다', () => {
    const unpaid = at(6);
    expect(prepaidRoutineSkippedBy(unpaid, 2), '안 냈는데 "이미 낸"이라고 한다').toEqual([]);
    const free = at(5, { routineSlot3: 'light-exercise' });
    payMonthStart(free);
    expect(prepaidRoutineSkippedBy(free, 1)).toEqual([]);
    const vac = at(21);
    payMonthStart(vac);
    expect(prepaidRoutineSkippedBy(vac, 2)).toEqual([]);
  });

  it('timeCost로 빠진 주에 돈이 돌아오지 않는다', () => {
    const s = at(5);
    payMonthStart(s);
    const before = s.money;
    s.eventTimeCost = 2;
    const next = processWeek(s);
    expect(next.routineSlot2Weeks + next.routineSlot3Weeks, '전제: 두 칸 다 빠졌다(카운터만 유지)').toBe(2);
    expect(next.money, '빠진 학원비를 돌려줬다').toBe(before);
  });
});

describe('구세이브 — 첫 달 초까지 예전 매주 방식, 거기서 월 단위가 켜진다', () => {
  it('monthlyMoney가 없는 판은 매주 용돈·매주 학원비, 달 초를 지나면 월 단위', () => {
    const legacy = at(6, { money: 30 });
    delete (legacy as Partial<GameState>).monthlyMoney;
    const w6 = processWeek(legacy);
    // 매주: 용돈 +5, 학원 3 + 헬스 2 = −5 → 0
    expect(w6.weekLog!.moneyChange).toBe(0);
    expect(w6.monthlyMoney).toBeUndefined();
    expect(getRoutineDueCost(w6), '구세이브에 남은 주 몫을 한꺼번에 청구한다').toBe(unit('academy', 2) + unit('gym', 2));
    const w7 = processWeek({ ...w6, phase: 'weekday' as const, currentEvent: null });
    const w8 = processWeek({ ...w7, phase: 'weekday' as const, currentEvent: null }); // W8 → W9(5월 초)
    expect(w8.monthlyMoney, '달 초를 지났는데 월 단위가 안 켜졌다').toBe(true);
    expect(w8.weekLog!.monthMoney).toEqual({ label: '5월', allowance: 20, routinePaid: 20 });
  });
});

describe('학년 전환 — 새 학년 3월 용돈은 새 학년 단가로', () => {
  it('Y1 학년말 → Y2 W1: 중학 용돈 20이 그 달 첫 주 보류분으로 들어온다', () => {
    const s = createInitialState('male', PLAIN, { rngSeed: 9 });
    Object.assign(s, { year: 1, week: 49, phase: 'year-end' as const, currentEvent: null, routineSlot2: null, routineSlot3: null, money: 10 });
    store.setState({ state: s });
    store.getState().advanceFromYearEnd();
    const y2 = store.getState().state!;
    expect([y2.year, y2.week]).toEqual([2, 1]);
    expect(y2.money).toBe(30);
    expect(y2.pendingWeekDelta?.money).toBe(20);
  });
});
