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
import { useGameStore, loadFromStorage } from '../store';
import { createInitialState, processWeek } from '../gameEngine';
import { SHOP_ITEMS, canBuyItem } from '../shopSystem';
import { NPC_MINI_EVENTS } from '../talkData/miniEvents';
import { getAvailableNpcEvents } from '../talkSystem';
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

// 여기까지는 전부 `pendingWeekDelta`를 **직접 주입**해 소비자(fold)만 잠갔다.
// 생산자(store의 accruePendingDelta)는 무검사였다 — 뮤테이션으로 확인했다:
//
//   `if (d !== 0)` → `if (d > 0)`      음수 스탯 델타가 결산에서 사라진다 → SURVIVED
//   accrue의 피로 줄 삭제               말걸기·상점 피로가 결산에서 사라진다 → SURVIVED
//
// 둘 다 실제로 도달하는 경로다 — 미니이벤트에 음수 스탯이 있고, 상점 `snack`은 피로 -3이다.
describe('생산자(accrue)도 잠근다 — 실제 store 경로', () => {
  it('상점 구매의 피로 감소가 결산에 들어간다', () => {
    const snack = SHOP_ITEMS.find(i => i.id === 'snack')!;
    expect(snack.effects.some(e => e.type === 'instant' && e.stat === 'fatigue' && (e.value ?? 0) < 0),
      '전제: snack이 피로를 내린다 — 이 전제가 깨지면 아래 단언은 공허해진다').toBe(true);

    const base = inPlay({ money: 100, fatigue: 40 });
    useGameStore.setState({ state: { ...base } });
    const st0 = useGameStore.getState().state!;
    expect(canBuyItem(snack, st0, st0.weekPurchases || {}).ok, '전제: 살 수 있는 상태').toBe(true);
    useGameStore.getState().buyItem(snack);

    const pending = useGameStore.getState().state!.pendingWeekDelta;
    expect(pending?.fatigue, 'accrue의 피로 줄을 지우면 여기가 0이 된다').toBeLessThan(0);

    // 대조군은 `base`가 아니라 **같은 상태에서 보류분만 뺀 것**이다. 구매로 피로가 이미
    // 내려가 있어서 base와 비교하면 그 주 동역학 차이까지 섞인다(실측 -2.5 vs -3).
    const bought = useGameStore.getState().state!;
    const after = processWeek({ ...bought });
    const ctl = processWeek({ ...bought, pendingWeekDelta: undefined });
    // ±0.1은 `round1`이 접을 때 한 번만 걸리기 때문이다(대조군의 기준값은 반올림 전).
    // UI는 정수로 보여 주므로 안 보이는 드리프트다 — 잡아야 할 회귀는 이 줄이 통째로
    // 죽는 것(차이 0)이므로 precision 0으로도 충분히 걸린다.
    expect(round1(after.weekLog!.fatigueChange - ctl.weekLog!.fatigueChange),
      '피로 감소가 결산에 안 나타나면 생산자가 죽은 것이다').toBeCloseTo(round1(pending!.fatigue), 0);
  });

  it('미니이벤트의 음수 스탯이 결산에서 사라지지 않는다', () => {
    // 음수 스탯은 **선택지 없는 이벤트의 top-level effects**에만 있다(실측).
    // 부모 쪽 `talk_parent_strict`는 선택지가 2개라 top-level effects가 아예 안 쓰이므로
    // 실제로 도달하는 음수 경로는 NPC 미니이벤트다.
    const negative = NPC_MINI_EVENTS.filter(e =>
      e.npcId && !e.choices?.length
      && Object.values(e.effects.stats ?? {}).some(v => typeof v === 'number' && v < 0));
    expect(negative.length,
      '선택지 없는 음수 스탯 NPC 미니이벤트가 0건이면 이 축은 검사할 대상이 없다').toBeGreaterThan(0);

    const ev = negative[0];
    const [negKey] = Object.entries(ev.effects.stats!)
      .find(([, v]) => typeof v === 'number' && v < 0)!;

    // talkToNpc도 available[0]을 집는다 — 앞선 후보를 발동기록에 넣어 이 컷을 고정한다.
    const seeded = inPlay({ npcEventPendingThisWeek: true }) as GameState;
    const target = seeded.npcs.find(n => n.id === ev.npcId);
    expect(target, `전제: ${ev.npcId}가 명부에 있어야 한다`).toBeTruthy();
    target!.intimacy = Math.max(target!.intimacy, ev.intimacyMin ?? 70);
    target!.met = true;
    seeded.talkEventsFired = getAvailableNpcEvents(seeded, ev.npcId!)
      .filter(e => e.id !== ev.id).map(e => e.id);
    expect(getAvailableNpcEvents(seeded, ev.npcId!)[0]?.id,
      `전제: ${ev.id}가 available[0]이어야 talkToNpc가 이걸 집는다`).toBe(ev.id);

    useGameStore.setState({ state: { ...seeded } });
    const before = useGameStore.getState().state!.stats[negKey as StatKey];
    useGameStore.getState().talkToNpc(ev.npcId!);

    const fired = useGameStore.getState().state!;
    expect(fired.stats[negKey as StatKey], `전제: ${negKey}가 실제로 깎여야 한다`).toBeLessThan(before);

    const pending = fired.pendingWeekDelta;
    expect(pending?.stats?.[negKey as StatKey],
      `${negKey} 음수 델타가 보류분에 없다 — \`d !== 0\`을 \`d > 0\`으로 바꾸면 이렇게 된다`)
      .toBeLessThan(0);

    // 대조군은 같은 상태에서 보류분만 뺀 것 — 스탯이 이미 달라져 있어 base와는 못 비교한다.
    const withNeg = processWeek({ ...fired });
    const ctl = processWeek({ ...fired, pendingWeekDelta: undefined });
    expect(round1((withNeg.weekLog!.statChanges[negKey as StatKey] ?? 0)
                - (ctl.weekLog!.statChanges[negKey as StatKey] ?? 0)),
      '음수 델타가 결산에 안 실리면 플레이어는 깎인 만큼을 못 본다')
      .toBe(round1(pending!.stats![negKey as StatKey]!));
  });

  // statChanges는 5축 고정이 아니다 — 지연 생성이라 안 건드린 축은 키 자체가 없다
  // (gameEngine.ts: `if (!log.statChanges[statKey]) log.statChanges[statKey] = 0;`).
  // fold가 "있는 키만 갱신"하도록 바뀌면 그 주에 처음 생기는 축이 통째로 사라진다.
  it('로그에 없던 축도 보류분이 새로 만든다', () => {
    // 휴식 루틴이 있으면 5축이 전부 생긴다 — 슬롯3을 비워야 mental 키가 안 생긴다(실측).
    const base = inPlay({ routineSlot3: null });
    const plain = processWeek({ ...base });
    const missing = (['academic', 'social', 'talent', 'mental', 'health'] as StatKey[])
      .find(k => !(k in plain.weekLog!.statChanges));
    expect(missing, '전제: 이번 주에 안 건드린 축이 있어야 이 검사가 의미를 갖는다').toBeDefined();

    const withPending = processWeek({
      ...base,
      pendingWeekDelta: { stats: { [missing!]: 2 }, fatigue: 0, money: 0 },
    });
    expect(withPending.weekLog!.statChanges[missing!],
      '없던 키를 안 만들면 그 주 효과가 결산에서 통째로 사라진다').toBe(2);
  });

  // 보류분은 자동저장을 타고 디스크를 왕복한다 — 저장에서 벗겨지면 새로고침 한 번에 사라진다.
  it('보류분은 저장·로드를 왕복해도 살아남는다', () => {
    const base = inPlay({ money: 100, fatigue: 40 });
    useGameStore.setState({ state: { ...base } });
    useGameStore.getState().buyItem(SHOP_ITEMS.find(i => i.id === 'snack')!);
    const before = useGameStore.getState().state!.pendingWeekDelta;
    expect(before, '전제: 구매로 보류분이 생겼다').toBeTruthy();

    // **직접 쓰면 안 된다** — 그러면 실제 저장 경로를 안 타서, 저장이 이 필드를 벗겨도
    // 테스트가 통과한다(실측: saveToStorage에서 벗기는 뮤테이션이 SURVIVED였다).
    // buyItem의 set()이 자동저장 구독을 깨우므로 디스크에는 이미 써져 있어야 한다.
    const onDisk = loadFromStorage();
    expect(onDisk?.state?.pendingWeekDelta,
      '자동저장이 보류분을 디스크에 안 남기면 새로고침 한 번에 그 주 지출이 사라진다').toEqual(before);

    useGameStore.setState({ state: null });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state!.pendingWeekDelta,
      '저장이 이 필드를 벗기면 새로고침 한 번에 그 주 지출이 결산에서 사라진다').toEqual(before);
  });
});

