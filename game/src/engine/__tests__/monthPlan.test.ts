// 한 달 계획 상태 모델 + 봉투 예약 — monthPlan.ts / spendableMoney.ts (설계안 §3·§4).
import { beforeAll, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { getCurrentMonthPlan, getPlannedWeek, plannedWeekCost, reservedMoney, validateMonthPlan } from '../monthPlan';
import { generateMonthInvites } from '../monthInvites';
import { canSpend, canSpendWhilePlanning, getSpendableForPlanning, getSpendableMoney } from '../spendableMoney';
import { isChoiceUnaffordable } from '../eventPresentation';
import { SHOP_ITEMS, canBuyItem } from '../shopSystem';
import { installMemoryStorage } from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';
import type { EventChoice, GameState, MonthPlan } from '../types';

let store: typeof UseGameStore;
beforeAll(async () => {
  installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

/** Y2 4월(W5~8) — 2주차 토 예체능 레슨(2), 3주차 토 친구와 놀기(1)·지훈 동행. */
function aprilPlan(): MonthPlan {
  return {
    year: 2, month: 2,
    weeks: [
      { week: 5, activities: ['light-exercise', 'rest'], npcChoices: {} },
      { week: 6, activities: ['art-lesson', 'self-study'], npcChoices: {} },
      { week: 7, activities: ['hang-out', 'rest'], npcChoices: { 'hang-out:0': 'jihun' } },
      { week: 8, activities: ['library', ''], npcChoices: {} },
    ],
  };
}

function at(week: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 5 });
  return Object.assign(s, {
    year: 2, week, phase: 'weekday' as const, currentEvent: null, isVacation: false,
    routineSlot2: 'self-study', routineSlot3: null, money: 10, monthPlan: aprilPlan(),
  }, patch);
}

describe('계획 고르기 — 지금 달의 계획만 쓴다', () => {
  it('지금 (학년, 달)의 계획만 돌려주고, 지난달·다른 학년·학년 전환 대기는 null', () => {
    expect(getCurrentMonthPlan(at(6))).not.toBeNull();
    expect(getCurrentMonthPlan(at(9))).toBeNull();            // 5월 — 4월 계획은 지난달
    expect(getCurrentMonthPlan(at(6, { year: 3 }))).toBeNull();
    expect(getCurrentMonthPlan(at(49))).toBeNull();
    expect(getPlannedWeek(at(6))?.activities).toEqual(['art-lesson', 'self-study']);
    expect(getPlannedWeek(at(6), 8)?.activities).toEqual(['library', '']);
  });
});

describe('봉투 예약 — 아직 처리 안 된 주의 유료 활동비', () => {
  it('지금 주 이후만 센다 — W5에선 3(레슨 2 + 놀기 1), W7에선 1, W8에선 0', () => {
    expect(reservedMoney(at(5))).toBe(3);
    expect(reservedMoney(at(6))).toBe(3);
    expect(reservedMoney(at(7))).toBe(1);
    expect(reservedMoney(at(8))).toBe(0);
    expect(reservedMoney(at(9)), '지난달 계획은 예약하지 않는다').toBe(0);
  });

  it('여러 칸 활동은 한 번만, 수입 활동은 0으로 센다', () => {
    expect(plannedWeekCost(['intensive-academy', 'intensive-academy', 'rest'], 2)).toBe(5);
    expect(plannedWeekCost(['short-term-job', 'short-term-job', 'rest'], 2)).toBe(0);
    expect(plannedWeekCost(['', ''], 2)).toBe(0);
  });

  it('쓸 수 있는 돈 = 잔액 − 예약, 계획 중(이번 주 편집)엔 이번 주 몫을 빼지 않는다', () => {
    const s = at(6); // 잔액 10, 예약 W6 레슨 2 + W7 놀기 1
    expect(getSpendableMoney(s)).toBe(7);
    expect(getSpendableForPlanning(s)).toBe(9); // W7 놀기 1만 떼어 둔다
    expect(getSpendableMoney(at(6, { money: 1 })), '예약이 잔액보다 크면 0').toBe(0);
    expect(canSpend(s, 7)).toBe(true);
    expect(canSpend(s, 7.1)).toBe(false);
    expect(canSpendWhilePlanning(s, 9)).toBe(true);
    expect(canSpendWhilePlanning(s, 9.1)).toBe(false);
  });

  it('계획이 없으면 예약 0 — 예전과 같다', () => {
    const s = at(6, { monthPlan: undefined });
    expect(reservedMoney(s)).toBe(0);
    expect(getSpendableMoney(s)).toBe(10);
  });

  it('주가 처리되면 그 주 예약은 사라지고, 돈은 엔진이 실제 잔액에서 뺀다', () => {
    const s = at(6, { weekendChoices: ['art-lesson', 'self-study'] });
    expect(reservedMoney(s)).toBe(3);
    const next = processWeek(s);
    expect(next.week).toBe(7);
    expect(reservedMoney(next), 'W6 레슨 몫이 처리 뒤에도 예약에 남았다').toBe(1);
    expect(next.money).toBe(8); // 레슨 2를 실제로 냈다
  });
});

describe('새 지출은 예약을 넘지 못한다 — 선택지·상점', () => {
  it('잔액 5, 남은 예약 3 → 비용 3인 선택지는 잠기고 2는 열린다', () => {
    const s = at(6, { money: 5 });
    const choice = (cost: number) => ({ text: '', message: '', effects: {}, moneyEffect: -cost }) as EventChoice;
    expect(isChoiceUnaffordable(choice(3), s)).toBe(true);
    expect(isChoiceUnaffordable(choice(2), s)).toBe(false);
    expect(isChoiceUnaffordable(choice(3), at(6, { money: 5, monthPlan: undefined })), '짝: 계획이 없으면 열린다').toBe(false);
  });

  it('상점도 예약을 빼고 판다', () => {
    const item = SHOP_ITEMS.find(i => i.price > 0 && i.price <= 5 && !i.requireYear)!;
    expect(item, '전제: 5만원 이하 학년 제한 없는 품목').toBeTruthy();
    const tight = at(6, { money: item.price + 2 }); // 예약 3 > 여유 2
    expect(canBuyItem(item, tight, {}).ok).toBe(false);
    expect(canBuyItem(item, at(6, { money: item.price + 3 }), {}).ok).toBe(true);
  });
});

describe('계획 검증 — store.setMonthPlan이 저장 전에 본다', () => {
  it('맞는 계획은 통과하고 저장된다 (받은 초대에는 답해야 한다 — monthInvites)', () => {
    expect(validateMonthPlan(at(5), aprilPlan())).toBeNull();
    const s = at(5, { monthPlan: undefined });
    const plan = { ...aprilPlan(), invites: generateMonthInvites(s).map(i => ({ ...i, accepted: false })) };
    store.setState({ state: s });
    expect(store.getState().setMonthPlan(plan)).toBeNull();
    expect(store.getState().state!.monthPlan).toEqual(plan);
  });

  it.each<[string, (p: MonthPlan) => void, RegExp]>([
    ['다른 달', p => { p.month = 3; }, /지금 달/],
    ['다른 학년', p => { p.year = 3; }, /지금 달/],
    ['빠진 주', p => { p.weeks.splice(1, 1); }, /주가 맞지 않는다/],
    ['칸 초과(학기 2칸)', p => { p.weeks[0].activities = ['rest', 'rest', 'rest']; }, /상한 2/],
    ['없는 활동', p => { p.weeks[0].activities = ['online-lecture', '']; }, /없는 활동/],
    ['동행이 없는 칸', p => { p.weeks[2].npcChoices = { 'hang-out:1': 'jihun' }; }, /동행/],
    ['동행 키 모양', p => { p.weeks[2].npcChoices = { 'hang-out': 'jihun' }; }, /모양/],
  ])('%s → 거부하고 저장하지 않는다', (_name, mutate, why) => {
    const bad = aprilPlan();
    mutate(bad);
    expect(validateMonthPlan(at(5), bad)).toMatch(why);
    store.setState({ state: at(5, { monthPlan: undefined }) });
    expect(store.getState().setMonthPlan(bad)).toMatch(why);
    expect(store.getState().state!.monthPlan).toBeUndefined();
  });

  it('달 중간에 다시 짜면 지금 주부터 그 달 끝까지만 받는다', () => {
    const rest = aprilPlan();
    rest.weeks = rest.weeks.filter(w => w.week >= 7);
    expect(validateMonthPlan(at(7), rest)).toBeNull();
    expect(validateMonthPlan(at(7), aprilPlan())).toMatch(/주가 맞지 않는다/);
  });

  it('방학 주는 5칸(자유방임이면 6칸)까지', () => {
    const aug: MonthPlan = { year: 2, month: 6, weeks: [21, 22, 23, 24].map(week => ({ week, activities: ['rest', 'rest', 'rest', 'rest', 'rest'], npcChoices: {} })) };
    const s = at(21, { isVacation: true });
    expect(validateMonthPlan(s, aug)).toBeNull();
    aug.weeks[0].activities.push('rest');
    expect(validateMonthPlan(s, aug)).toMatch(/상한 5/);
    expect(validateMonthPlan({ ...s, parents: ['freedom', 'emotional'] }, aug)).toBeNull();
  });
});
