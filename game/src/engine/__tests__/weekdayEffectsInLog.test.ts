// @vitest-environment jsdom
// 주 확정 **전에** 일어난 일도 그 주의 결산에 들어가는가. (#442 후속)
//
// #442는 이벤트 경로만 고쳤다. 그런데 스탯·피로·돈을 바꾸는 경로는 셋이고, 나머지 둘은
// `processWeek` **이전**(weekday 단계)에 돈다:
//
//   - 말걸기/가정 대화 미니이벤트 → applyVisibleTalkEffects
//   - 상점 구매                   → applyItemEffects
//
// 그 시점의 `state.weekLog`는 **지난 주 로그**이고 이번 주 로그는 잠시 뒤 빈 채로 새로 생긴다.
// 그래서 효과가 현재값에는 있는데 변화량에는 없었다. 실측된 증상:
//
//   주시작 1569만원 → 태블릿 15만원 구매 → 주끝 1561만원
//   실제 변화 **-8만원**인데 결산은 **"+7"을 초록으로** 적었다 (주간 용돈만 세고 지출을 못 봄).
//
// 돈은 스탯보다 나쁘다 — `+`/`-`와 초록/빨강으로 방향을 **명시**하기 때문이다.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store';
import { createInitialState, processWeek } from '../gameEngine';
import { SHOP_ITEMS, canBuyItem } from '../shopSystem';
import type { GameState, StatKey } from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

function inPlay(patch: Partial<GameState> = {}): GameState {
  const base = createInitialState('male', ['wealth', 'info'], { rngSeed: 5 });
  return {
    ...base,
    year: 2, week: 10, phase: 'weekday' as GameState['phase'],
    routineSlot2: 'self-study', routineSlot3: 'rest',
    ...patch,
  };
}

/** 주 시작값 + 로그 변화량 = 현재값. 어긋난 축만 돌려준다. */
function disagreements(before: GameState, after: GameState): string[] {
  const bad: string[] = [];
  for (const key of Object.keys(after.stats) as StatKey[]) {
    const expected = round1(before.stats[key] + (after.weekLog?.statChanges[key] ?? 0));
    if (Math.abs(expected - round1(after.stats[key])) > 0.05) {
      bad.push(`${key}: 로그대로면 ${expected}, 실제 ${round1(after.stats[key])}`);
    }
  }
  const money = round1(before.money + (after.weekLog?.moneyChange ?? 0));
  if (Math.abs(money - round1(after.money)) > 0.05) {
    bad.push(`money: 로그대로면 ${money}, 실제 ${round1(after.money)}`);
  }
  return bad;
}

/**
 * 그 상태에서 **실제로 살 수 있는** 아이템을 고른다.
 *
 * `buyItem`은 게이트에 막혀도 사유 문자열을 1건 돌려주므로 반환값 길이로는 성공을 못 가른다
 * (이 함정에 한 번 걸렸다: 막힌 구매를 성공으로 읽어 "돈이 안 줄었다"가 결함처럼 보였다).
 */
