import { describe, it, expect } from 'vitest';
import { unaffordableInPlan, ACTIVITIES, getActivityCost } from '../activities';
import { processWeek } from '../gameEngine';
import { makeState } from '../../test/fixtures';
import type { GameState } from '../types';

// 계획 화면이 "이 활동은 돈이 모자라 못 한다"고 말하려면, 그 판정이 엔진이 실제로 건너뛰는 것과
// 같아야 한다. 엔진은 활동마다 순차 차감하므로(applyActivity: money - cost, 0 하한, 소수 1자리
// 반올림) 합계 비교로는 **어느 것이** 날아가는지 못 말한다. 아래 패리티 테스트가 그 계약이다.
//
// 이 파일이 잠그는 것: 순서(루틴2 → 루틴3 → 선택 슬롯), 방학 시 루틴 제외, 수입 활동이 뒤
// 슬롯을 살리는 효과, 그리고 무엇보다 **엔진과의 일치**.

/** processWeek가 실제로 돈 때문에 건너뛴 활동 이름들. 엔진은 카운터를 안 남겨 로그가 유일한 신호다. */
function actuallySkipped(s: GameState, plan: string[]): string[] {
  const before = { ...s } as GameState;
  before.weekendChoices = plan;
  before.vacationChoices = plan;
  const after = processWeek(before);
  return (after.weekLog?.messages ?? [])
    .filter(m => m.includes('돈이 부족해서'))
    .map(m => m.replace(/^💰 돈이 부족해서 /, '').replace(/(을|를) 못 했다\.\.\.$/, ''));
}

// 엔진이 주차에서 방학을 재계산한다(getWeekInfo). 픽스처의 isVacation과 week이 어긋나면
// vacation-only 활동이 계절 게이트로 스킵되어 돈 판정이 아닌 이유로 결과가 달라진다.
const VACATION_WEEK = 21;

const cost = (id: string, year = 1) =>
  getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

describe('unaffordableInPlan — 계획 시점 돈 부족 판정', () => {
  it('잔액이 충분하면 아무것도 걸리지 않는다', () => {
    const s = makeState({ money: 50, isVacation: false, routineSlot2: 'academy', routineSlot3: 'gym' });
    expect(unaffordableInPlan(s, ['art-lesson', 'hang-out'])).toEqual([]);
  });

  // 합계만 비교하는 구현은 이 케이스를 "둘 다 못 한다"로 잘못 말한다.
  it('순차 차감이다 — 잔액 3만에 2만짜리 둘이면 뒤의 하나만 못 한다', () => {
    expect(cost('art-lesson')).toBe(2);
    const s = makeState({ money: 3, isVacation: false, routineSlot2: null, routineSlot3: null });
    const out = unaffordableInPlan(s, ['art-lesson', 'gym']);
    expect(out.map(a => a.id)).toEqual(['gym']);
  });

  it('루틴이 먼저 차감된다 — 루틴을 내고 나면 선택 슬롯이 못 돈다', () => {
    const s = makeState({ money: 4, isVacation: false, routineSlot2: 'academy', routineSlot3: null });
    expect(cost('academy')).toBe(2);
    const out = unaffordableInPlan(s, ['art-lesson', 'gym']);
    // 4 − 2(학원) = 2 → 예체능(2) 실행 → 0 → 헬스(2) 못 함
    expect(out.map(a => a.id)).toEqual(['gym']);
  });

  it('방학에는 루틴을 세지 않는다 (엔진이 루틴을 안 돌린다)', () => {
    const base = { money: 2, routineSlot2: 'academy', routineSlot3: 'gym' };
    // week과 isVacation을 함께 맞춘다 — 엔진은 주차에서 방학을 다시 계산하므로 어긋난 픽스처는
    // 계절 게이트(vacation-only)에 걸려 다른 이유로 스킵된다.
    const semester = makeState({ ...base, week: 3, isVacation: false });
    const vacation = makeState({ ...base, week: VACATION_WEEK, isVacation: true });
    // 학기: 학원(2) 실행 → 잔액 0 → 루틴 헬스도, 예체능도 못 한다(루틴 항목까지 함께 반환한다 —
    // 화면은 그중 루틴을 빼고 선택 슬롯만 경고한다).
    expect(unaffordableInPlan(semester, ['art-lesson']).map(a => a.id)).toEqual(['gym', 'art-lesson']);
    // 방학: 루틴이 안 도니 예체능(2)을 낼 수 있다
    expect(unaffordableInPlan(vacation, ['art-lesson'])).toEqual([]);
  });

  it('수입 활동은 뒤 슬롯을 살린다', () => {
    expect(cost('part-time', 4)).toBeLessThan(0);
    const s = makeState({ money: 0, year: 4, isVacation: false, routineSlot2: null, routineSlot3: null });
    // 알바(+3)를 먼저 두면 뒤의 유료 활동이 돈다. 순서를 무시하는 구현은 둘 다 못 한다고 말한다.
    expect(unaffordableInPlan(s, ['part-time', 'art-lesson'])).toEqual([]);
    expect(unaffordableInPlan(s, ['art-lesson', 'part-time']).map(a => a.id)).toEqual(['art-lesson']);
  });

  it('2칸 활동의 인접 중복은 한 번만 센다', () => {
    const two = ACTIVITIES.find(a => a.slots === 2 && getActivityCost(a, 1) > 0);
    expect(two, '전제: 비용 있는 2칸 활동이 있어야 한다').toBeTruthy();
    const c = getActivityCost(two!, 1);
    const s = makeState({ money: c, isVacation: true, routineSlot2: null, routineSlot3: null });
    // 같은 id가 두 슬롯에 저장되지만 비용은 1회 — collapse를 안 하면 "못 한다"가 된다.
    expect(unaffordableInPlan(s, [two!.id, two!.id])).toEqual([]);
  });
});

