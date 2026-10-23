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
import { ACTIVITIES, NPC_COMPANION_ACTIVITIES } from '../../src/engine/activities';
import { getRoutineDueCost } from '../../src/engine/monthlyMoney';
import { canSpend } from '../../src/engine/spendableMoney';
import { cloneGameState } from '../../src/engine/stateClone';
import { createInitialState, predictWeekOutcome } from '../../src/engine/gameEngine';
import { GAME_EVENTS } from '../../src/engine/events';
import {
  assignCurrentEvent, firstPickableChoice, isChoiceUnaffordable, isChoiceVisible,
} from '../../src/engine/eventPresentation';
import { isNpcInteractable } from '../../src/engine/relationshipSignals';
import type { useGameStore } from '../../src/engine/store';
import type { GameState, ParentStrength } from '../../src/engine/types';
import { getConfirmGate, getWeekSlotCount } from '../../src/engine/weekendPlan';
import { SIM_ROUTINES, assertRoutineIds } from './sim-routines';

/** 제품의 영속 키 — store.ts SAVE_KEY / archive.ts ARCHIVE_KEY(verify-nightly-e2e.ts와 같은 값). */
const SAVE_KEY = 'lifetrack_save';
const ARCHIVE_KEY = 'lifetrack_archive';

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

/**
 * **돈을 뺀** 상태 지문. 월 단위 계획 3단계(월초 용돈·루틴 선불)는 돈의 **시점**을 바꿔 전체 지문을
 * 의도적으로 깬다. 그때 "돈만 갈렸다"와 "스탯·사건까지 갈렸다"를 가르는 게 이 지문이다(3자 검수).
 * 돈이 모자라 활동이 빠지는 판(paid-spend)은 돈 시점이 바뀌면 스탯도 정당하게 갈리므로, 이 지문의
 * 불변은 **돈이 모자라지 않는 판**에서만 요구한다.
 */
export const MONEY_STATE_KEYS = [
  'money', 'moneySpentByYear', 'moneyBlockedWeeksByYear', 'moneyBlockedStamp',
  // 월 단위 돈 장치의 기록(monthlyMoney.ts) — 돈이 언제 움직였나의 장부라 돈 쪽이다.
  'monthlyMoney', 'routinePrepaid',
] as const;

export function coreDigest(state: GameState, npcActivityMap: Record<string, string>): string {
  const core: Record<string, unknown> = { ...state };
  for (const k of MONEY_STATE_KEYS) delete core[k];
  // 보류분은 돈 칸을 뺀 나머지만 본다. 돈 말고 아무것도 없으면 "보류분 없음"과 같다 — 달 초 용돈만 들어 있는
  // 보류분과 예전의 빈 보류분(undefined)이 갈리면 돈 시점만 바뀐 판이 스탯까지 갈린 것처럼 보인다.
  if (state.pendingWeekDelta) {
    const { stats, fatigue } = state.pendingWeekDelta;
    if (Object.keys(stats).length > 0 || fatigue !== 0) core.pendingWeekDelta = { stats, fatigue, money: 0 };
    else delete core.pendingWeekDelta;
  }
  if (state.weekLog) {
    const { monthMoney: _monthMoney, ...weekLog } = state.weekLog;
    void _monthMoney; // 달 초 입금 내역 — 돈 쪽 장부라 뺀다
    core.weekLog = { ...weekLog, moneyChange: 0 };
  }
  const json = JSON.stringify(canonical({ state: core, npcActivityMap }));
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
  /** 화면이라면 확정이 돈 때문에 잠겼을 주 — markMoneyBlockedWeek를 부른 횟수. */
  moneyBlockedWeeks: number;
  /** 루틴비를 못 내 무료 루틴으로 바꾼 횟수. */
  routineFallbacks: number;
  /** 0번 선택지가 숨겨졌거나 돈이 모자라 잠겨서 다른 선택지를 고른 횟수. */
  lockedChoicesAvoided: number;
}

export interface DriveChecks {
  /** 계획 시점마다 저장소의 세이브를 읽어 store state와 비교한 횟수. 저장소를 안 넘기면 0. */
  savesCompared: number;
  /** 세이브의 state가 store state와 달랐던 횟수 — 자동 저장이 빠지면 여기서 드러난다(지문 밖). */
  saveMismatches: number;
  /** 엔딩에서 기록실 적립 결과(runDelta)가 store에 남았나 — commitOnEnding 경로(지문 밖). */
  runDeltaAtEnding: boolean;
  /** 엔딩에서 기록실 키가 저장소에 쓰였나. */
  archiveWritten: boolean;
}

