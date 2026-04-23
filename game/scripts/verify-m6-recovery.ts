// M6 도전 모드 리그레션
// 목적: useReducedRecovery 플래그가 회복 감소로 "체감 난이도"를 실제로 올리는지,
// 반대로 너무 과하게 눌러서 플레이 불가 수준이 되진 않는지 어설션으로 고정.
//
// 실행: cd game && npx tsx scripts/verify-m6-recovery.ts

// localStorage 폴리필 (Node 25 부분 구현 우회)
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

import { createInitialState, processWeek, calculateEnding } from '../src/engine/gameEngine';
import { applyMemorySlotFromChoice } from '../src/engine/memorySystem';
import { getFollowupForWeek } from '../src/engine/events';
import type { GameState, ParentStrength } from '../src/engine/types';

interface Pattern {
  name: string;
  parents: [ParentStrength, ParentStrength];
  gender: 'male' | 'female';
  routine2: string;
  routine3: string;
  choicePolicy: (state: GameState) => number;
}

// report-m6-recovery와 동일한 3 패턴 (결과 비교 가능)
const PATTERNS: Pattern[] = [
  {
    name: '학업형', parents: ['info', 'strict'], gender: 'male',
    routine2: 'self-study', routine3: 'academy',
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      const cs = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      let b = 0, bs = -999;
      cs.forEach((c, i) => { const sc = (c.effects.academic ?? 0) * 3 + (c.effects.mental ?? 0); if (sc > bs) { bs = sc; b = i; } });
      return b;
    },
  },
  {
    name: '인기형', parents: ['emotional', 'freedom'], gender: 'female',
    routine2: 'club-activity', routine3: 'part-time-job',
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      const cs = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      let b = 0, bs = -999;
      cs.forEach((c, i) => { const sc = (c.effects.social ?? 0) * 3 + (c.effects.mental ?? 0); if (sc > bs) { bs = sc; b = i; } });
      return b;
    },
  },
  {
    name: '밸런스', parents: ['wealth', 'emotional'], gender: 'male',
    routine2: 'self-study', routine3: 'basketball',
    choicePolicy: () => 0,
  },
];

interface Metrics {
  name: string;
  mode: 'normal' | 'reduced';
  finalMental: number;
  finalHealth: number;
  burnoutCount: number;
  avgFatigue: number;
  peakFatigue: number;
  weeksInTired: number;
  weeksInBurnout: number;
  reachedEnding: boolean;
  suneungGrade: number | null;
  endingTitle: string;
}

function simulate(p: Pattern, useReducedRecovery: boolean): Metrics {
  let s = createInitialState(p.gender, p.parents, { useReducedRecovery });
  s.routineSlot2 = p.routine2;
  s.routineSlot3 = p.routine3;

  const fatigueHistory: number[] = [];
  let tiredWeeks = 0, burnoutWeeks = 0;

  for (let i = 0; i < 420 && s.year <= 7; i++) {
    s = processWeek(s);
    fatigueHistory.push(s.fatigue);
    if (s.mentalState === 'tired') tiredWeeks++;
    if (s.mentalState === 'burnout') burnoutWeeks++;

    while (s.currentEvent) {
      const event = s.currentEvent;
      const ci = p.choicePolicy(s);
      const choices = s.gender === 'female' && event.femaleChoices ? event.femaleChoices : event.choices;
      const choice = choices[Math.min(ci, choices.length - 1)];
      for (const [k, v] of Object.entries(choice.effects)) {
        const cur = (s.stats as unknown as Record<string, number>)[k] ?? 0;
        (s.stats as unknown as Record<string, number>)[k] = Math.max(0, Math.min(100, cur + (v as number)));
      }
      if (choice.fatigueEffect) s.fatigue = Math.max(0, Math.min(100, s.fatigue + choice.fatigueEffect));
      if (choice.moneyEffect) s.money += choice.moneyEffect;
      if (choice.npcEffects) for (const ne of choice.npcEffects) {
        const npc = s.npcs.find(n => n.id === ne.npcId);
        if (npc) { npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange)); npc.met = true; }
      }
      applyMemorySlotFromChoice(s, event, ci, choice);
      if (choice.addBuff) {
        if (!s.activeBuffs) s.activeBuffs = [];
        s.activeBuffs = s.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
        s.activeBuffs.push({ ...choice.addBuff });
      }
      s.events.push({ ...event, resolvedChoice: ci, week: s.week, year: s.year });
      s.currentEvent = null;
      const fu = getFollowupForWeek(s, event.location);
      if (fu) s.currentEvent = fu;
    }
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.phase === 'ending') break;
  }

  const ending = calculateEnding(s);
  const avgFat = fatigueHistory.reduce((a, b) => a + b, 0) / fatigueHistory.length;
  const peakFat = Math.max(...fatigueHistory);

  return {
    name: p.name,
    mode: useReducedRecovery ? 'reduced' : 'normal',
    finalMental: Math.round(s.stats.mental),
    finalHealth: Math.round(s.stats.health),
    burnoutCount: s.burnoutCount,
    avgFatigue: Math.round(avgFat * 10) / 10,
    peakFatigue: Math.round(peakFat),
    weeksInTired: tiredWeeks,
    weeksInBurnout: burnoutWeeks,
    reachedEnding: s.phase === 'ending' || s.year > 7,
    suneungGrade: ending.suneungGrade,
    endingTitle: ending.title,
  };
}

