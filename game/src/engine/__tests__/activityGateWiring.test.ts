// 활동 게이트 배선 — processWeek 경로에서 canApplyActivity가 실제로 걸리는지.
// 게이트 함수 직접 호출로 대체하면 이 파일의 의미가 없다.
import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  getActivityCost,
} from '../activities';
import { getWeekInfo, processWeek } from '../gameEngine';
import type { Activity, GameState, StatKey } from '../types';
import { makeState } from '../../test/fixtures';

function pickActivity(pred: (a: Activity) => boolean, why: string): Activity {
  const found = ACTIVITIES.find(pred);
  if (!found) throw new Error(why);
  return found;
}

/** processWeek가 week로 isVacation을 덮어쓰므로 학기/방학 주를 명시. */
function semesterWeek(): number {
  for (let w = 2; w <= 19; w++) {
    if (!getWeekInfo(w).isVacation) return w;
  }
  throw new Error('학기 주를 찾지 못함');
}

function vacationWeek(): number {
  for (let w = 20; w <= 48; w++) {
    if (getWeekInfo(w).isVacation) return w;
  }
  throw new Error('방학 주를 찾지 못함');
}

const GATE_SKIP = /⚠ 지금은 .+ 할 수 없어 건너뛰었다/;
const MONEY_SKIP = /💰 돈이 부족해서 .+ 못 했다/;

function runWeek(patch: Partial<GameState>): GameState {
  return processWeek(makeState({
    eventTimeCost: 0,
    routineSlot2: null,
    routineSlot3: null,
    weekendChoices: [],
    vacationChoices: [],
    ...patch,
  }));
}

