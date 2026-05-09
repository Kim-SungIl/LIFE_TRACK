// 7년 매트릭스 시뮬 기반 tired/burnout 분포·만성 진입·회복 분석.
// test-7year-balance.ts의 매트릭스 sim과 같은 키 공간(부모36×성별2×스타일5=360)을
// 돌리되, 매 주의 mentalState/consecutiveTiredWeeks를 trace해서
// 학년별 tired 비율·첫 진입 시점·만성/회복 에피소드를 추출.
//
// 코드 변경 없음 — 분석 전용 스크립트.
// 실행: cd game && npx tsx scripts/analyze-tired-distribution.ts

// localStorage 폴리필
{
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    key: () => null,
    length: 0,
  } as Storage;
}

import { createInitialState, processWeek, getWeekInfo } from '../src/engine/gameEngine';
import { SHOP_ITEMS, canBuyItem, applyItemEffects } from '../src/engine/shopSystem';
import {
  getFollowupForWeek,
  FOLLOWUP_EVENT_IDS,
  DIRECT_SEQUEL_IDS,
  type GameEvent,
} from '../src/engine/events';
import { applyMemorySlotFromChoice } from '../src/engine/memorySystem';
import type { GameState, ParentStrength } from '../src/engine/types';

// store.resolveEvent와 동일한 이벤트 해결 (sim 전용 인라인)
function resolveEventLikeStore(state: GameState, choiceIndex: number): GameState {
  const s = state;
  if (!s.currentEvent) return state;

  const resolvedLocation = s.currentEvent.location;
  const isFemale = s.gender === 'female';
  const choiceList = (isFemale && s.currentEvent.femaleChoices)
    ? s.currentEvent.femaleChoices
    : s.currentEvent.choices;
  const choice = choiceList[choiceIndex];
  if (!choice) return state;

  const newState = JSON.parse(JSON.stringify(s)) as GameState;

  for (const [key, val] of Object.entries(choice.effects)) {
    const k = key as keyof typeof newState.stats;
    newState.stats[k] = Math.max(0, Math.min(100, newState.stats[k] + (val as number)));
  }
  if (choice.fatigueEffect) {
    newState.fatigue = Math.max(0, Math.min(100, newState.fatigue + choice.fatigueEffect));
  }
  if (choice.moneyEffect) {
    newState.money = Math.round((newState.money + choice.moneyEffect) * 10) / 10;
    if (newState.money < 0) newState.money = 0;
  }
  if (choice.npcEffects) {
    for (const ne of choice.npcEffects) {
      const npc = newState.npcs.find(n => n.id === ne.npcId);
      if (npc) {
        npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange));
        npc.met = true;
      }
    }
  }
  const allBranchChoices = [
    ...newState.currentEvent!.choices,
    ...(newState.currentEvent!.femaleChoices || []),
  ];
  for (const c of allBranchChoices) {
    if (c.npcEffects) {
      for (const ne of c.npcEffects) {
        const npc = newState.npcs.find(n => n.id === ne.npcId);
        if (npc) npc.met = true;
      }
    }
  }
  if (newState.currentEvent!.speakers) {
    for (const npcId of newState.currentEvent!.speakers) {
      const npc = newState.npcs.find(n => n.id === npcId);
      if (npc) npc.met = true;
    }
  }
  if (choice.timeCost) newState.eventTimeCost = choice.timeCost;
  if (choice.trackSelect) newState.track = choice.trackSelect;
  applyMemorySlotFromChoice(newState, newState.currentEvent!, choiceIndex, choice);
  if (choice.addBuff) {
    if (!newState.activeBuffs) newState.activeBuffs = [];
    newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
    newState.activeBuffs.push({ ...choice.addBuff });
  }

  const recordedEvent: Partial<GameEvent> = { ...newState.currentEvent! };
  delete recordedEvent.condition;
  newState.events.push({
    ...(recordedEvent as GameEvent),
    resolvedChoice: choiceIndex,
    week: newState.week,
    year: newState.year,
    resolvedFemale: isFemale && !!s.currentEvent!.femaleChoices,
  });

  if (newState.weekLog) {
    newState.weekLog.messages.push(`📖 ${choice.message}`);
  }

  newState.currentEvent = null;

  const followupFiredThisWeek = newState.events.some(
    prev => prev.week === newState.week && prev.year === newState.year
      && FOLLOWUP_EVENT_IDS.has(prev.id) && !DIRECT_SEQUEL_IDS.has(prev.id),
  );
  const followup = followupFiredThisWeek ? null : getFollowupForWeek(newState, resolvedLocation);
  if (followup) {
    newState.currentEvent = followup;
    newState.phase = 'event';
  } else {
    newState.phase = 'weekday';
  }

  return newState;
}

