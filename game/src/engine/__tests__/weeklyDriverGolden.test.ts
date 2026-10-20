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
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GOLDEN_PERSONAS, GOLDEN_SEEDS, confirmInline, driveGame, firstDivergence, installMemoryStorage, stateDigest,
  type ConfirmFn, type WeeklyGolden,
} from '../../../scripts/lib/week-driver';
import { createInitialState } from '../gameEngine';
import type { useGameStore as UseGameStore } from '../store';

const golden = JSON.parse(readFileSync(new URL('./weekly-driver-golden.json', import.meta.url), 'utf8')) as WeeklyGolden;

let store: typeof UseGameStore;
beforeAll(async () => {
  // store는 import 시점에 localStorage를 만진다 — 노드 버전마다 모양이 달라(#500) 메모리 shim을 먼저 깐다.
  installMemoryStorage();
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
});

describe('store.confirmWeek — 화면의 확정 순서와 매주 바이트 동일', () => {
  for (const r of golden.runs) {
    it(`${r.persona}/seed${r.seed}`, { timeout: 30_000 }, () => {
      const got = driveGame(store, persona(r.persona), r.seed, confirmViaStore);
      expect(got.reachedEnding).toBe(true);
      expectSameAsGolden(got.digests, r.digests, got.coords);
      expect(got.counters).toEqual(r.counters);
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
