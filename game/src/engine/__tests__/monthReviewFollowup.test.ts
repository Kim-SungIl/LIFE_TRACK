// PR #523 3자 검수 후속 — 월 단위 돈·계획·재생에서 검수자 셋이 찾고 코드로 확인한 결함을 하나씩 잠근다.
// 화면 쪽(계획 화면의 동행 키·방학 횟수·학기 목표, 루틴 피커, 선택지 문구, 달 중간 시험 주)은
// components/__tests__/monthReviewFollowupScreen.test.tsx.
import { beforeAll, describe, expect, it } from 'vitest';
import { createInitialState, predictWeekOutcome, processWeek } from '../gameEngine';
import { ACTIVITIES, getActivityCost } from '../activities';
import {
  getMonthlyAllowance, getRoutineDueCost, getRoutineSwitchCost, incomeNote, payRoutineIfDue, remainingSemesterWeeks,
} from '../monthlyMoney';
import { canSpend, canSpendWhilePlanning } from '../spendableMoney';
import { getConfirmGate } from '../weekendPlan';
import { getMonthBlock, getWeekInfo } from '../weekMath';
import { installMemoryStorage } from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';
import type { GameState, MonthPlan, ParentStrength } from '../types';

let store: typeof UseGameStore;
let storage: Map<string, string>;
beforeAll(async () => {
  storage = installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

const PLAIN: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const unit = (id: string, year = 2) => getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);
const ART = 'art-lesson';

/** Y2 학기 주, 월 단위 돈. 기본은 무료 루틴(자습)이 이번 달 몫으로 이미 결제된 상태. */
function at(week: number, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PLAIN, { rngSeed: 7 });
  return Object.assign(s, {
    year: 2, week, phase: 'weekday' as const, currentEvent: null,
    isVacation: getWeekInfo(week).isVacation, semester: getWeekInfo(week).semester,
    routineSlot2: 'self-study', routineSlot3: null, weekendChoices: [], vacationChoices: [],
    money: 30, monthlyMoney: true,
    routinePrepaid: { year: 2, month: getMonthBlock(week).index, slot2: 'self-study', slot3: null },
  }, patch);
}

/** 지금 주부터 그 달 끝까지의 계획 — 주마다 주말 칸을 준다(없으면 휴식 둘). */
function plan(s: GameState, byWeek: Record<number, string[]> = {}): MonthPlan {
  const b = getMonthBlock(s.week);
  const weeks = [];
  for (let w = s.week; w <= b.endWeek; w++) weeks.push({ week: w, activities: byWeek[w] ?? ['rest', 'rest'], npcChoices: {} });
  return { year: s.year, month: b.index, weeks, invites: [] };
}

describe('선불 결제와 확정 잠금이 같은 물음을 묻는다', () => {
  // 확정 잠금은 이번 주 자신의 예약을 빼지 않는다(canSpendWhilePlanning). 결제만 canSpend였을 때는 그 사이에서
  // 잠금은 열리는데 선불은 거부돼, 선불 기록 없이 주 단위로 청구됐다.
  it('이번 주 예약이 있어도 잠금이 열리는 잔액이면 한 달 몫을 선불하고 기록한다', () => {
    const base = at(6, { routineSlot2: 'academy', routineSlot3: null, routinePrepaid: undefined });
    const due = getRoutineDueCost(base);
    expect(due, '전제: 남은 학기 3주 × 학원 단가').toBe(unit('academy') * 3);
    const art = unit(ART);
    // 이번 주(W6)에만 미술 레슨을 예약 — 다음 주부터 예약은 0이다.
    const s = { ...base, money: due + art / 2 } as GameState;
    s.monthPlan = plan(s, { 6: [ART, 'rest'] });
    expect(canSpendWhilePlanning(s, due), '전제: 확정 잠금의 물음은 참').toBe(true);
    expect(canSpend(s, due), '전제: 예전 결제의 물음은 거짓').toBe(false);
    expect(getConfirmGate(s, { skipped: [] }).routineTooExpensive).toBe(false);

    expect(payRoutineIfDue(s)).toBe(due);
    expect(s.routinePrepaid).toMatchObject({ year: 2, month: getMonthBlock(6).index, slot2: 'academy' });
    expect(s.money).toBe(art / 2);
  });
});

