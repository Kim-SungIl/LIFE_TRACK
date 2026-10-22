// 주 진행 골든 — store 층에서 한 판(336주)을 돌린 매 계획 시점의 상태 지문이 기준과 같은가.
//
// 월 단위 계획(docs/monthly-plan-design-2026-10.md §12-1)의 1단계 장치다. 4주 자동 진행기는
// "사람이 한 주씩 확정한 판"과 매주 경계에서 같은 상태를 내야 하고, 그 비교 기준이 이 골든이다.
// 지금은 화면의 확정 순서를 store.confirmWeek 하나로 옮긴 리팩터를 잠근다(확정 경로 단일화).
//
// 기준 생성: main 0f7a58b(설계안 커밋, 엔진·store는 main 2c3e1b6과 동일)에서
// `npx tsx scripts/sim/record-weekly-golden.ts` — 확정 순서 = confirmInline(GameScreen onConfirmWeek 현행).
// 재생성은 동작을 **의도적으로** 바꾼 변경에서만 하고, 여기에 원인 귀속을 적는다
// (romanceInvariance.test.ts와 같은 규약: "무엇을 되돌리면 바이트 동일로 돌아오는가").
//
// 재생성 1 (2026-10-22, 달력 문장 4건 — calendarWordsFit.test.ts): 수빈 생일 W29·모의고사 예고 W32·
// 겨울방학 W43·학년의 끝 W47의 제목·설명·선택지 문장과 W47 배경 이름만 바꿨다. 6판 모두 Y1 W30 계획 시점
// (W29 사건이 기록에 남은 직후)부터 지문이 갈린다. 원인 귀속: 그 문장 변경만 되돌린 직전 커밋 1bc1858과
// 6판 전부 **최종 능력치·돈·피로·멘탈·NPC 친밀도·사건 열(학년-주-id-선택)이 바이트 동일**했고 카운터도 같다.
// 수치·발동 시점 변화 0 — 문장만 바뀐 의도된 변경.
//
// 재생성 2 (2026-10-22, 3자 검수 후속 — 드라이버가 화면의 잠금을 따른다): paid·free-talk 4판은 지문·카운터가
// 직전 골든과 **바이트 동일**하다. paid-spend 2판만 W2부터 갈린다 — 예전 드라이버는 화면이라면 238주를
// 확정 못 했을 계획을 그대로 밀어 넣었고(돈 잠김 무시), 2·3칸 방학 활동을 1칸씩 넘겼고(5칸 상한 초과 77주),
// 돈이 모자라 잠긴 0번 선택지를 3번 실행했다. 이제 getConfirmGate로 잠김을 만나면 적립(markMoneyBlockedWeek)하고
// 루틴 강등·못 내는 주말 비우기를 하며, 선택지는 firstPickableChoice(EventScene과 같은 판정)로 고른다.
// 카운터에 moneyBlockedWeeks·routineFallbacks·lockedChoicesAvoided가 더해졌다(기존 4판은 셋 다 0).
//
// 재생성 3 (2026-10-23, 월 단위 계획 3단계 준비 — 형식만): 돈을 뺀 지문 `coreDigests`를 더했다. 같은 커밋에서
// "새로 쓰는 돈" 판정 7곳을 spendableMoney로 옮겼는데, 6판 모두 `digests`·카운터가 직전 골든과 **바이트 동일**하다
// (지금 getSpendableMoney = 잔액이라 동작 불변). 3단계가 돈 시점을 바꾸면 `digests`는 깨지고 `coreDigests`가
// "돈만 갈렸나"를 가른다.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GOLDEN_PERSONAS, GOLDEN_SEEDS, coreDigest, confirmInline, driveGame, firstDivergence, installMemoryStorage, stateDigest,
  type ConfirmFn, type WeeklyGolden,
} from '../../../scripts/lib/week-driver';
import { createInitialState } from '../gameEngine';
import type { useGameStore as UseGameStore } from '../store';

const golden = JSON.parse(readFileSync(new URL('./weekly-driver-golden.json', import.meta.url), 'utf8')) as WeeklyGolden;

