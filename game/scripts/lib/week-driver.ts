/**
 * 주 진행 드라이버 — **store 층**에서 한 판을 끝까지 돌리고, 매 계획 시점의 상태 지문을 남긴다.
 *
 * 월 단위 계획(docs/monthly-plan-design-2026-10.md §12-1)의 1단계다. 앞으로 4주 자동 진행기가
 * 생기면 "같은 입력이면 사람이 한 주씩 누른 판과 **매주 경계마다** 같은 상태"여야 한다. 그 비교의
 * 기준(골든)과 비교 장치를 여기 둔다.
 *
 * **왜 processWeek이 아니라 store인가.** 엔진 함수끼리 비교하면 같은 함수라 무의미하다(QA 2차 리뷰).
 * 자동 진행이 깨뜨릴 수 있는 것은 store 쪽 순서다 — 확정 순서(`setWeekendChoices` →
 * `setNpcActivityMap` → `recordWeekendPlan` → `advanceWeek`), `advanceWeek`이 phase='result'에서
 * 조용히 return하는 성질, 결산 → `setPhase('weekday')` 복귀, 말걸기의 `pendingWeekDelta` 접힘.
 * 그래서 이 드라이버는 화면이 하는 일을 store 액션으로 **같은 순서로** 재현한다.
 *
 * **확정 방식은 갈아 끼운다(`ConfirmFn`).** 지금 화면의 순서를 손으로 엮은 `confirmInline`이 기준이고,
 * 새 경로(store `confirmWeek`, 나중의 자동 진행기)는 같은 골든을 내야 한다.
 *
 * **지문은 정렬 키 JSON의 sha256이다.** 리팩터가 객체 키 삽입 순서만 바꿔도 해시가 갈리면
 * 거짓 경보가 되므로 키를 정렬한다. 배열 순서는 의미가 있으니 그대로 둔다.
 *
 * 쓰는 곳: src/engine/__tests__/weeklyDriverGolden.test.ts(비교), scripts/sim/record-weekly-golden.ts(기록).
 * 둘이 **같은 함수**를 써야 비교가 성립한다(endingStateGrid.ts와 같은 이유).
 */
import { createHash } from 'node:crypto';
import { NPC_COMPANION_ACTIVITIES } from '../../src/engine/activities';
import { createInitialState } from '../../src/engine/gameEngine';
import { GAME_EVENTS } from '../../src/engine/events';
import { assignCurrentEvent } from '../../src/engine/eventPresentation';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import type { useGameStore } from '../../src/engine/store';
import type { GameState, ParentStrength } from '../../src/engine/types';
import { SIM_ROUTINES, assertRoutineIds } from './sim-routines';

export type StoreApi = typeof useGameStore.getState;
type Store = typeof useGameStore;

/**
 * 한 주를 확정하는 방식. 화면의 `onConfirmWeek`이 하는 일을 한다.
 * `activities`는 그 주 슬롯 배열(학기면 주말, 방학이면 자유 슬롯), `npcChoices`는 `${활동}:${칸}` → NPC id.
 */
export type ConfirmFn = (api: StoreApi, activities: string[], npcChoices: Record<string, string>) => void;

/** 기준 — GameScreen의 onConfirmWeek(2026-10-20, main 2c3e1b6)을 그대로 옮긴 순서. */
export const confirmInline: ConfirmFn = (api, activities, npcChoices) => {
  const s = api().state;
  if (!s) throw new Error('confirmInline: state 없음');
  if (s.isVacation) api().setVacationChoices(activities);
  else api().setWeekendChoices(activities);
  api().setNpcActivityMap(npcChoices);
  api().recordWeekendPlan(activities, npcChoices);
  api().advanceWeek();
};

export interface DriverPersona {
  readonly name: string;
  readonly gender: 'male' | 'female';
  readonly parents: [ParentStrength, ParentStrength];
  readonly slot2: string;
  readonly slot3: string;
  readonly weekend: readonly string[];
  readonly vacation: readonly string[];
  /** 동행 활동 칸에 친구를 붙인다(`setNpcActivityMap` 경로를 밟는다). */
  readonly companion: boolean;
  /** 매 계획 시점에 첫 번째로 말 걸 수 있는 친구에게 말을 건다(`pendingWeekDelta` 경로). */
  readonly talk: boolean;
}

