// 돈 궤적(T25)의 계약 — "학년말·엔딩에 돈 한 줄"이 실제로 **살아 있는 데이터**로 그려지는지.
//
// 순수 함수만 잠그면 의미가 없다(#381). 그래서 네 층을 각각 건드린다:
//   ① 지출 적립 — 활동/상점/이벤트 선택지/미니톡 네 경로가 각각 슬롯을 올리는가
//   ② 막힌 주 적립 — store.markMoneyBlockedWeek가 학년 슬롯을 올리고 주당 1회로 접히는가
//   ③ 문턱 — 학년·7년 각각 **양방향**으로 (넘으면 바뀌고, 한 칸 아래면 안 바뀐다)
//   ④ 구세이브·손상 세이브 — 기록기가 배열을 만들지 않아 결정론적으로 침묵하는가
import { describe, it, expect, beforeEach } from 'vitest';
import { ACTIVITIES, getActivityCost } from '../activities';
import { processWeek } from '../gameEngine';
import { applyItemEffects, SHOP_ITEMS } from '../shopSystem';
import { migrateLoadedState } from '../stateMigration';
import { useGameStore } from '../store';
import { assignCurrentEvent } from '../eventPresentation';
import { makeState, makeEvent, makeChoice } from '../../test/fixtures';
import { NPC_MINI_EVENTS } from '../talkData';
import {
  moneyPatternForYear, moneyPatternLifetime, moneyTrajectoryForYear, moneyTrajectoryLifetime,
  moneyYearLine, moneyLifeLine, recordMoneySpent, recordMoneyBlockedWeek,
  emptyMoneyYears, hasMoneyTracking, type MoneyTrajectory,
} from '../moneyTrajectory';
import type { GameState } from '../types';

const cost = (id: string, year = 1) =>
  getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

beforeEach(() => {
  localStorage.clear();
  useGameStore.getState().resetGame();
});

