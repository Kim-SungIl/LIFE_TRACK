// 부모 강점 7년 누적 밸런스 시뮬레이션
//
// 목적:
//   1. wealth 7년 누적 수입 — M4 돈 싱크 적용 후 실효 누적 측정 (1,243만 → ?)
//   2. emotional 효용 — 만성피로 임계 8→10주 + 번아웃 쿨다운 4→8주 적용 후 재측정
//   3. 6축 차별화 매트릭스 (control vs each parent)
//
// 실행: cd game && npx tsx scripts/sim-parent-balance.ts

import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { applyMemorySlotFromChoice } from '../src/engine/memorySystem';
import { getFollowupForWeek } from '../src/engine/events';
import type { GameState, ParentStrength } from '../src/engine/types';

const ALL_PARENTS: ParentStrength[] = ['emotional', 'wealth', 'info', 'strict', 'resilience', 'freedom'];

// 결정론 시드 — 동일 입력이면 동일 출력
const SEEDS = [11111, 22222, 33333];

// 중립 선택 정책: 항상 0번 선택 (편향 없는 베이스라인)
function neutralChoice(state: GameState): number {
  return 0;
}

interface Result {
  parents: [ParentStrength, ParentStrength];
  totalIncome: number;     // 7년 누적 용돈 (소비 전)
  finalMoney: number;      // 종료 시 잔고
  totalSpent: number;      // 누적 지출
  finalStats: { academic: number; social: number; talent: number; mental: number; health: number };
  fatigueAvg: number;
  burnoutCount: number;
  tiredWeeks: number;      // mentalState='tired' 누적 주수
  chronicTiredWeeks: number; // consecutiveTiredWeeks ≥10 진입 횟수
  events: number;
  memorySlots: number;
}

function simulate(parents: [ParentStrength, ParentStrength], seed: number): Result {
  let state = createInitialState('male', parents);
  state.rngSeed = seed;
  state.routineSlot2 = 'self-study';
  state.routineSlot3 = 'club-activity';

  let totalIncome = 0;
  let totalSpent = 0;
  let prevMoney = state.money;
  let fatigueSum = 0;
  let weeks = 0;
  let burnoutCount = 0;
  let tiredWeeks = 0;
  let chronicTiredEntries = 0;
  let prevChronic = false;

  const MAX_WEEKS = 48 * 7; // 7년
  for (let i = 0; i < MAX_WEEKS; i++) {
    if (state.phase === 'ending') break;

    // 이벤트 자동 해결
    if (state.phase === 'event' && state.currentEvent) {
      const ev = state.currentEvent;
      const choices = state.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      const idx = neutralChoice(state) % choices.length;
      const ch = choices[idx];

      // resolveEvent 로직 인라인
      for (const [k, v] of Object.entries(ch.effects)) {
        const stat = k as keyof typeof state.stats;
        state.stats[stat] = Math.max(0, Math.min(100, state.stats[stat] + (v as number)));
      }
      if (ch.fatigueEffect) state.fatigue = Math.max(0, Math.min(100, state.fatigue + ch.fatigueEffect));
      if (ch.moneyEffect) {
        if (ch.moneyEffect < 0) totalSpent += -ch.moneyEffect;
        state.money = Math.round((state.money + ch.moneyEffect) * 10) / 10;
      }
      if (ch.npcEffects) for (const ne of ch.npcEffects) {
        const npc = state.npcs.find(n => n.id === ne.npcId);
        if (npc) { npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange)); npc.met = true; }
      }
      if (ch.timeCost) state.eventTimeCost = ch.timeCost;
      if (ch.trackSelect) state.track = ch.trackSelect;

      applyMemorySlotFromChoice(state, ev, idx, ch);

      state.events.push({ ...ev, resolvedChoice: idx, week: state.week, year: state.year });
      state.currentEvent = null;

      // followup
      const followup = getFollowupForWeek(state, ev.location);
      if (followup) {
        state.currentEvent = followup;
        state.phase = 'event';
        continue;
      }
      state.phase = 'weekday';
    }

    // 주말 활동 자동 (방학이면 vacation)
    if (state.phase === 'weekday') {
      state.weekendChoices = ['rest']; // 주말은 휴식
    } else if (state.phase === 'vacation') {
      state.vacationChoices = ['self-study', 'rest', 'club-activity'];
    }

    state = processWeek(state);
    weeks++;
    fatigueSum += state.fatigue;

    // 용돈 적립 측정
    const moneyDelta = state.money - prevMoney;
    if (moneyDelta > 0) totalIncome += moneyDelta;
    prevMoney = state.money;

    if (state.mentalState === 'burnout') burnoutCount++;
    if (state.mentalState === 'tired') tiredWeeks++;
    const isChronic = (state.consecutiveTiredWeeks || 0) >= 10;
    if (isChronic && !prevChronic) chronicTiredEntries++;
    prevChronic = isChronic;
  }

  return {
    parents,
    totalIncome,
    finalMoney: state.money,
    totalSpent,
    finalStats: { ...state.stats },
    fatigueAvg: Math.round(fatigueSum / weeks * 10) / 10,
    burnoutCount,
    tiredWeeks,
    chronicTiredWeeks: chronicTiredEntries,
    events: state.events.length,
    memorySlots: state.memorySlots.length,
  };
}