describe('배선 — 주말/방학 선택 게이트', () => {
  const vacationOnly = pickActivity(
    a => a.seasonGate === 'vacation-only' && a.moneyCost <= 0,
    '무료 vacation-only 활동 없음',
  );

  it('학기 중 weekendChoices에 vacation-only를 넣으면 스킵되고 스탯은 빈 선택과 같다', () => {
    const week = semesterWeek();
    const base = {
      week,
      year: 4,
      money: 999,
      idleWeeks: 0,
      routineSlot2: null as string | null,
      routineSlot3: null as string | null,
    };
    const blocked = runWeek({ ...base, weekendChoices: [vacationOnly.id] });
    const control = runWeek({ ...base, weekendChoices: [] });

    expect(blocked.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(true);
    expect(blocked.weekLog?.messages.some(m => m.includes(`${vacationOnly.name} 완료`))).toBe(false);
    expect(blocked.stats).toEqual(control.stats);

    // 양성 짝: 방학이면 같은 활동이 적용돼 스탯이 변한다
    const vWeek = vacationWeek();
    const applied = runWeek({
      week: vWeek,
      year: 4,
      money: 999,
      idleWeeks: 0,
      vacationChoices: Array.from({ length: vacationOnly.slots }, () => vacationOnly.id),
    });
    const vacControl = runWeek({
      week: vWeek,
      year: 4,
      money: 999,
      idleWeeks: 0,
      vacationChoices: [],
    });
    expect(applied.weekLog?.messages.some(m => m.includes(`${vacationOnly.name} 완료`))).toBe(true);
    expect(applied.stats).not.toEqual(vacControl.stats);
  });
});

describe('배선 — 루틴 슬롯 스테일 work', () => {
  const work = pickActivity(
    a => a.category === 'work' && a.seasonGate !== 'vacation-only',
    '학기 work 활동 없음',
  );

  it('year<4에서 routineSlot2에 work가 박혀 있으면 스킵되고, year>=4면 적용된다', () => {
    const week = semesterWeek();
    const blocked = runWeek({
      week,
      year: 3,
      money: 999,
      routineSlot2: work.id,
      weekendChoices: [],
    });
    expect(blocked.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(true);
    expect(blocked.weekLog?.messages.some(m => m.includes(`${work.name} 완료`))).toBe(false);

    const applied = runWeek({
      week,
      year: 4,
      money: 999,
      routineSlot2: work.id,
      weekendChoices: [],
    });
    expect(applied.weekLog?.messages.some(m => m.includes(`${work.name} 완료`))).toBe(true);
    expect(applied.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(false);
  });

  it('year<4에서 routineSlot3에 work가 박혀 있으면 스킵되고, year>=4면 적용된다', () => {
    const week = semesterWeek();
    const blocked = runWeek({
      week,
      year: 3,
      money: 999,
      routineSlot3: work.id,
      weekendChoices: [],
    });
    expect(blocked.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(true);
    expect(blocked.weekLog?.messages.some(m => m.includes(`${work.name} 완료`))).toBe(false);

    const applied = runWeek({
      week,
      year: 4,
      money: 999,
      routineSlot3: work.id,
      weekendChoices: [],
    });
    expect(applied.weekLog?.messages.some(m => m.includes(`${work.name} 완료`))).toBe(true);
    expect(applied.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(false);
  });
});

describe('배선 — 돈 부족 vs 게이트 위반 메시지', () => {
  it('잔액 부족은 💰, 게이트 위반은 ⚠ — 서로 바뀌지 않는다', () => {
    const week = semesterWeek();
    const paid = pickActivity(
      a => {
        if (a.seasonGate === 'vacation-only') return false;
        if (a.category === 'work') return false;
        const cost = getActivityCost(a, 4);
        return cost > 0 && !a.requires;
      },
      '학기 유료·무requires 활동 없음',
    );
    const cost = getActivityCost(paid, 4);
    const moneyShort = runWeek({
      week,
      year: 4,
      money: cost - 1,
      weekendChoices: [paid.id],
    });
    expect(moneyShort.weekLog?.messages.some(m => MONEY_SKIP.test(m))).toBe(true);
    expect(moneyShort.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(false);

    const vacationOnly = pickActivity(
      a => a.seasonGate === 'vacation-only' && getActivityCost(a, 4) <= 0,
      '무료 vacation-only 없음',
    );
    const gated = runWeek({
      week,
      year: 4,
      money: 999,
      weekendChoices: [vacationOnly.id],
    });
    expect(gated.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(true);
    expect(gated.weekLog?.messages.some(m => MONEY_SKIP.test(m))).toBe(false);
  });
});

// 위 테스트는 "돈 부족만" / "게이트 위반만" 입력이라 검사 순서를 뒤집어도 통과한다.
// gameEngine은 "돈 체크를 먼저(메시지 구분 유지), 그다음 canApplyActivity 게이트"를
// 주말·루틴 두 자리에서 각각 수행하므로, 두 조건이 동시에 참인 입력으로 자리마다 잠근다.
describe('배선 — 돈 부족과 게이트 위반이 동시일 때 우선순위', () => {
  const paidVacationOnly = pickActivity(
    a => a.seasonGate === 'vacation-only' && getActivityCost(a, 4) > 0 && !a.requires,
    '유료·무requires vacation-only 활동 없음',
  );
  const shortMoney = getActivityCost(paidVacationOnly, 4) - 1;

  function expectMoneyWins(state: GameState): void {
    expect(state.weekLog?.messages.some(m => MONEY_SKIP.test(m))).toBe(true);
    expect(state.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(false);
  }

  it('주말 선택 — 학기 중 유료 vacation-only를 잔액 부족으로 고르면 💰만 뜬다', () => {
    expectMoneyWins(runWeek({
      week: semesterWeek(),
      year: 4,
      money: shortMoney,
      weekendChoices: [paidVacationOnly.id],
    }));
  });

  it('루틴 슬롯2 — 같은 조건에서 💰만 뜬다', () => {
    expectMoneyWins(runWeek({
      week: semesterWeek(),
      year: 4,
      money: shortMoney,
      routineSlot2: paidVacationOnly.id,
    }));
  });

  it('루틴 슬롯3 — 같은 조건에서 💰만 뜬다', () => {
    expectMoneyWins(runWeek({
      week: semesterWeek(),
      year: 4,
      money: shortMoney,
      routineSlot3: paidVacationOnly.id,
    }));
  });
});

describe('배선 — 방학 한도 초과', () => {
  it('한도 있는 활동을 초과 배치하면 한도까지만 적용되고 나머지는 스킵된다', () => {
    const limited = pickActivity(
      a => a.seasonGate === 'vacation-only'
        && a.vacationLimit === 1
        && getActivityCost(a, 4) <= 0,
      '무료 vacationLimit===1 활동 없음',
    );
    const vWeek = vacationWeek();
    // slots만큼 반복 = 1 인스턴스, 한 번 더 붙이면 2 인스턴스(한도 1 → 1회 적용+1회 스킵)
    const one = Array.from({ length: limited.slots }, () => limited.id);
    const over = [...one, ...one];

    const result = runWeek({
      week: vWeek,
      year: 4,
      money: 999,
      vacationChoices: over,
      vacationActivityCounts: {},
    });

    const completes = result.weekLog?.messages.filter(m => m.includes(`${limited.name} 완료`)) ?? [];
    const skips = result.weekLog?.messages.filter(m => GATE_SKIP.test(m)) ?? [];
    expect(completes.length).toBe(1);
    expect(skips.length).toBe(1);
    expect(result.vacationActivityCounts?.[limited.id]).toBe(1);

    // 양성: 한도 내 1인스턴스만이면 스킵 없이 적용
    const ok = runWeek({
      week: vWeek,
      year: 4,
      money: 999,
      vacationChoices: one,
      vacationActivityCounts: {},
    });
    expect(ok.weekLog?.messages.filter(m => m.includes(`${limited.name} 완료`)).length).toBe(1);
    expect(ok.weekLog?.messages.some(m => GATE_SKIP.test(m))).toBe(false);
  });
});

describe('배선 — 양성 스탯 변화 (게이트 통과)', () => {
  it('게이트를 통과하는 학기 활동은 빈 선택 대비 스탯이 변한다', () => {
    const study = pickActivity(
      a => a.category === 'study'
        && a.seasonGate !== 'vacation-only'
        && a.moneyCost === 0
        && typeof a.effects.academic === 'number'
        && a.effects.academic > 0,
      '무료 학기 study 활동 없음',
    );
    const week = semesterWeek();
    const base = { week, year: 1, money: 999, idleWeeks: 0 };
    const applied = runWeek({ ...base, weekendChoices: [study.id] });
    const control = runWeek({ ...base, weekendChoices: [] });
    expect(applied.weekLog?.messages.some(m => m.includes(`${study.name} 완료`))).toBe(true);
    const key = 'academic' as StatKey;
    expect(applied.stats[key]).toBeGreaterThan(control.stats[key]);
  });
});