// ============================================================
// ① 지출 적립 — 경로별로 하나씩. 착지값을 toBe로 못박는다.
// ============================================================
describe('지출 적립 — 네 경로가 각각 학년 슬롯을 올린다', () => {
  it('활동으로 나간 돈이 그 해 spent에 쌓인다 — 명목이 아니라 실차감액', () => {
    expect(cost('academy')).toBe(2);
    const s = makeState({
      money: 50, year: 1, week: 3, isVacation: false,
      routineSlot2: 'academy', routineSlot3: null, weekendChoices: [],
    });
    const after = processWeek(s);
    expect(after.moneySpentByYear![0]).toBe(2);
    expect(after.moneySpentByYear!.slice(1)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('잔액이 부족하면 클램프된 만큼만 지출로 잡힌다', () => {
    const s = makeState({ money: 1.5, year: 2 });
    recordMoneySpent(s, 0);                       // 0은 무시
    expect(s.moneySpentByYear![1]).toBe(0);
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
    const run = (moneyEffect: number) => {
      useGameStore.getState().resetGame();
      useGameStore.getState().startGame('male', ['emotional', 'info']);
      const st = { ...useGameStore.getState().state!, year: 4, week: 10, money: 100 };
      const ev = makeEvent({ id: `t25-${moneyEffect}`, choices: [makeChoice({ text: '고른다', moneyEffect })] });
      assignCurrentEvent(st, ev, 10);
      useGameStore.setState({ state: st });
      useGameStore.getState().resolveEvent(0);
      return useGameStore.getState().state!;
    };
    expect(run(-5).moneySpentByYear![3]).toBe(5);
    expect(run(5).moneySpentByYear![3]).toBe(0);
  });

  // 제품에는 있는데 테스트가 안 타던 경로(3자 검수 지적). 실제 데이터에 money 음수가 있다.
  it('NPC 미니이벤트로 나간 돈이 지출로 잡힌다', () => {
    const paid = NPC_MINI_EVENTS.filter(e => (e.effects?.money ?? 0) < 0);
    expect(paid.length, '돈을 쓰는 NPC 미니이벤트가 데이터에 있어야 이 케이스가 성립한다').toBeGreaterThan(0);
    const npcId = paid[0].npcId!;

    useGameStore.getState().startGame('male', ['emotional', 'info']);
    const base = useGameStore.getState().state!;
    // 대상 NPC만 발동 자격을 갖게 만든다 — 다른 NPC 이벤트가 먼저 소진되는 것을 줄인다.
    const npcs = base.npcs.map(n => (n.id === npcId
      ? { ...n, met: true, intimacy: 60 }
      : { ...n, intimacy: 0 }));
    useGameStore.setState({
      state: { ...base, year: 2, week: 5, phase: 'weekday', currentEvent: null, npcs },
    });

    // 미니이벤트는 1회 발동으로 소진되므로, 돈 쓰는 것이 나올 때까지 같은 NPC에게 계속 말을 건다.
    let delta = 0;
    for (let i = 0; i < 30 && delta === 0; i++) {
      useGameStore.setState({
        state: {
          ...useGameStore.getState().state!,
          money: 100, npcEventPendingThisWeek: true, talkEventPressure: 1,
        },
      });
      useGameStore.getState().talkToNpc(npcId);
      delta = useGameStore.getState().state!.moneySpentByYear![1];
    }
    expect(delta, 'NPC 미니이벤트 지출이 한 번도 적립되지 않았다').toBeGreaterThan(0);
  });
});

// ============================================================
// ② 막힌 주 적립 — 판정 주체는 UI, 적립·중복방지는 store
// ============================================================
describe('막힌 주 적립 — store.markMoneyBlockedWeek', () => {
  const boot = (patch: Partial<GameState> = {}) => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    useGameStore.setState({
      state: { ...useGameStore.getState().state!, phase: 'weekday', currentEvent: null, ...patch },
    });
  };

  it('그 해 슬롯에 1주가 쌓인다', () => {
    boot({ year: 3, week: 7 });
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear![2]).toBe(0);
    useGameStore.getState().markMoneyBlockedWeek();
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear![2]).toBe(1);
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear!.slice(0, 2)).toEqual([0, 0]);
  });

  // UI가 매 렌더 알려오므로 이 접힘이 없으면 한 주가 수십 번 쌓인다.
  it('같은 주에 여러 번 호출해도 1주다', () => {
    boot({ year: 1, week: 4 });
    for (let i = 0; i < 12; i++) useGameStore.getState().markMoneyBlockedWeek();
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear![0]).toBe(1);
  });

  it('다른 주는 따로 쌓인다 (스탬프가 주차별이다)', () => {
    boot({ year: 1, week: 4 });
    useGameStore.getState().markMoneyBlockedWeek();
    useGameStore.setState({ state: { ...useGameStore.getState().state!, week: 5 } });
    useGameStore.getState().markMoneyBlockedWeek();
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear![0]).toBe(2);
  });

  it('학년이 넘어가면 새 슬롯에 쌓인다', () => {
    boot({ year: 1, week: 48 });
    useGameStore.getState().markMoneyBlockedWeek();
    useGameStore.setState({ state: { ...useGameStore.getState().state!, year: 2, week: 1 } });
    useGameStore.getState().markMoneyBlockedWeek();
    const arr = useGameStore.getState().state!.moneyBlockedWeeksByYear!;
    expect(arr[0]).toBe(1);
    expect(arr[1]).toBe(1);
  });
});