function buyableItem(s: GameState, minPrice: number) {
  return SHOP_ITEMS.find(i => i.price >= minPrice && canBuyItem(i, s, s.weekPurchases || {}).ok);
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('상점 구매 — 결산이 지출을 본다', () => {
  it('구매한 주의 돈 변화가 부호까지 맞는다', () => {
    const s = inPlay({ year: 5, money: 1569 });   // 태블릿(15만원)이 열리는 학년 — 주간 순수입보다 확실히 비싸다
    useGameStore.setState({ state: s });

    const item = buyableItem(s, 10);
    expect(item, '10만원 이상 살 수 있는 아이템이 없으면 이 테스트는 아무것도 못 본다').toBeTruthy();
    useGameStore.getState().buyItem(item!);
    expect(useGameStore.getState().state!.money, '전제: 구매가 실제로 돈을 깎는다')
      .toBe(round1(1569 - item!.price));

    useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().state!;
    expect(disagreements(s, after), '지출이 빠지면 화면이 "+"를 초록으로 그린다').toEqual([]);
  });

  it('지출이 주간 용돈보다 크면 결산도 음수다 (부호 역전이 본체였다)', () => {
    const s = inPlay({ year: 5, money: 1569 });   // 태블릿(15만원)이 열리는 학년 — 주간 순수입보다 확실히 비싸다
    useGameStore.setState({ state: s });
    // 주간 순수입(용돈 - 생활비)보다 확실히 비싼 것을 산다.
    const item = buyableItem(s, 15);
    expect(item, '15만원 이상 살 수 있는 아이템이 없으면 부호 역전을 재현할 수 없다').toBeTruthy();
    useGameStore.getState().buyItem(item!);
    expect(useGameStore.getState().state!.money, '전제: 구매가 실제로 돈을 깎는다')
      .toBe(round1(1569 - item!.price));
    useGameStore.getState().advanceWeek();

    const after = useGameStore.getState().state!;
    expect(after.money, '전제: 그 주에 돈이 실제로 줄었다').toBeLessThan(1569);
    expect(after.weekLog!.moneyChange,
      '실제로 줄었는데 로그가 양수면 결산이 초록 "+"로 거짓말한다').toBeLessThan(0);
  });

  // 음성 짝 — 아무것도 안 산 주는 예전처럼 순수입만 나와야 한다.
  // 없으면 "항상 음수"나 "돈을 두 번 뺀다"도 통과한다.
  it('구매가 없으면 주간 순수입 그대로다 (음성 짝)', () => {
    const s = inPlay({ year: 5, money: 1569 });   // 태블릿(15만원)이 열리는 학년 — 주간 순수입보다 확실히 비싸다
    useGameStore.setState({ state: s });
    useGameStore.getState().advanceWeek();

    const after = useGameStore.getState().state!;
    expect(after.weekLog!.moneyChange, '안 샀는데 음수면 지출을 지어낸 것이다').toBeGreaterThan(0);
    expect(disagreements(s, after)).toEqual([]);
  });
});

describe('미니이벤트 — 결산이 말걸기를 본다', () => {
  it('말걸기로 받은 스탯·피로가 그 주의 변화량에 들어간다', () => {
    const s = inPlay({
      npcEventPendingThisWeek: true,
      talkEventsFired: [],
      npcs: createInitialState('male', ['wealth', 'info'], { rngSeed: 5 })
        .npcs.map(n => (n.id === 'jihun' ? { ...n, intimacy: 60, met: true } : n)),
    });
    useGameStore.setState({ state: s });

    const r = useGameStore.getState().talkToNpc('jihun');
    // 하네스가 게이트에 못 닿은 것을 "결함 없음"으로 읽지 않는다.
    expect(r.kind, '미니이벤트가 안 떴다 — 게이트(친밀도·pending·풀)를 다시 볼 것').toBe('event');

    const afterTalk = useGameStore.getState().state!;
    expect(afterTalk.stats.health, '전제: 말걸기가 실제로 스탯을 바꿨다')
      .not.toBe(s.stats.health);

    useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().state!;
    expect(disagreements(s, after), '말걸기 효과가 빠지면 감소하는 축의 부호가 뒤집힌다').toEqual([]);
  });

  // **선택지형 부모 이벤트는 talkToHome이 효과를 적용하지 않는다** — 이벤트만 띄우고
  // 정산은 resolveParentTalkChoice가 한다(선택-후-적용). 거기까지 안 가면 상태가 안 변해서
  // 누적을 통째로 지워도 통과하는 공허한 테스트가 된다(이 함정에 실제로 한 번 걸렸다).
  it('가정 대화도 같다 (선택까지 정산해야 효과가 난다)', () => {
    const s = inPlay({ parentEventPendingThisWeek: true, parentEventsFired: [] });
    useGameStore.setState({ state: s });

    const r = useGameStore.getState().talkToHome();
    expect(r.kind, '부모 미니이벤트가 안 떴다 — 하네스 문제이지 제품 통과가 아니다').toBe('event');
    const ev = (r as { kind: 'event'; event: { id: string; choices?: unknown[] } }).event;
    if (ev.choices && ev.choices.length > 0) {
      useGameStore.getState().resolveParentTalkChoice(ev.id, 0);
    }
    expect(useGameStore.getState().state!.money,
      '전제: 가정 대화가 실제로 가시 효과를 냈다 — 아니면 이 테스트는 아무것도 안 잠근다')
      .not.toBe(s.money);

    useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().state!;
    expect(disagreements(s, after)).toEqual([]);
  });
});

describe('보류분은 로그에만 얹고 엔진을 안 건드린다', () => {
  // **밸런스 불변이 계약이다.** 주당 축 상한(+2)·동일축 중복 감쇠는 `log.statChanges`를 읽어
  // 활동 몫을 깎는다. 보류분을 캡 계산 앞에서 접으면 말을 한 번 건 주에 활동 효율이 조용히
  // 떨어진다 — 결산을 고치려다 게임을 바꾸는 것이다.
  it('보류분이 주당 축 상한을 먹지 않는다', () => {
    const base = inPlay();
    const plain = processWeek({ ...base });
    const withPending = processWeek({
      ...base,
      pendingWeekDelta: { stats: { health: 1 }, fatigue: 0, money: 0 },
    });

    expect(round1((withPending.weekLog!.statChanges.health ?? 0) - (plain.weekLog!.statChanges.health ?? 0)),
      '차이가 정확히 보류분이 아니면 캡 계산이 보류분을 봤다는 뜻이다').toBe(1);
    expect(withPending.stats.health,
      '보류분은 표시용이다 — 스탯을 또 올리면 이중 적용이다').toBe(plain.stats.health);
  });

  it('접은 뒤에는 비운다 (다음 주가 같은 값을 또 세지 않는다)', () => {
    const base = inPlay();
    const w1 = processWeek({ ...base, pendingWeekDelta: { stats: { health: 1 }, fatigue: 2, money: -5 } });
    expect(w1.pendingWeekDelta, '안 비우면 매주 같은 값이 더해진다').toBeUndefined();

    const plain = processWeek({ ...base });
    const w2 = processWeek({ ...w1, phase: 'weekday' as GameState['phase'] });
    const w2plain = processWeek({ ...plain, phase: 'weekday' as GameState['phase'] });
    expect(round1((w2.weekLog!.statChanges.health ?? 0) - (w2plain.weekLog!.statChanges.health ?? 0)),
      '두 번째 주에도 차이가 남으면 보류분이 안 비워진 것이다').toBe(0);
  });

  // 구세이브에는 이 필드가 없다(undefined). 0으로 읽히든 없든 결과가 같아야 한다.
  it('보류분이 없는 상태(구세이브)도 그대로 돈다', () => {
    const base = inPlay();
    expect('pendingWeekDelta' in base && base.pendingWeekDelta !== undefined,
      '전제: 새 판에는 보류분이 없다').toBe(false);
    const after = processWeek({ ...base });
    expect(after.weekLog, '보류분이 없다고 로그가 안 생기면 안 된다').toBeTruthy();
    expect(disagreements(base, after)).toEqual([]);
  });

  // 피로·돈 축도 접는지 — 스탯만 잠그면 두 줄을 지워도 통과한다(실측: 13/13 그린).
  it('피로와 돈도 접는다', () => {
    const base = inPlay({ money: 100, fatigue: 30 });
    const plain = processWeek({ ...base });
    const withPending = processWeek({
      ...base,
      pendingWeekDelta: { stats: {}, fatigue: 3, money: -12 },
    });
    expect(round1(withPending.weekLog!.fatigueChange - plain.weekLog!.fatigueChange),
      '피로 접기를 지워도 통과하면 그 줄은 잠겨 있지 않다').toBe(3);
    expect(round1(withPending.weekLog!.moneyChange - plain.weekLog!.moneyChange),
      '돈 접기를 지워도 통과하면 그 줄은 잠겨 있지 않다').toBe(-12);
  });
});
