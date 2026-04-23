// M6 자연 회복 A/B 리포트
// 목적: useReducedRecovery on/off 비교로 "회복 과잉"이 정말 돈 싱크 실패를
// 설명하는지 측정. 플레이어 체감 기준도 같이 뽑음.
//
// 실행: cd game && npx tsx scripts/report-m6-recovery.ts

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

const PATTERNS: Pattern[] = [
  {
    name: '학업형',
    parents: ['info', 'strict'], gender: 'male',
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
    name: '인기형',
    parents: ['emotional', 'freedom'], gender: 'female',
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
    name: '밸런스',
    parents: ['wealth', 'emotional'], gender: 'male',
    routine2: 'self-study', routine3: 'basketball',
    choicePolicy: () => 0,
  },
];

async function runPlaythrough(p: Pattern, useReducedRecovery: boolean): Promise<GameState> {
  let s = createInitialState(p.gender, p.parents, { useReducedRecovery });
  s.routineSlot2 = p.routine2;
  s.routineSlot3 = p.routine3;

  for (let i = 0; i < 420 && s.year <= 7; i++) {
    s = processWeek(s);
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
  return s;
}

interface Metrics {
  name: string;
  mode: string;
  finalStats: [number, number, number, number, number]; // aca/soc/tal/men/hea
  finalMoney: number;
  burnoutCount: number;
  avgFatigue: number;
  peakFatigue: number;
  weeksInTired: number;
  weeksInBurnout: number;
  suneungScore: number | null;
  suneungGrade: number | null;
  endingTitle: string;
  memorySlotCount: number;
}

async function measure(p: Pattern, mode: boolean): Promise<Metrics> {
  // 스탯 궤적 추적 위해 processWeek에 훅 넣을 수 없으니 재실행하며 추적
  let s = createInitialState(p.gender, p.parents, { useReducedRecovery: mode });
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
    mode: mode ? 'reduced' : 'normal',
    finalStats: [Math.round(s.stats.academic), Math.round(s.stats.social), Math.round(s.stats.talent), Math.round(s.stats.mental), Math.round(s.stats.health)],
    finalMoney: Math.round(s.money),
    burnoutCount: s.burnoutCount,
    avgFatigue: Math.round(avgFat * 10) / 10,
    peakFatigue: Math.round(peakFat),
    weeksInTired: tiredWeeks,
    weeksInBurnout: burnoutWeeks,
    suneungScore: ending.suneungGrade ? (s.examResults.find(e => e.examType === 'suneung')?.average ?? null) : null,
    suneungGrade: ending.suneungGrade,
    endingTitle: ending.title,
    memorySlotCount: s.memorySlots.length,
  };
}

async function main() {
  console.log('M6 자연 회복 A/B 리포트\n');
  console.log('normal = 기존 회복 (fatigue × 0.15 + emotional/방학 보너스)');
  console.log('reduced = 도전 모드 (전체 × 0.6, tired/burnout 자동회복도 감소)\n');

  const results: Metrics[] = [];
  for (const p of PATTERNS) {
    for (const mode of [false, true]) {
      results.push(await measure(p, mode));
    }
  }

  // ===== 패턴별 상세 표 =====
  for (const p of PATTERNS) {
    console.log(`\n===== ${p.name} =====`);
    const normal = results.find(r => r.name === p.name && r.mode === 'normal')!;
    const reduced = results.find(r => r.name === p.name && r.mode === 'reduced')!;
    console.log('지표                  normal    reduced   차이');
    console.log('---------------------|---------|---------|------');
    const row = (label: string, a: number | null, b: number | null) => {
      const aStr = a === null ? 'N/A' : String(a);
      const bStr = b === null ? 'N/A' : String(b);
      const diff = (a !== null && b !== null) ? (b - a >= 0 ? `+${b - a}` : `${b - a}`) : '—';
      console.log(`${label.padEnd(21)}| ${aStr.padStart(8)}| ${bStr.padStart(8)}| ${diff}`);
    };
    row('academic', normal.finalStats[0], reduced.finalStats[0]);
    row('mental',   normal.finalStats[3], reduced.finalStats[3]);
    row('health',   normal.finalStats[4], reduced.finalStats[4]);
    row('잔고(만원)',      normal.finalMoney, reduced.finalMoney);
    row('번아웃 횟수',      normal.burnoutCount, reduced.burnoutCount);
    row('평균 fatigue', normal.avgFatigue, reduced.avgFatigue);
    row('peak fatigue',  normal.peakFatigue, reduced.peakFatigue);
    row('tired 주수',     normal.weeksInTired, reduced.weeksInTired);
    row('burnout 주수',   normal.weeksInBurnout, reduced.weeksInBurnout);
    row('수능 원점수',    normal.suneungScore, reduced.suneungScore);
    row('수능 등급',     normal.suneungGrade, reduced.suneungGrade);
    row('memorySlot',  normal.memorySlotCount, reduced.memorySlotCount);
    console.log(`엔딩                 | "${normal.endingTitle}" → "${reduced.endingTitle}"`);
  }

  // ===== 평균 비교 =====
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
  const normalRs = results.filter(r => r.mode === 'normal');
  const reducedRs = results.filter(r => r.mode === 'reduced');

  console.log('\n\n===== 평균 비교 =====');
  console.log(`잔고: normal ${avg(normalRs.map(r => r.finalMoney))}만 → reduced ${avg(reducedRs.map(r => r.finalMoney))}만`);
  console.log(`번아웃: normal ${avg(normalRs.map(r => r.burnoutCount))} → reduced ${avg(reducedRs.map(r => r.burnoutCount))}`);
  console.log(`평균 fatigue: normal ${avg(normalRs.map(r => r.avgFatigue))} → reduced ${avg(reducedRs.map(r => r.avgFatigue))}`);
  console.log(`tired 주수: normal ${avg(normalRs.map(r => r.weeksInTired))} → reduced ${avg(reducedRs.map(r => r.weeksInTired))}`);
  console.log(`burnout 주수: normal ${avg(normalRs.map(r => r.weeksInBurnout))} → reduced ${avg(reducedRs.map(r => r.weeksInBurnout))}`);
  console.log(`수능 원점수: normal ${avg(normalRs.filter(r => r.suneungScore).map(r => r.suneungScore!))} → reduced ${avg(reducedRs.filter(r => r.suneungScore).map(r => r.suneungScore!))}`);

  // ===== 판정 =====
  console.log('\n\n===== 판정 =====');
  const moneyDelta = avg(reducedRs.map(r => r.finalMoney)) - avg(normalRs.map(r => r.finalMoney));
  const burnoutDelta = avg(reducedRs.map(r => r.burnoutCount)) - avg(normalRs.map(r => r.burnoutCount));

  if (moneyDelta < -100) {
    console.log(`✓ 돈 싱크 효과 확인: reduced 모드 잔고 ${moneyDelta}만원 감소 → 상점·관계 의사결정 압박 증가`);
  } else {
    console.log(`⚠ 돈 싱크 효과 제한: reduced에서도 잔고 ${moneyDelta}만원 차이. "회복 과잉"이 돈 싱크 실패의 유일한 원인은 아님 — M7 기억 매개 상점 필요`);
  }
  if (burnoutDelta > 2) {
    console.log(`✓ 번아웃 빈도 증가: +${burnoutDelta} — 도전 모드로서 긴장감 있음`);
  } else {
    console.log(`⚠ 번아웃 차이 미미: ${burnoutDelta} — reduced 모드가 너무 약할 수 있음`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