// ============================================================
// ③ 문턱 — 학년·7년 각각 양방향
// ============================================================
describe('문턱 — 넘으면 바뀌고 한 칸 아래면 안 바뀐다', () => {
  const y = (spent: number, blockedWeeks: number): MoneyTrajectory =>
    ({ spent, blockedWeeks, strappedYears: blockedWeeks >= 12 ? 1 : 0, years: 1 });
  const life = (spent: number, blockedWeeks: number, strappedYears: number): MoneyTrajectory =>
    ({ spent, blockedWeeks, strappedYears, years: 7 });

  it('한 해 12주 막히면 strapped, 11주면 tight', () => {
    expect(moneyPatternForYear(y(200, 12))).toBe('strapped');
    expect(moneyPatternForYear(y(200, 11))).toBe('tight');
  });

  it('한 해 3주 막히면 tight, 2주면 지출로 갈린다', () => {
    expect(moneyPatternForYear(y(0, 3))).toBe('tight');
    expect(moneyPatternForYear(y(0, 2))).toBe('hoarded');
    expect(moneyPatternForYear(y(200, 2))).toBe('balanced');
  });

  it('막힌 적 없을 때 연 지출 40만이면 balanced, 39.9만이면 hoarded', () => {
    expect(moneyPatternForYear(y(40, 0))).toBe('balanced');
    expect(moneyPatternForYear(y(39.9, 0))).toBe('hoarded');
  });

  it('7년 판정은 나쁜 해가 3해면 strapped, 2해면 tight', () => {
    expect(moneyPatternLifetime(life(1400, 100, 3))).toBe('strapped');
    expect(moneyPatternLifetime(life(1400, 100, 2))).toBe('tight');
  });

  // 평균만 쓰면 후반 궤적이 지워진다 — T21이 스냅샷에서 궤적으로 옮긴 것과 같은 함정.
  it('평균이 낮아도 나쁜 해가 3해면 strapped다 (wash-out 방지)', () => {
    // 12주 × 3해 = 36주 → 연평균 5.1주로 tight 문턱조차 못 넘지만, 그 3해는 통째로 나빴다.
    expect(36 / 7).toBeLessThan(12);
    expect(moneyPatternLifetime(life(1400, 36, 3))).toBe('strapped');
  });

  it('나쁜 해가 하나뿐이면 7년은 tight에 머문다', () => {
    expect(moneyPatternLifetime(life(2200, 30, 1))).toBe('tight');
  });

  it('7년 내내 막힌 적 없으면 지출로 갈린다', () => {
    expect(moneyPatternLifetime(life(280, 0, 0))).toBe('balanced');    // 연 40만
    expect(moneyPatternLifetime(life(279.9, 0, 0))).toBe('hoarded');
  });

  // 실측(4페르소나 × 4시드 × 7년, 연평균 막힌 주)이 각자 다른 칸에 떨어지는지.
  it('실측 페르소나가 네 칸에 흩어진다', () => {
    expect(moneyPatternForYear(y(15, 0))).toBe('hoarded');      // 무료 루틴: 연 15만, 0주
    expect(moneyPatternForYear(y(221, 0))).toBe('balanced');    // 유료 루틴: 연 221만, 0주
    expect(moneyPatternForYear(y(233, 35))).toBe('strapped');   // 지출형: 연 34.8주
    expect(moneyPatternForYear(y(323, 5))).toBe('tight');       // 지출형+부유: 연 4.6주
  });

  it('네 패턴이 서로 다른 문장을 낸다 — 라벨이 접히면 회고가 무의미해진다', () => {
    const years = [y(200, 20), y(200, 5), y(0, 0), y(200, 0)].map(t => moneyYearLine(t).title);
    expect(new Set(years).size).toBe(4);
    const lifes = [life(1400, 245, 7), life(1400, 30, 1), life(0, 0, 0), life(1400, 0, 0)]
      .map(t => moneyLifeLine(t, 0).title);
    expect(new Set(lifes).size).toBe(4);
  });

  it('쓰지 않은 7년만 잔액을 이름으로 부른다', () => {
    expect(moneyLifeLine(life(0, 0, 0), 1569).desc).toContain('1,569만원');
    expect(moneyLifeLine(life(1400, 245, 7), 0).desc).not.toContain('만원');
  });
});