// **한 주에 accrue는 여러 번 돈다.** 위 테스트들은 전부 1회 경로(구매 1건·말걸기 1건)만
// 태워서, 누적(`+=`)이 대입(`=`)으로 바뀌어도 전부 초록이었다(3자 검수 실측 — F6·F7·F8).
//
// 실제 증상: money 500·fatigue 50에서 네 번 사면
//   정상   pending = {stats:{mental:2}, fatigue:-8, money:-3.5}
//   `=` 변이 pending = {stats:{mental:2}, fatigue:0,  money:-1.5}
// 결산이 지출 3.5만원 중 1.5만원만 보고한다 — #442·#453이 잡았던 "결산이 거짓말한다"와 같은 계열이다.
describe('한 주에 여러 번 사도 전부 누적된다', () => {
  /** 이번 주에 실제로 살 수 있는 아이템을 가격 낮은 순으로 n개. */
  function buyableItems(s: GameState, n: number) {
    return SHOP_ITEMS
      .filter(i => canBuyItem(i, s, s.weekPurchases || {}).ok)
      .sort((a, b) => a.price - b.price)
      .slice(0, n);
  }

  it('연속 구매의 지출이 전부 보류분에 쌓인다', () => {
    const base = inPlay({ money: 500, fatigue: 50 });
    useGameStore.setState({ state: { ...base } });

    const items = buyableItems(useGameStore.getState().state!, 4);
    expect(items.length, '전제: 이 주에 4개 이상 살 수 있어야 누적을 검사할 수 있다').toBe(4);

    // **기대값을 보류분에서 읽지 않는다.** 시험 대상이 만든 값을 기대값으로 쓰면 생산자가
    // 크기를 틀려도 양변이 같이 움직여 원리상 못 잡는다(실측: accrue에 /2를 넣어도 초록).
    // 독립 기준은 지갑이다 — 실제 잔액 차분.
    const moneyBefore = useGameStore.getState().state!.money;
    const fatigueBefore = useGameStore.getState().state!.fatigue;
    for (const item of items) useGameStore.getState().buyItem(item);
    const after = useGameStore.getState().state!;

    const spent = round1(after.money - moneyBefore);
    const tired = round1(after.fatigue - fatigueBefore);
    expect(spent, '전제: 네 번 사서 돈이 실제로 줄었다').toBeLessThan(0);

    expect(round1(after.pendingWeekDelta!.money),
      `보류분이 지갑 차분과 다르다 — \`+=\`를 \`=\`로 바꾸면 마지막 한 건만 남는다`)
      .toBe(spent);
    expect(round1(after.pendingWeekDelta!.fatigue),
      '피로도 같다 — 마지막 구매의 피로만 남으면 결산이 나머지를 통째로 잃는다')
      .toBe(tired);
  });

  it('구매 사이에 말걸기가 끼어도 둘 다 남는다 (경로가 섞여도 누적)', () => {
    const base = inPlay({ money: 500, fatigue: 50, npcEventPendingThisWeek: true });
    useGameStore.setState({ state: { ...base } });

    const moneyBefore = useGameStore.getState().state!.money;
    const [first] = buyableItems(useGameStore.getState().state!, 1);
    useGameStore.getState().buyItem(first);
    const afterFirst = round1(useGameStore.getState().state!.pendingWeekDelta!.money);

    // 말걸기는 돈을 안 건드리므로, 그 뒤 두 번째 구매가 첫 구매 위에 쌓여야 한다.
    for (const npc of useGameStore.getState().state!.npcs.slice(0, 3)) {
      useGameStore.getState().talkToNpc(npc.id);
    }
    const [second] = buyableItems(useGameStore.getState().state!, 1);
    useGameStore.getState().buyItem(second);

    const st = useGameStore.getState().state!;
    expect(round1(st.pendingWeekDelta!.money),
      '두 번째 구매가 첫 구매를 덮으면 결산이 첫 지출을 잃는다').toBe(round1(st.money - moneyBefore));
    expect(round1(st.pendingWeekDelta!.money), '누적이면 첫 구매보다 더 많이 나가 있어야 한다')
      .toBeLessThan(afterFirst);
  });

  it('누적분이 결산에 그대로 실린다', () => {
    const base = inPlay({ money: 500, fatigue: 50 });
    useGameStore.setState({ state: { ...base } });
    const moneyBefore = useGameStore.getState().state!.money;
    for (const item of buyableItems(useGameStore.getState().state!, 3)) {
      useGameStore.getState().buyItem(item);
    }
    const bought = useGameStore.getState().state!;
    const spent = round1(bought.money - moneyBefore);

    const after = processWeek({ ...bought });
    const ctl = processWeek({ ...bought, pendingWeekDelta: undefined });
    expect(round1(after.weekLog!.moneyChange - ctl.weekLog!.moneyChange),
      '세 번의 지출 합이 결산에 안 실리면 플레이어는 돈이 어디 갔는지 못 본다').toBe(spent);
  });
});