describe('루틴 전환 비용 — 고르기 화면이 확정 잠금과 같은 값을 본다', () => {
  it('달 중간에 유료 루틴으로 바꾸면 남은 학기 주 × 단가, 이미 낸 루틴으로는 0', () => {
    const s = at(6);
    expect(getRoutineSwitchCost(s, 'academy', null)).toBe(unit('academy') * remainingSemesterWeeks(6));
    expect(getRoutineSwitchCost(s, 'self-study', null)).toBe(0);
    // 저녁 칸까지 유료면 둘 다 — setRoutine이 그 상태로 두 칸을 같이 결제한다.
    expect(getRoutineSwitchCost(s, 'academy', 'gym')).toBe((unit('academy') + unit('gym')) * 3);
  });

  it('주 단가는 되지만 한 달 몫은 안 되는 잔액에서 — 전환 비용을 못 내면 확정 잠금이 루틴을 바꾸라고 막는다', () => {
    const s = at(6, { money: unit('academy') * 2 });
    const cost = getRoutineSwitchCost(s, 'academy', null);
    expect(s.money >= unit('academy') && !canSpendWhilePlanning(s, cost), '전제: 주 단가 ≤ 잔액 < 한 달 몫').toBe(true);
    // 피커가 이 값을 안 보면 고르게 해 놓고 여기서 잠근다 — 피커 쪽 잠금은 화면 테스트.
    expect(getConfirmGate({ ...s, routineSlot2: 'academy' } as GameState, { skipped: [] }).routineTooExpensive).toBe(true);
  });
});

describe('봉투 — 이번 주를 늘려 다음 주 예약을 먼저 쓰면 확정이 잠긴다', () => {
  const art = () => unit(ART);
  function breachCase(money: number, thisWeek: string[]) {
    const s = at(6, { money });
    s.monthPlan = plan(s, { 7: [ART, 'rest'] });
    return getConfirmGate(s, predictWeekOutcome(s, thisWeek, {}));
  }

  it('잔액 = 다음 주 예약 + 1에서 이번 주 미술 레슨 → 다음 주 몫을 쓰게 되어 잠긴다', () => {
    const g = breachCase(art() + 1, [ART, 'rest']);
    expect(g.unaffordableIds, '전제: 이번 주 활동 자체는 잔액으로 실행된다').toEqual([]);
    expect(g.reserveBreached).toBe(true);
    expect(g.disabled).toBe(true);
    expect(g.moneyBlocked).toBe(true);
  });

  it('같은 잔액에서 이번 주를 무료로 두면 열린다 · 예약을 정확히 남기는 경계도 열린다', () => {
    expect(breachCase(art() + 1, ['rest', 'rest']).disabled).toBe(false);
    expect(breachCase(art() * 2, [ART, 'rest']).reserveBreached, '잔액 − 이번 주 = 다음 주 예약(경계)').toBe(false);
  });

  it('계획대로 하면 잠기지 않는다 — 이번 주 자기 예약은 "다음 주부터"에 들지 않는다', () => {
    const s = at(6, { money: art() * 2 });
    s.monthPlan = plan(s, { 6: [ART, 'rest'], 7: [ART, 'rest'] });
    const g = getConfirmGate(s, predictWeekOutcome(s, [ART, 'rest'], {}));
    expect(g.reserveBreached).toBe(false);
    expect(g.disabled).toBe(false);
  });

  it('계획이 없으면(플래그 꺼짐) 예약이 0이라 이 잠금은 생기지 않는다', () => {
    const s = at(6, { money: art() + 1 });
    expect(getConfirmGate(s, predictWeekOutcome(s, [ART, 'rest'], {})).reserveBreached).toBe(false);
  });
});

describe('미리보기는 확정처럼 아직 안 낸 루틴비를 먼저 낸다', () => {
  // 이 줄(predictWeekOutcome의 payRoutineIfDue)을 지워도 전체 스위트가 초록이었다(3자 검수 뮤테이션 H).
  it('학원·헬스 미납(남은 3주 몫) + 잔액 = 그 몫 + 1에서 주말 미술 레슨 → 미리보기가 돈 부족으로 말하고 잠근다', () => {
    const base = at(6, { routineSlot2: 'academy', routineSlot3: 'gym', routinePrepaid: undefined });
    const due = getRoutineDueCost(base);
    const s = { ...base, money: due + 1 } as GameState;
    expect(unit(ART) > 1, '전제: 루틴비를 내고 나면 미술 레슨 값이 안 남는다').toBe(true);
    const preview = predictWeekOutcome(s, [ART, 'rest'], {});
    expect(preview.skipped.map(x => x.activityId)).toContain(ART);
    const gate = getConfirmGate(s, preview);
    expect(gate.unaffordableIds).toEqual([ART]);
    expect(gate.disabled).toBe(true);
  });
});