export interface DriveResult {
  /** 매 계획 시점(확정 직전)의 지문. 마지막 원소는 엔딩 상태. */
  digests: string[];
  /** 같은 시점의 **돈을 뺀** 지문(coreDigest). */
  coreDigests: string[];
  /** digests[i]의 좌표 — 갈린 지점을 사람이 읽을 수 있게. */
  coords: string[];
  counters: DriveCounters;
  checks: DriveChecks;
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
 * 페르소나의 활동 목록을 **화면이 저장하는 모양**으로 편다 — 여러 칸짜리 활동은 차지하는 칸마다 같은 id를
 * 반복하고(MainWeekScreen의 onToggle), 남은 칸에 안 들어가는 활동은 고를 수 없으므로 뺀다.
 * 예: 방학 5칸에 [단기특강(2), 스포츠캠프(3), 휴식(1)] → [특강, 특강, 캠프, 캠프, 캠프] (휴식은 자리가 없다).
 */
export function layoutSlots(ids: readonly string[], slotCount: number): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const size = ACTIVITIES.find(a => a.id === id)?.slots ?? 1;
    if (out.length + size > slotCount) continue;
    for (let k = 0; k < size; k++) out.push(id);
  }
  return out;
}

/** 지금 이 루틴으로 바꾸면 내야 할 돈 — 제품 판정(monthlyMoney.getRoutineDueCost)을 그 루틴을 끼운 복제본에 묻는다. */
function routineSwitchCost(state: GameState, slot2: string | null, slot3: string | null): number {
  const probe = cloneGameState(state);
  probe.routineSlot2 = slot2;
  probe.routineSlot3 = slot3;
  return getRoutineDueCost(probe);
}

/** 돈이 없어 페르소나 루틴을 못 낼 때 플레이어가 바꿔 끼우는 무료 루틴. */
const FALLBACK_ROUTINE: [string, string | null] = ['self-study', null];

/**
 * 한 판을 끝까지 돈다. **화면이 막는 것은 막는다** — 사건은 보이고 돈이 되는 첫 선택지(EventScene과 같은
 * 판정, 전부 잠기면 "지나친다"), 결산은 곧장 다음 주로, 학년말은 `advanceFromYearEnd`.
 * 확정은 화면의 잠금(getConfirmGate)을 따른다. 잠기면 잠긴 주를 적립하고(markMoneyBlockedWeek),
 * 플레이어가 할 일을 한다 — 루틴비를 못 내면 무료 루틴으로 바꾸고, 못 내는 주말 활동은 비운다.
 * 루틴은 첫 계획 시점에 박고(그 달 학원비를 그때 낸다), 바꿀 돈이 생기면 페르소나 루틴으로 되돌린다(남은 주 몫을 낸다).
 *
 * `opts.storage`(installMemoryStorage의 Map)를 주면 지문 밖 출력도 점검한다 — 계획 시점마다 세이브 바이트의
 * state가 store state와 같은지, 엔딩에서 기록실 적립이 일어났는지.
 */
