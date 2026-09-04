// 돈 궤적(T25)의 계약 — "학년말·엔딩에 돈 한 줄"이 실제로 **살아 있는 데이터**로 그려지는지.
//
// 순수 함수만 잠그면 의미가 없다(#381). 그래서 세 층을 각각 건드린다:
//   ① 적립 배선 — processWeek / applyItemEffects / store.resolveEvent 세 경로가 각각 슬롯을 올리는가
//   ② 문턱 — strapped·hoarded 경계를 **양방향**으로 (넘으면 바뀌고, 한 칸 아래면 안 바뀐다)
//   ③ 구세이브 폴백 — 배열이 없으면 null(=줄 생략)이고, 마이그레이션이 0으로 백필하지 **않는다**
import { describe, it, expect, beforeEach } from 'vitest';
import { ACTIVITIES, getActivityCost, getAvailableActivities } from '../activities';
import { processWeek } from '../gameEngine';
import { applyItemEffects, SHOP_ITEMS } from '../shopSystem';
import { migrateLoadedState } from '../stateMigration';
import { useGameStore } from '../store';
import { assignCurrentEvent } from '../eventPresentation';
import { makeState, makeEvent, makeChoice } from '../../test/fixtures';
import {
  moneyPattern, moneyTrajectoryForYear, moneyTrajectoryLifetime, moneyYearLine, moneyLifeLine,
  recordMoneySpent, emptyMoneyYears,
} from '../moneyTrajectory';
import type { GameState } from '../types';

const cost = (id: string, year = 1) =>
  getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

/** 제품과 같은 SSOT로 "돈만 잠근 몫"을 센다 — 잔액만 무한으로 준 대조군과의 차집합. */
function lockedByMoney(s: GameState): number {
  const now = new Set(getAvailableActivities(s).map(a => a.id));
  return getAvailableActivities({ ...s, money: 99999 }).filter(a => !now.has(a.id)).length;
}