type PlaystyleId = 'balanced' | 'social' | 'grind' | 'rest' | 'shop_heavy';
type MentalStateLite = 'normal' | 'tired' | 'burnout';

interface Playstyle {
  id: PlaystyleId;
  routineSlot2: string;
  routineSlot3: string;
  weekend: string[];
  vacation: string[];
  useShop: boolean;
}

const ALL_PARENTS: ParentStrength[] = ['emotional', 'wealth', 'info', 'strict', 'resilience', 'freedom'];
const YEAR_NAMES = ['Y1 초6', 'Y2 중1', 'Y3 중2', 'Y4 중3', 'Y5 고1', 'Y6 고2', 'Y7 고3'];

const PLAYSTYLES: Playstyle[] = [
  { id: 'balanced',   routineSlot2: 'self-study', routineSlot3: 'light-exercise', weekend: ['self-study','club'], vacation: ['self-study','creative','rest'], useShop: false },
  { id: 'social',     routineSlot2: 'club',       routineSlot3: 'volunteer',      weekend: ['hang-out','club'],   vacation: ['club','volunteer','hang-out'],   useShop: false },
  { id: 'grind',      routineSlot2: 'academy',    routineSlot3: 'self-study',     weekend: ['academy','self-study'], vacation: ['academy','internet-lecture','self-study'], useShop: false },
  { id: 'rest',       routineSlot2: 'reading',    routineSlot3: 'light-exercise', weekend: ['rest','park-walk'],  vacation: ['rest','deep-rest','park-walk'],  useShop: false },
  { id: 'shop_heavy', routineSlot2: 'self-study', routineSlot3: 'school-sports',  weekend: ['study-group','light-exercise'], vacation: ['self-study','club','rest'], useShop: true },
];

interface ScenarioKey {
  parents: [ParentStrength, ParentStrength];
  gender: 'male' | 'female';
  playstyle: PlaystyleId;
}