describe('wealth "용돈이 넉넉했다"는 용돈이 보이는 결산에 붙는다', () => {
  const WEALTH: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  const label = (s: GameState) => s.weekLog?.parentBonusesApplied?.some(b => b.parent === 'wealth') ?? false;

  it('달 마지막 주(W4) 결산 = 다음 달 용돈이 실린 결산 — 문구가 거기 있고, 달 첫 주(W5) 결산엔 없다', () => {
    const w4 = processWeek(at(4, { parents: WEALTH, weekendChoices: ['rest', 'rest'] }));
    expect(w4.weekLog!.monthMoney, '전제: W4 결산에 5월 용돈').toBeTruthy();
    expect(label(w4)).toBe(true);
    const w5 = processWeek(at(5, { parents: WEALTH, weekendChoices: ['rest', 'rest'] }));
    expect(w5.weekLog!.monthMoney).toBeUndefined();
    expect(label(w5)).toBe(false);
  });

  it('학년 첫 주(W1)는 용돈이 보류분으로 들어와 W1 결산에 보인다 — 문구도 W1 · 달 중간 주엔 없다', () => {
    expect(label(processWeek(at(1, { parents: WEALTH, weekendChoices: ['rest', 'rest'] })))).toBe(true);
    expect(label(processWeek(at(6, { parents: WEALTH, weekendChoices: ['rest', 'rest'] })))).toBe(false);
  });

  it('wealth가 아니면 어느 주에도 없다', () => {
    expect(label(processWeek(at(4, { weekendChoices: ['rest', 'rest'] })))).toBe(false);
  });
});

describe('HUD 입금 안내 — 학년 마지막 달은 새 학년 단가', () => {
  it('Y1(초6) W45~48은 중1 용돈, W44는 초6 용돈 · Y7 마지막 달은 그대로', () => {
    const y1 = (week: number) => at(week, { year: 1 });
    const elem = getMonthlyAllowance({ parents: PLAIN, year: 1 });
    const middle = getMonthlyAllowance({ parents: PLAIN, year: 2 });
    expect(elem, '전제: 초6과 중1 용돈이 다르다').not.toBe(middle);
    expect(incomeNote(y1(46))).toBe(`다음 달 초 +${middle}만원 입금`);
    expect(incomeNote(y1(45))).toBe(`다음 달 초 +${middle}만원 입금`);
    expect(incomeNote(y1(44))).toBe(`다음 달 초 +${elem}만원 입금`);
    expect(incomeNote(at(46, { year: 7 }))).toBe(`다음 달 초 +${getMonthlyAllowance({ parents: PLAIN, year: 7 })}만원 입금`);
  });
});

describe('손상된 재생 장부 — 세이브를 읽을 때 버린다', () => {
  it('log가 없는 monthRun은 지우고 읽는다 — 다음 확정이 터지지 않는다', () => {
    const s = at(6);
    s.monthPlan = plan(s);
    store.setState({ state: s, npcActivityMap: {} });
    store.getState().setRoutine('self-study', null);
    const raw = JSON.parse(storage.get('lifetrack_save')!);
    const target = raw.state ?? raw;
    target.monthRun = { year: 2, month: getMonthBlock(6).index, status: 'paused' };
    storage.set('lifetrack_save', JSON.stringify(raw));
    store.setState({ state: null });
    expect(store.getState().loadSavedGame()).toBe(true);
    expect(store.getState().state!.monthRun).toBeUndefined();
    expect(() => store.getState().confirmWeek(['rest', 'rest'], {})).not.toThrow();
  });

  it('멀쩡한 장부는 그대로 둔다(playing이면 paused/reload로 접는 기존 규칙만)', () => {
    const s = at(6);
    s.monthPlan = plan(s);
    s.monthRun = {
      year: 2, month: getMonthBlock(6).index, status: 'paused', stop: 'player', log: [], missedTalks: 1,
      startStats: { ...s.stats }, startIntimacy: {}, startMoney: 30,
    };
    store.setState({ state: s, npcActivityMap: {} });
    store.getState().setRoutine('self-study', null);
    store.setState({ state: null });
    expect(store.getState().loadSavedGame()).toBe(true);
    expect(store.getState().state!.monthRun).toMatchObject({ status: 'paused', stop: 'player', missedTalks: 1 });
  });
});