let store: typeof UseGameStore;
let storage: Map<string, string>;
beforeAll(async () => {
  // store는 import 시점에 localStorage를 만진다 — 노드 버전마다 모양이 달라(#500) 메모리 shim을 먼저 깐다.
  storage = installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

/** 제품 경로 — 계획 화면의 onConfirmWeek가 부르는 store.confirmWeek. */
const confirmViaStore: ConfirmFn = (api, activities, npcChoices) => api().confirmWeek(activities, npcChoices);

function persona(name: string) {
  const p = GOLDEN_PERSONAS.find(x => x.name === name);
  if (!p) throw new Error(`골든 페르소나 '${name}' 없음`);
  return p;
}

function expectSameAsGolden(actual: readonly string[], expected: readonly string[], coords: readonly string[]) {
  const i = firstDivergence(actual, expected);
  // 실패하면 어디서 갈렸는지 좌표로 말한다 — 336칸 배열 diff는 읽을 수 없다.
  expect(i === -1 ? 'same' : `${i}번째 계획 시점(${coords[i] ?? '끝'})에서 갈림`).toBe('same');
}

describe('골든 자체 — 모수와 커버리지 (비어 있으면 아래 비교가 공허하다)', () => {
  it('페르소나 × 시드 전부가 실려 있고, 각 판이 엔딩까지 336주를 돈다', () => {
    expect(golden.runs.map(r => `${r.persona}/${r.seed}`).sort())
      .toEqual(GOLDEN_PERSONAS.flatMap(p => GOLDEN_SEEDS.map(s => `${p.name}/${s}`)).sort());
    for (const r of golden.runs) {
      expect(r.counters.weeks, `${r.persona}/${r.seed}`).toBe(336);
      expect(r.digests).toHaveLength(337); // 계획 시점 336 + 엔딩 1
      expect(r.counters.yearEnds).toBe(6);
      expect(new Set(r.digests).size).toBe(r.digests.length); // 지문이 매주 실제로 변한다
    }
  });

  it('밟아야 할 경로를 실제로 밟는다 — 사건·방학·동행·말걸기·유료 지출', () => {
    const by = (name: string) => golden.runs.filter(r => r.persona === name);
    for (const r of golden.runs) {
      expect(r.counters.eventsResolved, `${r.persona}/${r.seed} 사건`).toBeGreaterThan(100);
      expect(r.counters.vacationWeeks, `${r.persona}/${r.seed} 방학`).toBeGreaterThan(0);
    }
    for (const r of by('free-talk')) {
      expect(r.counters.talkEvents, '말걸기 미니 이벤트').toBeGreaterThan(0);
      expect(r.counters.companionWeeks, '동행').toBeGreaterThan(0);
    }
    for (const r of by('paid-spend')) expect(r.counters.companionWeeks).toBeGreaterThan(0);
    for (const r of [...by('paid'), ...by('paid-spend')]) expect(r.counters.moneySpent).toBeGreaterThan(1000);
  });

  it('화면이 막는 것을 실제로 만난다 — 돈 잠김·루틴 강등·잠긴 선택지 우회는 paid-spend에서만', () => {
    // paid-spend는 화면이라면 확정이 잠기는 주가 많은 판이다. 드라이버가 그 잠금을 따르는지(적립 + 계획 수정)를
    // 보려면 그 판이 실제로 잠김을 만나야 한다 — 0이면 이 경로는 검사되지 않은 것이다.
    for (const r of golden.runs.filter(x => x.persona === 'paid-spend')) {
      expect(r.counters.moneyBlockedWeeks, `${r.seed} 돈 잠김`).toBeGreaterThan(0);
      expect(r.counters.lockedChoicesAvoided, `${r.seed} 잠긴 선택지`).toBeGreaterThan(0);
    }
    for (const r of golden.runs.filter(x => x.persona !== 'paid-spend')) {
      expect(r.counters.moneyBlockedWeeks, `${r.persona}/${r.seed}`).toBe(0);
    }
  });
});

describe('store.confirmWeek — 화면의 확정 순서와 매주 바이트 동일', () => {
  for (const r of golden.runs) {
    it(`${r.persona}/seed${r.seed}`, { timeout: 30_000 }, () => {
      const got = driveGame(store, persona(r.persona), r.seed, confirmViaStore, { storage });
      expect(got.reachedEnding).toBe(true);
      expectSameAsGolden(got.digests, r.digests, got.coords);
      expectSameAsGolden(got.coreDigests, r.coreDigests, got.coords);
      expect(got.counters).toEqual(r.counters);
      // 지문 밖 출력 — 자동 저장이 매 계획 시점의 state를 그대로 담았고, 엔딩에서 기록실 적립이 일어났다.
      // (지문만 보면 둘 다 지워도 초록이었다 — 3자 검수에서 뮤테이션 2종이 살아남았다.)
      expect(got.checks.savesCompared).toBe(336);
      expect(got.checks.saveMismatches, '세이브의 state가 store와 다르다 — 자동 저장 경로').toBe(0);
      expect(got.checks.runDeltaAtEnding, '엔딩에서 runDelta가 비었다 — commitOnEnding 경로').toBe(true);
      expect(got.checks.archiveWritten, '엔딩에서 기록실 키가 안 쓰였다').toBe(true);
    });
  }

  it('기준 순서(confirmInline)도 여전히 골든을 낸다 — 골든이 엔진과 어긋나지 않았다', { timeout: 30_000 }, () => {
    const r = golden.runs[0];
    const got = driveGame(store, persona(r.persona), r.seed, confirmInline);
    expectSameAsGolden(got.digests, r.digests, got.coords);
  });
});

// ── 양성 대조군 ── 확정 순서를 일부러 망가뜨리면 이 장치가 **실제로 갈림을 본다**.
// 보지 못하면 위의 "바이트 동일"은 장치가 눈을 감은 것과 구별되지 않는다(#437 계열).
// 앞 30주만 돈다 — 첫 여름방학(W20)을 지나야 방학 분기 대조군이 걸린다.
const PREFIX = 30;
const BROKEN: { name: string; persona: string; confirm: ConfirmFn }[] = [
  {
    name: '"지난주처럼" 스냅샷을 빠뜨림', persona: 'paid',
    confirm: (api, a, n) => {
      if (api().state!.isVacation) api().setVacationChoices(a); else api().setWeekendChoices(a);
      api().setNpcActivityMap(n);
      api().advanceWeek();
    },
  },
  {
    name: '동행 지정을 빠뜨림', persona: 'paid-spend',
    confirm: (api, a, n) => {
      if (api().state!.isVacation) api().setVacationChoices(a); else api().setWeekendChoices(a);
      api().recordWeekendPlan(a, n);
      api().advanceWeek();
    },
  },
  {
    name: '스냅샷을 advanceWeek 뒤에 남김(순서 전도)', persona: 'paid',
    confirm: (api, a, n) => {
      if (api().state!.isVacation) api().setVacationChoices(a); else api().setWeekendChoices(a);
      api().setNpcActivityMap(n);
      api().advanceWeek();
      api().recordWeekendPlan(a, n);
    },
  },
  {
    name: '동행 지정을 advanceWeek 뒤에 함(순서 전도)', persona: 'paid-spend',
    confirm: (api, a, n) => {
      if (api().state!.isVacation) api().setVacationChoices(a); else api().setWeekendChoices(a);
      api().recordWeekendPlan(a, n);
      api().advanceWeek();
      api().setNpcActivityMap(n);
    },
  },
  {
    name: '방학에도 주말 칸에 넣음(방학 분기 누락)', persona: 'paid',
    confirm: (api, a, n) => {
      api().setWeekendChoices(a);
      api().setNpcActivityMap(n);
      api().recordWeekendPlan(a, n);
      api().advanceWeek();
    },
  },
];

describe('양성 대조군 — 확정 순서가 깨지면 지문이 갈린다', () => {
  for (const b of BROKEN) {
    it(b.name, { timeout: 30_000 }, () => {
      const ref = golden.runs.find(r => r.persona === b.persona)!;
      // 같은 길이에서 정상 경로는 골든 앞부분과 같아야 한다 — 갈림이 길이 탓이 아니라는 짝.
      const ok = driveGame(store, persona(b.persona), ref.seed, confirmViaStore, { maxPlans: PREFIX });
      expect(ok.digests).toEqual(ref.digests.slice(0, PREFIX));
      const bad = driveGame(store, persona(b.persona), ref.seed, b.confirm, { maxPlans: PREFIX });
      expect(firstDivergence(bad.digests, ref.digests.slice(0, PREFIX))).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('coreDigest — 돈만 바뀌면 그대로, 돈 이외가 바뀌면 다르다', () => {
  it('잔액·연간 지출·잠김 기록·보류 돈·주간 돈 변화는 무시하고, 스탯은 본다', () => {
    const s = createInitialState('male', ['wealth', 'info'], { rngSeed: 1 });
    const base = coreDigest(s, {});
    const moneyOnly = structuredClone(s);
    moneyOnly.money += 12;
    moneyOnly.moneySpentByYear = [3, 0, 0, 0, 0, 0, 0];
    moneyOnly.moneyBlockedWeeksByYear = [1, 0, 0, 0, 0, 0, 0];
    moneyOnly.moneyBlockedStamp = 5;
    moneyOnly.pendingWeekDelta = { stats: {}, fatigue: 0, money: -4 };
    const withPending = structuredClone(s);
    withPending.pendingWeekDelta = { stats: {}, fatigue: 0, money: 0 };
    expect(coreDigest(moneyOnly, {})).toBe(coreDigest(withPending, {}));
    expect(stateDigest(moneyOnly, {}), '전체 지문은 돈을 본다(짝)').not.toBe(stateDigest(withPending, {}));
    const statMoved = structuredClone(s);
    statMoved.stats.academic += 1;
    expect(coreDigest(statMoved, {})).not.toBe(base);
  });
});

describe('stateDigest — 키 순서는 무시하고 값은 본다', () => {
  it('키 삽입 순서만 바뀌면 같고, 깊은 곳의 값 하나가 바뀌면 다르다', () => {
    const s = createInitialState('male', ['wealth', 'info'], { rngSeed: 1 });
    const base = stateDigest(s, {});
    const reordered = Object.fromEntries(Object.entries(s).reverse()) as typeof s;
    expect(stateDigest(reordered, {})).toBe(base);
    const nudged = structuredClone(s);
    nudged.npcs[nudged.npcs.length - 1].intimacy += 0.1;
    expect(stateDigest(nudged, {})).not.toBe(base);
    expect(stateDigest(s, { 'club:0': 'jihun' })).not.toBe(base); // store 밖의 동행 맵도 지문에 든다
  });
});

describe('confirmWeek — 계획 단계 밖에서는 아무것도 안 바꾼다', () => {
  it('결산(phase=result) 중 다시 불러도 주·슬롯·스냅샷·동행 맵이 그대로다', () => {
    driveGame(store, persona('paid-spend'), GOLDEN_SEEDS[0], confirmViaStore, { maxPlans: 2 });
    const api = store.getState;
    // 드라이버는 계획 시점에서 멈췄다 — 한 주 확정해 결산으로 보낸다.
    api().confirmWeek(['hang-out'], {});
    for (let i = 0; i < 20 && api().state!.phase === 'event'; i++) api().resolveEvent(-1); // 사건이 떴으면 지나친다
    expect(api().state!.phase, '전제: 확정 뒤 결산이다').toBe('result');
    const before = { week: api().state!.week, plan: api().state!.lastWeekendPlan, weekend: api().state!.weekendChoices };
    api().confirmWeek(['rest'], { 'rest:0': 'jihun' });
    expect(api().state!.week).toBe(before.week);
    expect(api().state!.lastWeekendPlan).toEqual(before.plan);
    expect(api().state!.weekendChoices).toEqual(before.weekend);
    expect(api().npcActivityMap).toEqual({});
  });
});