// 이 게임에서 가장 중요한 단언 — 예측과 실제가 어긋나면 경고가 거짓말이 된다.
describe('엔진 패리티 — 예측과 processWeek의 실제 스킵이 일치한다', () => {
  const cases: { label: string; state: Partial<GameState>; plan: string[] }[] = [
    { label: '가난한 학기 + 유료 주말', state: { money: 1, isVacation: false, routineSlot2: 'academy', routineSlot3: 'gym' }, plan: ['art-lesson', 'hang-out'] },
    { label: '딱 루틴만 되는 잔액', state: { money: 4, isVacation: false, routineSlot2: 'academy', routineSlot3: 'gym' }, plan: ['art-lesson'] },
    { label: '무료 계획', state: { money: 0, isVacation: false, routineSlot2: 'self-study', routineSlot3: 'light-exercise' }, plan: ['self-study', 'club'] },
    { label: '방학 유료 2종', state: { money: 5, isVacation: true, week: VACATION_WEEK }, plan: ['intensive-academy', 'sports-camp'] },
    { label: '고등 학원비 인상 구간', state: { money: 5, year: 6, week: 3, isVacation: false, routineSlot2: 'academy', routineSlot3: 'gym' }, plan: ['hang-out'] },
    { label: '잔액 0', state: { money: 0, isVacation: false, routineSlot2: 'academy', routineSlot3: null }, plan: ['art-lesson', 'gym'] },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const s = makeState(c.state);
      const predicted = unaffordableInPlan(s, c.plan).map(a => a.name).sort();
      const actual = actuallySkipped(s, c.plan).sort();
      expect(predicted, `예측 ${JSON.stringify(predicted)} ≠ 실제 ${JSON.stringify(actual)}`).toEqual(actual);
    });
  }

  // 케이스가 전부 "스킵 0건"이면 패리티는 공허하게 통과한다.
  it('전제: 위 케이스 중 실제로 스킵이 발생하는 것이 있다', () => {
    const total = cases.reduce((n, c) => n + actuallySkipped(makeState(c.state), c.plan).length, 0);
    expect(total, '스킵이 하나도 안 나면 패리티 테스트가 아무것도 잠그지 않는다').toBeGreaterThan(0);
  });
});