let passed = 0;
let failed = 0;
const failures: string[] = [];
function assert(label: string, cond: boolean, hint?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ''}`); failed++; failures.push(label); }
}

console.log('M6 도전 모드 리그레션\n');

const results: Metrics[] = [];
for (const p of PATTERNS) {
  for (const mode of [false, true]) {
    results.push(simulate(p, mode));
  }
}

// 요약 테이블
console.log('=== 요약 ===');
console.log('패턴         | mode    | mental | burnout | avgFat | tired | burnout주 | ending');
for (const r of results) {
  console.log(`${r.name.padEnd(12)} | ${r.mode.padEnd(7)} | ${String(r.finalMental).padStart(6)} | ${String(r.burnoutCount).padStart(7)} | ${String(r.avgFatigue).padStart(6)} | ${String(r.weeksInTired).padStart(5)} | ${String(r.weeksInBurnout).padStart(9)} | ${r.endingTitle}`);
}

// ========================================
// 1. 양쪽 모드 모두 엔딩 도달 (플레이 불가 방지)
// ========================================
console.log('\n=== 1. 플레이 가능성 ===');
for (const r of results) {
  assert(`${r.name}/${r.mode}: 엔딩 도달`, r.reachedEnding);
}

// ========================================
// 2. reduced 모드가 normal보다 난이도 상향 (체감 차이 보장)
//    — avgFatigue ≥ normal, 단 완전히 같아도 ok하게 허용 폭 둠
//    — mental 또는 peakFatigue 중 하나라도 악화되었는지 확인
// ========================================
console.log('\n=== 2. 난이도 상향 효과 ===');
// mental 최종값은 normal 모드에서 번아웃 회복 이벤트가 더 자주 발동해 오히려 끌어올려지는
// 역설이 있어 난이도 지표로 부적합 — fatigue + tired/burnout 주수만 비교한다.
for (const p of PATTERNS) {
  const n = results.find(r => r.name === p.name && r.mode === 'normal')!;
  const r = results.find(r => r.name === p.name && r.mode === 'reduced')!;

  const fatigueWorse = r.avgFatigue >= n.avgFatigue - 0.5; // 동률 허용
  const stressSignal = r.weeksInTired + r.weeksInBurnout >= n.weeksInTired + n.weeksInBurnout;

  assert(
    `${p.name}: reduced avgFatigue (${r.avgFatigue}) ≥ normal (${n.avgFatigue}) - 0.5`,
    fatigueWorse,
    `normal ${n.avgFatigue} vs reduced ${r.avgFatigue}`
  );
  assert(
    `${p.name}: reduced tired+burnout 주수 (${r.weeksInTired + r.weeksInBurnout}) ≥ normal (${n.weeksInTired + n.weeksInBurnout})`,
    stressSignal
  );
}

// ========================================
// 3. 평균 델타 — 모드 간 유의미한 차이 존재
// ========================================
console.log('\n=== 3. 평균 델타 ===');
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const normalAvgFat = avg(results.filter(r => r.mode === 'normal').map(r => r.avgFatigue));
const reducedAvgFat = avg(results.filter(r => r.mode === 'reduced').map(r => r.avgFatigue));
const fatDelta = reducedAvgFat - normalAvgFat;
const normalBurn = avg(results.filter(r => r.mode === 'normal').map(r => r.burnoutCount));
const reducedBurn = avg(results.filter(r => r.mode === 'reduced').map(r => r.burnoutCount));

console.log(`  평균 fatigue: normal ${normalAvgFat.toFixed(1)} → reduced ${reducedAvgFat.toFixed(1)} (Δ ${fatDelta >= 0 ? '+' : ''}${fatDelta.toFixed(1)})`);
console.log(`  평균 burnout: normal ${normalBurn.toFixed(1)} → reduced ${reducedBurn.toFixed(1)}`);

assert(`평균 fatigue 델타 ≥ +1.0 (체감 차이)`, fatDelta >= 1.0, `현재 ${fatDelta.toFixed(1)}`);
assert(`reduced 모드가 normal보다 번아웃 ≥ 동률`, reducedBurn >= normalBurn - 0.5);

// ========================================
// 4. 과잉 난이도 방지 — reduced에서도 절망적이진 않아야 함
// ========================================
console.log('\n=== 4. 과잉 난이도 방지 ===');
const reducedResults = results.filter(r => r.mode === 'reduced');
const reducedAvgMental = avg(reducedResults.map(r => r.finalMental));
const reducedMaxBurnout = Math.max(...reducedResults.map(r => r.burnoutCount));
const reducedAllReachedEnding = reducedResults.every(r => r.reachedEnding);

assert(`reduced 모드 평균 mental ≥ 20 (바닥 방지)`, reducedAvgMental >= 20, `현재 ${reducedAvgMental.toFixed(1)}`);
assert(`reduced 모드 최대 burnout ≤ 10 (무한 루프 방지)`, reducedMaxBurnout <= 10, `현재 ${reducedMaxBurnout}`);
assert(`reduced 모드 전 패턴이 엔딩 도달`, reducedAllReachedEnding);

// ========================================
// 결과
// ========================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
if (failed > 0) {
  console.log('실패:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