// ============================================================
// ④ 구세이브·손상 세이브 — 기록기가 배열을 만들지 않는다
// ============================================================
describe('구세이브 폴백 — 없으면 침묵, 있으면 말한다', () => {
  const legacy = (): GameState => {
    const s = makeState({ year: 5, money: 100 });
    delete (s as Partial<GameState>).moneySpentByYear;
    delete (s as Partial<GameState>).moneyBlockedWeeksByYear;
    return s;
  };

  it('배열이 없으면 궤적은 null이다 (화면이 줄을 생략하는 근거)', () => {
    expect(moneyTrajectoryForYear({}, 3)).toBeNull();
    expect(moneyTrajectoryLifetime({})).toBeNull();
    expect(moneyTrajectoryForYear({ moneySpentByYear: emptyMoneyYears() }, 3)).toBeNull();
    expect(moneyTrajectoryForYear({ moneyBlockedWeeksByYear: emptyMoneyYears() }, 3)).toBeNull();
  });

  // 여기가 핵심이다. 기록기가 배열을 만들면 구세이브가 첫 지출에서 0으로 채운 7년을 얻고,
  // 마이그레이션 이전 학년이 "아는 0"으로 읽혀 "지갑을 안 연 7년"이라고 거짓말한다.
  it('기록기는 배열을 새로 만들지 않는다 — 지출도, 막힌 주도', () => {
    const s = legacy();
    expect(hasMoneyTracking(s)).toBe(false);
    recordMoneySpent(s, 50);
    recordMoneyBlockedWeek(s);
    expect(s.moneySpentByYear).toBeUndefined();
    expect(s.moneyBlockedWeeksByYear).toBeUndefined();
    expect(moneyTrajectoryLifetime(s)).toBeNull();
  });

  it('구세이브로 한 주를 굴려도 여전히 침묵한다 (배선 경로)', () => {
    // 주간 용돈(5만)이 비용을 덮지 않도록 과외(28만)를 쓴다 — Y5부터 열린다.
    expect(cost('private-tutoring', 5)).toBe(28);
    const s = legacy();
    s.week = 3; s.isVacation = false; s.routineSlot2 = 'private-tutoring'; s.routineSlot3 = null;
    const after = processWeek(s);
    expect(after.money).toBeLessThan(100);            // 돈은 실제로 나갔고
    expect(after.moneySpentByYear).toBeUndefined();   // 기록은 생기지 않았다
    expect(moneyTrajectoryLifetime(after)).toBeNull();
  });

  it('구세이브에서 markMoneyBlockedWeek를 불러도 배열이 생기지 않는다', () => {
    useGameStore.getState().startGame('male', ['emotional', 'info']);
    const s = legacy();
    useGameStore.setState({ state: { ...s, phase: 'weekday', currentEvent: null } });
    useGameStore.getState().markMoneyBlockedWeek();
    expect(useGameStore.getState().state!.moneyBlockedWeeksByYear).toBeUndefined();
  });

  it('길이가 7이 아닌 손상 배열도 침묵한다 (조용한 hoarded 오독 방지)', () => {
    const broken = { moneySpentByYear: [0, 0, 0], moneyBlockedWeeksByYear: [0, 0, 0] };
    expect(hasMoneyTracking(broken)).toBe(false);
    expect(moneyTrajectoryForYear(broken, 2)).toBeNull();
    expect(moneyTrajectoryLifetime(broken)).toBeNull();
  });

  it('배열이 있으면 그 해 값을 그대로 읽는다 (양성 짝)', () => {
    const st = {
      moneySpentByYear: [0, 0, 120, 0, 0, 0, 0],
      moneyBlockedWeeksByYear: [0, 0, 4, 0, 0, 0, 0],
    };
    expect(moneyTrajectoryForYear(st, 3)).toEqual({ spent: 120, blockedWeeks: 4, strappedYears: 0, years: 1 });
    expect(moneyTrajectoryForYear(st, 1)).toEqual({ spent: 0, blockedWeeks: 0, strappedYears: 0, years: 1 });
    expect(moneyTrajectoryLifetime(st)).toEqual({ spent: 120, blockedWeeks: 4, strappedYears: 0, years: 7 });
  });

  it('7년 합이 나쁜 해를 센다', () => {
    const st = {
      moneySpentByYear: emptyMoneyYears(),
      moneyBlockedWeeksByYear: [0, 12, 0, 20, 0, 11, 48],
    };
    expect(moneyTrajectoryLifetime(st)!.strappedYears).toBe(3);   // 12·20·48 (11은 미달)
  });

  it('범위 밖 학년은 null (엔딩 시점 state.year=8 함정)', () => {
    const st = { moneySpentByYear: emptyMoneyYears(), moneyBlockedWeeksByYear: emptyMoneyYears() };
    expect(moneyTrajectoryForYear(st, 8)).toBeNull();
    expect(moneyTrajectoryForYear(st, 0)).toBeNull();
  });

  it('마이그레이션은 0으로 백필하지 않는다', () => {
    const migrated = migrateLoadedState(legacy());
    expect(migrated.moneySpentByYear).toBeUndefined();
    expect(migrated.moneyBlockedWeeksByYear).toBeUndefined();
  });

  it('새 판은 배열을 갖고 시작한다 (양성 짝)', () => {
    const fresh = makeState();
    expect(fresh.moneySpentByYear).toEqual(emptyMoneyYears());
    expect(fresh.moneyBlockedWeeksByYear).toEqual(emptyMoneyYears());
    expect(hasMoneyTracking(fresh)).toBe(true);
    expect(moneyTrajectoryLifetime(fresh)).not.toBeNull();
  });
});