// ============================================================
// ① 적립 배선 — 경로별로 하나씩
// ============================================================
describe('적립 배선 — 세 경로가 각각 학년 슬롯을 올린다', () => {
  it('돈만 없어서 못 고르는 활동이 있던 주가 그 해 tightWeeks에 쌓인다', () => {
    // 착지값을 먼저 못박는다 — 유료 활동이 사라지면 이 케이스가 "돈에 막힘"이 아니게 된다.
    expect(cost('art-lesson')).toBe(2);
    const poor = makeState({ money: 0, year: 1, week: 3, isVacation: false, routineSlot2: 'self-study', routineSlot3: null });
    // 제품과 같은 SSOT로 "돈만 잠근 몫"이 실제로 있는지 먼저 확인한다.
    const now = new Set(getAvailableActivities(poor).map(a => a.id));
    const rich = getAvailableActivities({ ...poor, money: 99999 }).filter(a => !now.has(a.id));
    expect(rich.length).toBeGreaterThan(0);

    const after = processWeek(poor);
    expect(after.moneyTightWeeksByYear![0]).toBe(1);
    expect(after.moneyTightWeeksByYear!.slice(1)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('여러 활동이 잠겨도 주당 1이다 — 활동 수가 아니라 주 수를 센다', () => {
    const poor = makeState({ money: 0, year: 1, week: 3, isVacation: false, routineSlot2: 'self-study', routineSlot3: null });
    const now = new Set(getAvailableActivities(poor).map(a => a.id));
    const locked = getAvailableActivities({ ...poor, money: 99999 }).filter(a => !now.has(a.id));
    expect(locked.length).toBeGreaterThan(1);       // 잠긴 활동은 둘 이상인데
    expect(processWeek(poor).moneyTightWeeksByYear![0]).toBe(1);   // 적립은 1주다
  });

  it('넉넉한 주에는 tightWeeks가 오르지 않는다 (양성 짝)', () => {
    const rich = makeState({
      money: 9999, year: 1, week: 3, isVacation: false,
      routineSlot2: 'self-study', routineSlot3: null,
    });
    expect(processWeek(rich).moneyTightWeeksByYear![0]).toBe(0);
  });

  it('활동 적용 전(계획 시점) 잔액으로 잰다 — 뒤에서 재면 이번 주 지출이 섞여 과대 계상된다', () => {
    // Y5 최고가는 과외 28만. 계획 시점 잔액이 딱 28이면 아무것도 안 잠기지만,
    // 이번 주 지출(학원3+헬스2+예체능2)과 용돈(+5)을 거치면 26이 되어 잠긴다.
    expect(cost('private-tutoring', 5)).toBe(28);
    const s = makeState({
      money: 28, year: 5, week: 3, isVacation: false,
      routineSlot2: 'academy', routineSlot3: 'gym', weekendChoices: ['art-lesson'],
    });
    const lockedBefore = lockedByMoney(s);
    const after = processWeek(s);
    const lockedAfter = lockedByMoney(after);

    // 두 시점이 실제로 다른 답을 내는 픽스처인지 먼저 확인 — 같으면 이 테스트는 아무것도 안 잠근다.
    expect(lockedBefore).toBe(0);
    expect(lockedAfter).toBeGreaterThan(0);
    expect(after.moneyTightWeeksByYear![4]).toBe(0);   // 적립은 '계획 시점' 답을 따른다
  });

  it('활동으로 나간 돈이 그 해 spent에 쌓인다 — 명목이 아니라 실차감액', () => {
    expect(cost('academy')).toBe(2);
    const s = makeState({
      money: 50, year: 1, week: 3, isVacation: false,
      routineSlot2: 'academy', routineSlot3: null, weekendChoices: [],
    });
    const after = processWeek(s);
    expect(after.moneySpentByYear![0]).toBe(2);
  });

  it('잔액보다 비싼 차감은 클램프된 만큼만 지출로 잡힌다', () => {
    const s = makeState({ money: 1.5, year: 2 });
    recordMoneySpent(s, 0);           // 0은 무시된다
    expect(s.moneySpentByYear![1]).toBe(0);
    // 실제 엔진이 넘기는 값은 (before - after)라 잔액을 넘지 못한다.
    recordMoneySpent(s, 1.5);
    expect(s.moneySpentByYear![1]).toBe(1.5);
  });

  it('상점 구매가 지출로 잡힌다', () => {
    const item = SHOP_ITEMS.find(i => i.price > 0)!;
    const s = makeState({ money: item.price + 50, year: 3 });
    const { newState } = applyItemEffects(item, s);
    expect(newState.moneySpentByYear![2]).toBe(item.price);
    expect(newState.moneySpentByYear![0]).toBe(0);   // 다른 해로 새지 않는다
  });

  it('이벤트 선택지로 나간 돈이 지출로 잡히고, 받은 돈은 지출이 아니다', () => {
    const spend = makeEvent({
      id: 't25-spend',
      choices: [makeChoice({ text: '산다', moneyEffect: -5 })],
    });
    const gain = makeEvent({
      id: 't25-gain',
      choices: [makeChoice({ text: '받는다', moneyEffect: 5 })],
    });

    const run = (event: GameState['currentEvent']) => {
      useGameStore.getState().resetGame();
      useGameStore.getState().startGame('male', ['emotional', 'info']);
      const st = { ...useGameStore.getState().state!, year: 4, week: 10, money: 100 };
      assignCurrentEvent(st, event!, 10);
      useGameStore.setState({ state: st });
      useGameStore.getState().resolveEvent(0);
      return useGameStore.getState().state!;
    };

    expect(run(spend).moneySpentByYear![3]).toBe(5);
    expect(run(gain).moneySpentByYear![3]).toBe(0);
  });
});

// ============================================================
// ② 문턱 — 양방향. 한쪽만 두면 분기를 지워도 통과한다.
// ============================================================
describe('패턴 문턱 — 넘으면 바뀌고 한 칸 아래면 안 바뀐다', () => {
  const t = (spent: number, tightWeeks: number, years = 1) => ({ spent, tightWeeks, years });

  it('연 12주 막히면 strapped, 11주면 tight', () => {
    expect(moneyPattern(t(200, 12))).toBe('strapped');
    expect(moneyPattern(t(200, 11))).toBe('tight');
  });

  it('연 3주 막히면 tight, 2주면 지출로 갈린다', () => {
    expect(moneyPattern(t(0, 3))).toBe('tight');
    expect(moneyPattern(t(0, 2))).toBe('hoarded');
    expect(moneyPattern(t(200, 2))).toBe('balanced');
  });

  it('막힌 적 없을 때 연 지출 40만이면 balanced, 39.9만이면 hoarded', () => {
    expect(moneyPattern(t(40, 0))).toBe('balanced');
    expect(moneyPattern(t(39.9, 0))).toBe('hoarded');
  });

  it('7년 합도 같은 문턱을 연 환산으로 쓴다', () => {
    expect(moneyPattern(t(1400, 84, 7))).toBe('strapped');   // 연 12주
    expect(moneyPattern(t(1400, 83, 7))).toBe('tight');
    expect(moneyPattern(t(280, 0, 7))).toBe('balanced');     // 연 40만
    expect(moneyPattern(t(279.9, 0, 7))).toBe('hoarded');
  });

  // 실측 페르소나(5종 × 3시드 × 7년)가 각자 다른 칸에 떨어지는지 — 문턱이 현실과 맞물리는 잠금.
  it('실측 페르소나가 네 칸에 흩어진다', () => {
    expect(moneyPattern(t(15, 0))).toBe('hoarded');       // 무료 루틴: 연 15만, 막힘 0
    expect(moneyPattern(t(221, 0))).toBe('balanced');     // 유료 루틴: 연 221만, 막힘 0
    expect(moneyPattern(t(233, 48))).toBe('strapped');    // 지출형 고등: 48주 통째로 막힘
    expect(moneyPattern(t(323, 4.7))).toBe('tight');      // 지출형+부유한부모 7년 평균
  });

  it('네 패턴이 서로 다른 문장을 낸다 — 라벨이 접히면 회고가 무의미해진다', () => {
    const years = [t(200, 20), t(200, 5), t(0, 0), t(200, 0)].map(x => moneyYearLine(x).title);
    expect(new Set(years).size).toBe(4);
    const lifes = [t(1400, 147, 7), t(1400, 33, 7), t(0, 0, 7), t(1400, 0, 7)]
      .map(x => moneyLifeLine(x, 0).title);
    expect(new Set(lifes).size).toBe(4);
  });

  it('쓰지 않은 7년만 잔액을 이름으로 부른다', () => {
    expect(moneyLifeLine(t(0, 0, 7), 1569).desc).toContain('1,569만원');
    expect(moneyLifeLine(t(1400, 147, 7), 0).desc).not.toContain('만원');
  });
});

// ============================================================
// ③ 구세이브 폴백 — 양방향 잠금(#424)
// ============================================================
describe('구세이브 폴백 — 없으면 침묵, 있으면 말한다', () => {
  it('배열이 없으면 궤적은 null이다 (화면이 줄을 생략하는 근거)', () => {
    expect(moneyTrajectoryForYear({}, 3)).toBeNull();
    expect(moneyTrajectoryLifetime({})).toBeNull();
    // 한쪽만 있어도 판정 불가 — 두 축이 함께 있어야 쪼들림과 안 씀이 갈린다.
    expect(moneyTrajectoryForYear({ moneySpentByYear: emptyMoneyYears() }, 3)).toBeNull();
    expect(moneyTrajectoryForYear({ moneyTightWeeksByYear: emptyMoneyYears() }, 3)).toBeNull();
  });

  it('배열이 있으면 그 해 값을 그대로 읽는다 (양성 짝)', () => {
    const st = { moneySpentByYear: [0, 0, 120, 0, 0, 0, 0], moneyTightWeeksByYear: [0, 0, 4, 0, 0, 0, 0] };
    expect(moneyTrajectoryForYear(st, 3)).toEqual({ spent: 120, tightWeeks: 4, years: 1 });
    expect(moneyTrajectoryForYear(st, 1)).toEqual({ spent: 0, tightWeeks: 0, years: 1 });
    expect(moneyTrajectoryLifetime(st)).toEqual({ spent: 120, tightWeeks: 4, years: 7 });
  });

  it('범위 밖 학년은 null (엔딩 시점 state.year=8 함정)', () => {
    const st = { moneySpentByYear: emptyMoneyYears(), moneyTightWeeksByYear: emptyMoneyYears() };
    expect(moneyTrajectoryForYear(st, 8)).toBeNull();
    expect(moneyTrajectoryForYear(st, 0)).toBeNull();
  });

  it('마이그레이션은 0으로 백필하지 않는다 — 0 배열은 "한 푼도 안 썼다"는 거짓말이 된다', () => {
    const legacy = makeState({ year: 5 });
    delete (legacy as Partial<GameState>).moneySpentByYear;
    delete (legacy as Partial<GameState>).moneyTightWeeksByYear;
    const migrated = migrateLoadedState(legacy);
    expect(migrated.moneySpentByYear).toBeUndefined();
    expect(migrated.moneyTightWeeksByYear).toBeUndefined();
    expect(moneyTrajectoryLifetime(migrated)).toBeNull();
  });

  it('새 판은 배열을 갖고 시작한다 (양성 짝)', () => {
    const fresh = makeState();
    expect(fresh.moneySpentByYear).toEqual(emptyMoneyYears());
    expect(fresh.moneyTightWeeksByYear).toEqual(emptyMoneyYears());
    expect(moneyTrajectoryLifetime(fresh)).not.toBeNull();
  });
});

beforeEach(() => {
  useGameStore.getState().resetGame();
});