function hashScenario(seed: number, ...parts: (string | number)[]): number {
  let h = seed >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function scenarioLabel(key: ScenarioKey): string {
  const [a, b] = key.parents;
  return `${a.slice(0, 2)}+${b.slice(0, 2)}_${key.gender[0]}_${key.playstyle}`;
}

function pickChoiceIndex(state: GameState, ev: GameEvent, scenarioSeed: number, eventOrdinal: number): number {
  const isFemale = state.gender === 'female';
  const choices = (isFemale && ev.femaleChoices) ? ev.femaleChoices! : ev.choices;
  if (choices.length <= 1) return 0;
  const h = hashScenario(scenarioSeed, ev.id, eventOrdinal, state.week, state.year);
  return h % choices.length;
}

function applyWeeklyShop(state: GameState, maxItems = 6): GameState {
  let s = JSON.parse(JSON.stringify(state)) as GameState;
  if (!s.weekPurchases) s.weekPurchases = {};
  const priority = ['energy-drink', 'vitamin', 'snack', 'sweet-drink'];
  let bought = 0;
  while (bought < maxItems) {
    let progressed = false;
    for (const id of priority) {
      const item = SHOP_ITEMS.find(i => i.id === id);
      if (!item) continue;
      const { ok } = canBuyItem(item, s, s.weekPurchases);
      if (!ok) continue;
      const { newState } = applyItemEffects(item, s);
      s = newState;
      s.weekPurchases = { ...s.weekPurchases, [id]: (s.weekPurchases[id] || 0) + 1 };
      bought++;
      progressed = true;
      break;
    }
    if (!progressed) break;
  }
  return s;
}

function advanceFromYearEnd(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  s.week = 1;
  s.year++;
  const nextInfo = getWeekInfo(s.week);
  s.semester = nextInfo.semester;
  s.isVacation = nextInfo.isVacation;
  s.phase = 'weekday';
  return s;
}

interface WeekRecord {
  year: number;
  week: number;
  mentalState: MentalStateLite;
  consecutiveTiredWeeks: number;
  fatigue: number;
  mental: number;
}

interface ScenarioTrace {
  label: string;
  records: WeekRecord[];
  ok: boolean;
  reachedEnding: boolean;
}

function runOneTrace(key: ScenarioKey): ScenarioTrace {
  const scenarioSeed = hashScenario(0x7eafc7ed, key.parents[0], key.parents[1], key.gender, key.playstyle);
  const ps = PLAYSTYLES.find(p => p.id === key.playstyle)!;
  let state = createInitialState(key.gender, key.parents, { rngSeed: scenarioSeed });
  state.routineSlot2 = ps.routineSlot2;
  state.routineSlot3 = ps.routineSlot3;

  const records: WeekRecord[] = [];
  let eventOrdinal = 0;
  let iters = 0;
  const maxIters = 40000;

  while (state.phase !== 'ending' && iters < maxIters) {
    iters++;

    while (state.phase === 'event' && state.currentEvent) {
      const ev = state.currentEvent;
      const idx = pickChoiceIndex(state, ev, scenarioSeed, eventOrdinal);
      eventOrdinal++;
      state = resolveEventLikeStore(state, idx);
    }

    if (state.phase === 'year-end') {
      state = advanceFromYearEnd(state);
      continue;
    }
    if (state.phase === 'ending') break;

    if (ps.useShop) state = applyWeeklyShop(state);
    state.weekendChoices = [...ps.weekend];
    state.vacationChoices = [...ps.vacation];

    const yearBefore = state.year;
    const weekBefore = state.week;
    if (yearBefore < 1 || yearBefore > 7 || weekBefore < 1 || weekBefore > 48) break;

    state = processWeek(state);

    records.push({
      year: yearBefore,
      week: weekBefore,
      mentalState: state.mentalState,
      consecutiveTiredWeeks: state.consecutiveTiredWeeks ?? 0,
      fatigue: state.fatigue,
      mental: state.stats.mental,
    });
  }

  return {
    label: scenarioLabel(key),
    records,
    ok: iters < maxIters,
    reachedEnding: state.phase === 'ending',
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : 'n/a';
}

interface Episode {
  startYear: number;
  startWeek: number;
  length: number;
  endedByRecovery: boolean; // tired/burnout → normal
}

function extractEpisodes(records: WeekRecord[], target: MentalStateLite): Episode[] {
  const eps: Episode[] = [];
  let cur: Episode | null = null;
  for (const r of records) {
    if (r.mentalState === target) {
      if (!cur) cur = { startYear: r.year, startWeek: r.week, length: 1, endedByRecovery: false };
      else cur.length++;
    } else if (cur) {
      cur.endedByRecovery = r.mentalState === 'normal';
      eps.push(cur);
      cur = null;
    }
  }
  if (cur) eps.push(cur); // 미종료 에피소드 (게임 끝까지 회복 안 함)
  return eps;
}

function main() {
  const keys: ScenarioKey[] = [];
  for (const a of ALL_PARENTS) {
    for (const b of ALL_PARENTS) {
      for (const gender of ['male', 'female'] as const) {
        for (const ps of PLAYSTYLES) {
          keys.push({ parents: [a, b], gender, playstyle: ps.id });
        }
      }
    }
  }

  console.log('=== tired/burnout 분포·만성 진입·회복 분석 ===');
  console.log(`매트릭스: 부모${ALL_PARENTS.length * ALL_PARENTS.length}×성별2×스타일${PLAYSTYLES.length} = ${keys.length} 시나리오\n`);

  const t0 = Date.now();
  const traces: ScenarioTrace[] = [];
  for (const key of keys) {
    traces.push(runOneTrace(key));
  }
  const completed = traces.filter(t => t.ok && t.reachedEnding);
  console.log(`실행 시간: ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  console.log(`완주: ${completed.length}/${traces.length}\n`);

  // (1) 학년별 tired 주 수 분포 (per-scenario per-year)
  console.log('(1) 학년별 tired 주 수 — per-scenario p10/p50/p90/max');
  console.log('    (해당 학년에서 mentalState===tired인 주 카운트)');
  for (let y = 1; y <= 7; y++) {
    const counts: number[] = [];
    for (const t of completed) {
      const c = t.records.filter(r => r.year === y && r.mentalState === 'tired').length;
      counts.push(c);
    }
    counts.sort((a, b) => a - b);
    console.log(`    ${YEAR_NAMES[y - 1]}: p10=${percentile(counts, 10)} p50=${percentile(counts, 50)} p90=${percentile(counts, 90)} max=${counts[counts.length - 1] ?? 'n/a'}`);
  }

  // (2) 학년별 burnout 주 수
  console.log('\n(2) 학년별 burnout 주 수 — per-scenario p50/p90/max');
  for (let y = 1; y <= 7; y++) {
    const counts: number[] = [];
    for (const t of completed) {
      const c = t.records.filter(r => r.year === y && r.mentalState === 'burnout').length;
      counts.push(c);
    }
    counts.sort((a, b) => a - b);
    console.log(`    ${YEAR_NAMES[y - 1]}: p50=${percentile(counts, 50)} p90=${percentile(counts, 90)} max=${counts[counts.length - 1] ?? 'n/a'}`);
  }

  // (3) 첫 tired 진입 시점
  console.log('\n(3) 첫 tired 진입 시점 (전체 시나리오 중)');
  const firstTiredAt: { year: number; week: number; absoluteWeek: number }[] = [];
  for (const t of completed) {
    const r = t.records.find(rr => rr.mentalState === 'tired');
    if (r) firstTiredAt.push({ year: r.year, week: r.week, absoluteWeek: (r.year - 1) * 48 + r.week });
  }
  console.log(`    tired 한 번이라도 진입: ${firstTiredAt.length}/${completed.length}`);
  if (firstTiredAt.length) {
    const abs = firstTiredAt.map(x => x.absoluteWeek).sort((a, b) => a - b);
    console.log(`    첫 진입 absoluteWeek p10=${percentile(abs, 10)} p50=${percentile(abs, 50)} p90=${percentile(abs, 90)}`);
    const yearHist = new Map<number, number>();
    for (const x of firstTiredAt) yearHist.set(x.year, (yearHist.get(x.year) ?? 0) + 1);
    const yearLine: string[] = [];
    for (let y = 1; y <= 7; y++) yearLine.push(`Y${y}=${yearHist.get(y) ?? 0}`);
    console.log(`    학년별 첫 진입 카운트: ${yearLine.join(' ')}`);
  }

  // (4) 첫 burnout 진입 시점
  console.log('\n(4) 첫 burnout 진입 시점');
  const firstBurnoutAt: { year: number; week: number }[] = [];
  for (const t of completed) {
    const r = t.records.find(rr => rr.mentalState === 'burnout');
    if (r) firstBurnoutAt.push({ year: r.year, week: r.week });
  }
  console.log(`    burnout 한 번이라도 진입: ${firstBurnoutAt.length}/${completed.length}`);
  if (firstBurnoutAt.length) {
    const yearHist = new Map<number, number>();
    for (const x of firstBurnoutAt) yearHist.set(x.year, (yearHist.get(x.year) ?? 0) + 1);
    const yearLine: string[] = [];
    for (let y = 1; y <= 7; y++) yearLine.push(`Y${y}=${yearHist.get(y) ?? 0}`);
    console.log(`    학년별 첫 진입 카운트: ${yearLine.join(' ')}`);
  }

  // (5) 만성 진입 (consecutiveTiredWeeks ≥ 8) — burnoutCooldown 임계와 같은 기준
  console.log('\n(5) 만성(연속 tired/burnout 8주+) 진입');
  const chronicAt: { year: number; week: number }[] = [];
  for (const t of completed) {
    const r = t.records.find(rr => rr.consecutiveTiredWeeks >= 8);
    if (r) chronicAt.push({ year: r.year, week: r.week });
  }
  console.log(`    만성 한 번이라도 도달: ${chronicAt.length}/${completed.length}`);
  if (chronicAt.length) {
    const yearHist = new Map<number, number>();
    for (const x of chronicAt) yearHist.set(x.year, (yearHist.get(x.year) ?? 0) + 1);
    const yearLine: string[] = [];
    for (let y = 1; y <= 7; y++) yearLine.push(`Y${y}=${yearHist.get(y) ?? 0}`);
    console.log(`    학년별 첫 도달 카운트: ${yearLine.join(' ')}`);
  }

  // (6) tired 에피소드 길이
  console.log('\n(6) tired 에피소드 길이 (시작~normal 복귀 또는 burnout 전이)');
  const tiredEpisodes: Episode[] = [];
  for (const t of completed) tiredEpisodes.push(...extractEpisodes(t.records, 'tired'));
  if (tiredEpisodes.length) {
    const lens = tiredEpisodes.map(e => e.length).sort((a, b) => a - b);
    const recovered = tiredEpisodes.filter(e => e.endedByRecovery).length;
    console.log(`    에피소드 수: ${tiredEpisodes.length} (시나리오당 평균 ${(tiredEpisodes.length / completed.length).toFixed(2)})`);
    console.log(`    길이 p50=${percentile(lens, 50)} p90=${percentile(lens, 90)} max=${lens[lens.length - 1]}`);
    console.log(`    종료 유형: 회복(→normal) ${recovered} · 비회복(burnout 전이/미종료) ${tiredEpisodes.length - recovered}`);
  } else {
    console.log('    에피소드 없음');
  }

  // (7) burnout 에피소드 길이
  console.log('\n(7) burnout 에피소드 길이');
  const burnoutEpisodes: Episode[] = [];
  for (const t of completed) burnoutEpisodes.push(...extractEpisodes(t.records, 'burnout'));
  if (burnoutEpisodes.length) {
    const lens = burnoutEpisodes.map(e => e.length).sort((a, b) => a - b);
    console.log(`    에피소드 수: ${burnoutEpisodes.length}`);
    console.log(`    길이 p50=${percentile(lens, 50)} p90=${percentile(lens, 90)} max=${lens[lens.length - 1]}`);
  } else {
    console.log('    에피소드 없음');
  }

  // (8) 학년별 tired 비율 (전체 풀링)
  console.log('\n(8) 학년별 tired 비율 — 전 시나리오 풀링 (해당 학년 주 중 tired 주 비율)');
  for (let y = 1; y <= 7; y++) {
    let total = 0;
    let tired = 0;
    let burnout = 0;
    for (const t of completed) {
      for (const r of t.records) {
        if (r.year !== y) continue;
        total++;
        if (r.mentalState === 'tired') tired++;
        else if (r.mentalState === 'burnout') burnout++;
      }
    }
    const tPct = total ? (100 * tired) / total : 0;
    const bPct = total ? (100 * burnout) / total : 0;
    console.log(`    ${YEAR_NAMES[y - 1]}: tired ${fmt(tPct)}% · burnout ${fmt(bPct)}% (n=${total})`);
  }

  console.log('\n명령: npx tsx scripts/analyze-tired-distribution.ts');
}

main();