function avg(rs: Result[]): Result {
  const n = rs.length;
  return {
    parents: rs[0].parents,
    totalIncome: round(rs.reduce((s, r) => s + r.totalIncome, 0) / n),
    finalMoney: round(rs.reduce((s, r) => s + r.finalMoney, 0) / n),
    totalSpent: round(rs.reduce((s, r) => s + r.totalSpent, 0) / n),
    finalStats: {
      academic: round(rs.reduce((s, r) => s + r.finalStats.academic, 0) / n),
      social: round(rs.reduce((s, r) => s + r.finalStats.social, 0) / n),
      talent: round(rs.reduce((s, r) => s + r.finalStats.talent, 0) / n),
      mental: round(rs.reduce((s, r) => s + r.finalStats.mental, 0) / n),
      health: round(rs.reduce((s, r) => s + r.finalStats.health, 0) / n),
    },
    fatigueAvg: round(rs.reduce((s, r) => s + r.fatigueAvg, 0) / n),
    burnoutCount: round(rs.reduce((s, r) => s + r.burnoutCount, 0) / n),
    tiredWeeks: round(rs.reduce((s, r) => s + r.tiredWeeks, 0) / n),
    chronicTiredWeeks: round(rs.reduce((s, r) => s + r.chronicTiredWeeks, 0) / n),
    events: round(rs.reduce((s, r) => s + r.events, 0) / n),
    memorySlots: round(rs.reduce((s, r) => s + r.memorySlots, 0) / n),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

// ===== 시뮬 1: wealth 7년 누적 (vs control) =====
console.log('\n========== Sim 1: WEALTH 7년 누적 (M4 돈 싱크 적용 후) ==========\n');

const controlPair: [ParentStrength, ParentStrength] = ['resilience', 'freedom']; // wealth 없는 베이스
const wealthPair: [ParentStrength, ParentStrength] = ['wealth', 'resilience'];   // wealth 1축

const controlRuns = SEEDS.map(s => simulate(controlPair, s));
const wealthRuns = SEEDS.map(s => simulate(wealthPair, s));
const c = avg(controlRuns);
const w = avg(wealthRuns);

console.log(`Control [gene+freedom]:  income=${c.totalIncome}만 / 지출=${c.totalSpent}만 / 잔고=${c.finalMoney}만`);
console.log(`Wealth  [wealth+gene]:   income=${w.totalIncome}만 / 지출=${w.totalSpent}만 / 잔고=${w.finalMoney}만`);
console.log(`        Δ income: +${round(w.totalIncome - c.totalIncome)}만 (wealth 효과)`);
console.log(`        Δ spent:  +${round(w.totalSpent - c.totalSpent)}만`);
console.log(`        Δ 잔고:   +${round(w.finalMoney - c.finalMoney)}만`);
console.log(`\n예상 (이론적): wealth = 8 - 2.5 = +5.5/주 × 336주 = +1,848만 (생활비 차이 포함 시 +3.7/주 × 336 = +1,243만)`);
console.log(`실측 income 격차: ${round(w.totalIncome - c.totalIncome)}만`);

// ===== 시뮬 2: emotional 효용 (vs control) =====
console.log('\n\n========== Sim 2: EMOTIONAL 효용 (만성피로/번아웃 완화 후) ==========\n');

const emotionalPair: [ParentStrength, ParentStrength] = ['emotional', 'resilience'];
const noEmoPair: [ParentStrength, ParentStrength] = ['resilience', 'freedom']; // emotional 없는 베이스

const emoRuns = SEEDS.map(s => simulate(emotionalPair, s));
const noEmoRuns = SEEDS.map(s => simulate(noEmoPair, s));
const e = avg(emoRuns);
const ne = avg(noEmoRuns);

console.log(`Control  [gene+freedom]:    fatigue avg=${ne.fatigueAvg} / burnout=${ne.burnoutCount}주 / tired=${ne.tiredWeeks}주 / 만성진입=${ne.chronicTiredWeeks}회 / mental 종료=${ne.finalStats.mental}`);
console.log(`Emotional[emotional+gene]:  fatigue avg=${e.fatigueAvg} / burnout=${e.burnoutCount}주 / tired=${e.tiredWeeks}주 / 만성진입=${e.chronicTiredWeeks}회 / mental 종료=${e.finalStats.mental}`);
console.log(`         Δ fatigue avg:    ${round(e.fatigueAvg - ne.fatigueAvg)}`);
console.log(`         Δ burnout 주수:   ${round(e.burnoutCount - ne.burnoutCount)}`);
console.log(`         Δ tired 주수:     ${round(e.tiredWeeks - ne.tiredWeeks)}`);
console.log(`         Δ 만성 진입:      ${round(e.chronicTiredWeeks - ne.chronicTiredWeeks)}`);
console.log(`         Δ mental 종료:    +${round(e.finalStats.mental - ne.finalStats.mental)}`);

// ===== 시뮬 3: 6축 차별화 매트릭스 =====
console.log('\n\n========== Sim 3: 6축 차별화 매트릭스 (각 부모 + emotional 짝) ==========\n');

console.log('parents              | acad | soc  | tal  | men  | hp   | fatAvg | burn | tired | 만성 | 잔고 | 슬롯');
console.log('-'.repeat(110));

const allPairs: [ParentStrength, ParentStrength][] = [
  ['emotional', 'resilience'],
  ['wealth', 'resilience'],
  ['info', 'resilience'],
  ['strict', 'resilience'],
  ['resilience', 'freedom'],
  ['freedom', 'emotional'],
];

for (const pair of allPairs) {
  const runs = SEEDS.map(s => simulate(pair, s));
  const r = avg(runs);
  const label = `${pair[0]}+${pair[1]}`.padEnd(20);
  console.log(
    `${label} | ${pad(r.finalStats.academic)} | ${pad(r.finalStats.social)} | ${pad(r.finalStats.talent)} | ${pad(r.finalStats.mental)} | ${pad(r.finalStats.health)} | ${pad(r.fatigueAvg, 6)} | ${pad(r.burnoutCount, 4)} | ${pad(r.tiredWeeks, 5)} | ${pad(r.chronicTiredWeeks, 4)} | ${pad(r.finalMoney, 4)} | ${pad(r.memorySlots, 4)}`
  );
}

function pad(n: number, w = 4): string { return String(n).padStart(w); }

console.log('\n시드 3개 평균. 중립 정책(항상 첫 선택지) + 자습/동아리 루틴 + 주말 휴식.');
console.log('========================================================================\n');