function routine(name: string) {
  const r = SIM_ROUTINES.find(x => x.name === name);
  if (!r) throw new Error(`week-driver: SIM_ROUTINES에 '${name}'이 없다`);
  return r;
}

/**
 * 골든 페르소나. 서로 다른 경로를 하나씩은 밟게 고른다:
 *   paid       — 유료 루틴(매주 학원비 차감), 동행·말걸기 없음
 *   free-talk  — 무료 루틴 + 동행(club) + 매주 말걸기, 여주
 *   paid-spend — 유료 루틴 + 유료 주말(hang-out 동행) + 유료 방학 — 돈이 모자라 스킵되는 주가 생긴다
 */
export const GOLDEN_PERSONAS: readonly DriverPersona[] = [
  { name: 'paid', gender: 'male', companion: false, talk: false, ...pick(routine('paid')) },
  { name: 'free-talk', gender: 'female', companion: true, talk: true, ...pick(routine('free')) },
  { name: 'paid-spend', gender: 'male', companion: true, talk: false, ...pick(routine('paid-spend')) },
];

function pick(r: ReturnType<typeof routine>) {
  return { parents: r.parents, slot2: r.slot2, slot3: r.slot3, weekend: r.weekend, vacation: r.vacation };
}

export const GOLDEN_SEEDS: readonly number[] = [20261020, 7_000_003];