export function driveGame(
  store: Store, persona: DriverPersona, seed: number, confirm: ConfirmFn,
  opts: { maxPlans?: number; storage?: Map<string, string> } = {},
): DriveResult {
  assertRoutineIds([{
    name: persona.name, label: persona.name, parents: persona.parents,
    slot2: persona.slot2, slot3: persona.slot3, weekend: [...persona.weekend], vacation: [...persona.vacation],
  }]);
  opts.storage?.delete(SAVE_KEY);
  opts.storage?.delete(ARCHIVE_KEY);
  bootStore(store, persona, seed);
  const api = store.getState;
  const now = () => {
    const s = api().state;
    if (!s) throw new Error('week-driver: 스토어에 state가 없다');
    return s;
  };

  const digests: string[] = [];
  const coreDigests: string[] = [];
  const coords: string[] = [];
  const counters: DriveCounters = {
    weeks: 0, vacationWeeks: 0, eventsResolved: 0, yearEnds: 0, talkEvents: 0, companionWeeks: 0, moneySpent: 0,
    moneyBlockedWeeks: 0, routineFallbacks: 0, lockedChoicesAvoided: 0,
  };
  const checks: DriveChecks = { savesCompared: 0, saveMismatches: 0, runDeltaAtEnding: false, archiveWritten: false };
  let routineSet = false;
  let reachedEnding = false;

  for (let step = 0; step < STEP_LIMIT; step++) {
    const s = now();
    if (s.phase === 'ending') {
      digests.push(stateDigest(s, api().npcActivityMap));
      coreDigests.push(coreDigest(s, api().npcActivityMap));
      coords.push(`Y${s.year} W${s.week} ending`);
      checks.runDeltaAtEnding = api().runDelta != null;
      checks.archiveWritten = !!opts.storage?.get(ARCHIVE_KEY);
      reachedEnding = true;
      break;
    }
    if (s.phase === 'year-end') { counters.yearEnds++; api().advanceFromYearEnd(); continue; }
    if (s.phase === 'event') {
      counters.eventsResolved++;
      const e = s.currentEvent!;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      if (choices[0] && (!isChoiceVisible(choices[0], s) || isChoiceUnaffordable(choices[0], s))) counters.lockedChoicesAvoided++;
      api().resolveEvent(firstPickableChoice(s, choices));
      continue;
    }
    if (s.phase === 'result') { api().setPhase('weekday'); continue; }

    if (!routineSet) { api().setRoutine(persona.slot2, persona.slot3); routineSet = true; }
    // 돈이 생겼으면 페르소나 루틴으로 돌아간다(바꾸면 연속 보너스가 리셋되는 건 화면과 같다).
    const pre = now();
    if (!pre.isVacation && (pre.routineSlot2 !== persona.slot2 || pre.routineSlot3 !== persona.slot3)
        && canSpend(pre, routineSwitchCost(pre, persona.slot2, persona.slot3))) {
      api().setRoutine(persona.slot2, persona.slot3);
    }

    // 계획 시점 — 여기서 지문을 뜬다(확정 직전, 말걸기 전).
    const atPlan = now();
    if (opts.maxPlans !== undefined && digests.length >= opts.maxPlans) break;
    digests.push(stateDigest(atPlan, api().npcActivityMap));
    coreDigests.push(coreDigest(atPlan, api().npcActivityMap));
    coords.push(`Y${atPlan.year} W${atPlan.week} ${atPlan.phase}`);
    if (opts.storage) {
      checks.savesCompared++;
      const raw = opts.storage.get(SAVE_KEY);
      const saved = raw ? (JSON.parse(raw) as { state?: unknown }).state : undefined;
      if (JSON.stringify(canonical(saved)) !== JSON.stringify(canonical(JSON.parse(JSON.stringify(atPlan))))) checks.saveMismatches++;
    }

    if (persona.talk) {
      const target = companionFor(atPlan);
      if (target) {
        const r = api().talkToNpc(target);
        if (r.kind !== 'smalltalk') counters.talkEvents++;
      }
      if (now().phase !== atPlan.phase) continue; // 말걸기가 장면을 열었으면 그것부터
    }

    let plan = now();
    let activities = layoutSlots(plan.isVacation ? persona.vacation : persona.weekend, getWeekSlotCount(plan));
    const companions = () => {
      const map: Record<string, string> = {};
      if (!persona.companion) return map;
      const npc = companionFor(plan);
      if (npc) activities.forEach((id, i) => { if (id && NPC_COMPANION_ACTIVITIES.includes(id)) map[`${id}:${i}`] = npc; });
      return map;
    };
    let npcChoices = companions();

    // 화면의 확정 잠금 — 풀릴 때까지 플레이어가 하는 일을 한다. 두 번 안에 안 풀리면 드라이버 버그다.
    let gate = getConfirmGate(plan, predictWeekOutcome(plan, activities, npcChoices));
    if (gate.moneyBlocked) { api().markMoneyBlockedWeek(); counters.moneyBlockedWeeks++; }
    for (let fix = 0; gate.disabled; fix++) {
      if (fix >= 2) throw new Error(`week-driver: Y${plan.year} W${plan.week} 확정 잠금이 안 풀린다 ${JSON.stringify(gate)}`);
      if (gate.routineTooExpensive) {
        api().setRoutine(...FALLBACK_ROUTINE);
        counters.routineFallbacks++;
      } else if (gate.unaffordableIds.length) {
        activities = activities.map(id => (gate.unaffordableIds.includes(id) ? '' : id));
      } else {
        throw new Error(`week-driver: 돈이 아닌 이유로 확정이 잠겼다 ${JSON.stringify(gate)}`);
      }
      plan = now();
      npcChoices = companions();
      gate = getConfirmGate(plan, predictWeekOutcome(plan, activities, npcChoices));
    }

    if (Object.keys(npcChoices).length) counters.companionWeeks++;
    if (plan.isVacation) counters.vacationWeeks++;
    counters.weeks++;
    confirm(api, activities, npcChoices);
  }

  const last = now();
  counters.moneySpent = Math.round((last.moneySpentByYear ?? []).reduce((a, b) => a + b, 0) * 10) / 10;
  return { digests, coreDigests, coords, counters, checks, reachedEnding };
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
  runs: { persona: string; seed: number; digests: string[]; coreDigests: string[]; counters: DriveCounters }[];
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