/** 한 판의 상한. 336주 + 사건·결산·학년말 걸음 — 실측 한 판 약 1000걸음(verify-nightly-e2e). */
const STEP_LIMIT = 6_000;

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = canonical((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** 상태 지문. store의 `npcActivityMap`은 GameState 밖에 있으므로 같이 넣는다. */
export function stateDigest(state: GameState, npcActivityMap: Record<string, string>): string {
  const json = JSON.stringify(canonical({ state, npcActivityMap }));
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

export interface DriveCounters {
  /** 확정한 주 수(계획 시점 수). */
  weeks: number;
  vacationWeeks: number;
  eventsResolved: number;
  yearEnds: number;
  /** 말걸기에서 잡담이 아니라 미니 이벤트가 발동한 횟수. */
  talkEvents: number;
  /** 동행을 붙인 주 수. */
  companionWeeks: number;
  /** 7년 실지출 합(만원) — `moneySpentByYear`. */
  moneySpent: number;
}

export interface DriveResult {
  /** 매 계획 시점(확정 직전)의 지문. 마지막 원소는 엔딩 상태. */
  digests: string[];
  /** digests[i]의 좌표 — 갈린 지점을 사람이 읽을 수 있게. */
  coords: string[];
  counters: DriveCounters;
  reachedEnding: boolean;
}

/** 시드를 고정해 부팅한다 — startGame과 같은 흐름(부팅 장면 first-week 포함), runId만 뺀다. */
export function bootStore(store: Store, persona: DriverPersona, seed: number): void {
  const initial = createInitialState(persona.gender, persona.parents, { rngSeed: seed });
  const firstScene = GAME_EVENTS.find(e => e.id === 'first-week');
  if (!firstScene) throw new Error('week-driver: 부팅 장면(first-week)이 GAME_EVENTS에 없다');
  assignCurrentEvent(initial, firstScene, firstScene.week ?? 1);
  store.setState({ state: initial, runDelta: null, npcActivityMap: {} });
}

function companionFor(state: GameState): string | null {
  const npc = state.npcs
    .filter(n => n.met && isNpcInteractable(n, state))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  return npc ? npc.id : null;
}

/**
 * 한 판을 끝까지 돈다. 사건은 늘 0번 선택지, 결산은 곧장 다음 주로(화면의 "다음 주로 →"),
 * 학년말은 `advanceFromYearEnd`. 루틴은 첫 계획 시점에 한 번 박는다(화면의 루틴 다이얼로그).
 */
export function driveGame(
  store: Store, persona: DriverPersona, seed: number, confirm: ConfirmFn,
  opts: { maxPlans?: number } = {},
): DriveResult {
  assertRoutineIds([{
    name: persona.name, label: persona.name, parents: persona.parents,
    slot2: persona.slot2, slot3: persona.slot3, weekend: [...persona.weekend], vacation: [...persona.vacation],
  }]);
  bootStore(store, persona, seed);
  const api = store.getState;
  const now = () => {
    const s = api().state;
    if (!s) throw new Error('week-driver: 스토어에 state가 없다');
    return s;
  };

  const digests: string[] = [];
  const coords: string[] = [];
  const counters: DriveCounters = {
    weeks: 0, vacationWeeks: 0, eventsResolved: 0, yearEnds: 0, talkEvents: 0, companionWeeks: 0, moneySpent: 0,
  };
  let routineSet = false;
  let reachedEnding = false;

  for (let step = 0; step < STEP_LIMIT; step++) {
    const s = now();
    if (s.phase === 'ending') {
      digests.push(stateDigest(s, api().npcActivityMap));
      coords.push(`Y${s.year} W${s.week} ending`);
      reachedEnding = true;
      break;
    }
    if (s.phase === 'year-end') { counters.yearEnds++; api().advanceFromYearEnd(); continue; }
    if (s.phase === 'event') { counters.eventsResolved++; api().resolveEvent(0); continue; }
    if (s.phase === 'result') { api().setPhase('weekday'); continue; }

    if (!routineSet) { api().setRoutine(persona.slot2, persona.slot3); routineSet = true; }

    // 계획 시점 — 여기서 지문을 뜬다(확정 직전, 말걸기 전).
    const atPlan = now();
    if (opts.maxPlans !== undefined && digests.length >= opts.maxPlans) break;
    digests.push(stateDigest(atPlan, api().npcActivityMap));
    coords.push(`Y${atPlan.year} W${atPlan.week} ${atPlan.phase}`);

    if (persona.talk) {
      const target = companionFor(atPlan);
      if (target) {
        const r = api().talkToNpc(target);
        if (r.kind !== 'smalltalk') counters.talkEvents++;
      }
      if (now().phase !== atPlan.phase) continue; // 말걸기가 장면을 열었으면 그것부터
    }

    const plan = now();
    const activities = [...(plan.isVacation ? persona.vacation : persona.weekend)];
    const npcChoices: Record<string, string> = {};
    if (persona.companion) {
      const npc = companionFor(plan);
      if (npc) {
        activities.forEach((id, i) => { if (NPC_COMPANION_ACTIVITIES.includes(id)) npcChoices[`${id}:${i}`] = npc; });
      }
      if (Object.keys(npcChoices).length) counters.companionWeeks++;
    }
    if (plan.isVacation) counters.vacationWeeks++;
    counters.weeks++;
    confirm(api, activities, npcChoices);
  }

  const last = now();
  counters.moneySpent = Math.round((last.moneySpentByYear ?? []).reduce((a, b) => a + b, 0) * 10) / 10;
  return { digests, coords, counters, reachedEnding };
}

/** 첫 번째로 갈린 칸. 같으면 -1. */
export function firstDivergence(a: readonly string[], b: readonly string[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** 골든 파일 모양 — record-weekly-golden.ts가 쓰고 테스트가 읽는다. */
export interface WeeklyGolden {
  sourceCommit: string;
  note: string;
  runs: { persona: string; seed: number; digests: string[]; counters: DriveCounters }[];
}

/** 골든 파일 경로(테스트 기준 상대 위치). */
export const GOLDEN_FILE = 'src/engine/__tests__/weekly-driver-golden.json';

/** 테스트 환경에서 store를 import하기 전에 localStorage를 메모리 shim으로 갈아 끼운다(노드 버전별 모양 차이 회피). */
export function installMemoryStorage(): Map<string, string> {
  const mem = new Map<string, string>();
  const shim: Storage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true, writable: true });
  return mem;
}
