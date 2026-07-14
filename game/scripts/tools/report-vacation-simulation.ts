// Phase 1 방학 활동 시뮬레이션 — 자동 선택 + 4개 측정 항목
//
// 목적: 방학 슬롯 자동 선택 정책을 시뮬에 추가하고 다음 4개 지표 측정
//   1) short-term-job 방학당 평균 선택 회수
//   2) catch-up 발동 빈도 (활동당 발동 비율, 학년별)
//   3) "알바 2회 + 회복 1회" 패턴 출현 비율
//   4) countryside / family-trip 선택률
//
// 실행: cd game && npx tsx scripts/report-vacation-simulation.ts
//
// 핵심: 기존 runPlaythrough(report-m5-playthrough.ts)와 동일 구조이되,
//   - processWeek 직전에 isVacation && vacationChoices.length===0 이면 자동 채움
//   - 패턴별 선호 활동 정책 적용
//   - vacationLimit 존중, 비용 부족 시 무료 대체, 5슬롯 한도 준수

import { createInitialState, processWeek, getWeekInfo } from '../../src/engine/gameEngine';
import { ACTIVITIES, getActivityCost } from '../../src/engine/activities';
import { getFollowupForWeek } from '../../src/engine/events';
import { applyMemorySlotFromChoice } from '../../src/engine/memorySystem';
import { getParentMods } from '../../src/engine/parentModifiers';
import type { GameState, ParentStrength } from '../../src/engine/types';

// ===== 패턴 5종 (기존 m5-playthrough 재사용) =====
interface Pattern {
  name: string;
  parents: [ParentStrength, ParentStrength];
  gender: 'male' | 'female';
  routine2: string;
  routine3: string;
  // 방학 활동 우선순위 — 높은 인덱스부터 시도
  vacationPriority: string[];
  choicePolicy: (state: GameState) => number;
}

const PATTERNS: Pattern[] = [
  {
    name: '학업형',
    parents: ['info', 'strict'], gender: 'male',
    routine2: 'self-study', routine3: 'academy',
    vacationPriority: [
      'intensive-academy', 'vacation-library', 'short-term-job',
      'neighborhood-hangout', 'countryside',
    ],
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const sc = (c.effects.academic ?? 0) * 3 + (c.effects.mental ?? 0) - (c.fatigueEffect ?? 0);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '인기형',
    parents: ['emotional', 'freedom'], gender: 'female',
    routine2: 'club', routine3: 'part-time',
    vacationPriority: [
      'neighborhood-hangout', 'sports-camp', 'family-trip',
      'creative-project', 'short-term-job', 'vacation-library', 'countryside',
    ],
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const sc = (c.effects.social ?? 0) * 3 + (c.effects.mental ?? 0);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '재능형',
    parents: ['resilience', 'freedom'], gender: 'male',
    routine2: 'basketball', routine3: 'music',
    vacationPriority: [
      'creative-project', 'sports-camp', 'neighborhood-hangout',
      'short-term-job', 'vacation-library', 'countryside',
    ],
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const sc = (c.effects.talent ?? 0) * 3 + (c.effects.mental ?? 0) + (c.effects.social ?? 0);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return best;
    },
  },
  {
    name: '밸런스',
    parents: ['wealth', 'emotional'], gender: 'male',
    routine2: 'self-study', routine3: 'basketball',
    vacationPriority: [
      'vacation-library', 'creative-project', 'neighborhood-hangout',
      'sports-camp', 'family-trip', 'short-term-job', 'countryside', 'intensive-academy',
    ],
    choicePolicy: () => 0,
  },
  {
    name: '회피형',
    parents: ['strict', 'info'], gender: 'female',
    routine2: 'self-study', routine3: 'academy',
    vacationPriority: [
      // 싸고 안전 우선 — 무료 학업/회복, 가난하면 알바
      'vacation-library', 'countryside',
      'neighborhood-hangout', 'creative-project', 'short-term-job',
    ],
    choicePolicy: (s) => {
      const e = s.currentEvent; if (!e) return 0;
      let best = 0, bestScore = -999;
      const choices = s.gender === 'female' && e.femaleChoices ? e.femaleChoices : e.choices;
      choices.forEach((c, i) => {
        const money = -(c.moneyEffect ?? 0);
        const fatigue = -(c.fatigueEffect ?? 0);
        if (money + fatigue > bestScore) { bestScore = money + fatigue; best = i; }
      });
      return best;
    },
  },
];

// ===== 방학 슬롯 자동 선택 =====
// processWeek 시작 시점에 호출. state.week 기준으로 방학이고 vacationChoices가 비어있으면 채움.
function pickVacationChoices(state: GameState, pattern: Pattern): string[] {
  const slotMax = 5 + getParentMods(state.parents).vacationSlotBonus;
  const counts = state.vacationActivityCounts ?? {};
  const picks: string[] = [];
  let slotsLeft = slotMax;
  let moneyLeft = state.money;

  // 우선순위 활동을 순회하며, vacationLimit·돈·요건·슬롯 체크
  // 한 주에 같은 2슬롯 활동을 두 번 넣지 않도록 한 활동은 1회만 추가
  // 하지만 1슬롯 활동 (neighborhood-hangout)은 여러 번 가능 — 우리는 단순화 위해 다른 활동을 채움
  const tried = new Set<string>();

  for (const id of pattern.vacationPriority) {
    if (slotsLeft <= 0) break;
    if (tried.has(id)) continue;
    tried.add(id);
    const a = ACTIVITIES.find(x => x.id === id);
    if (!a) continue;
    // 게이팅
    if (a.seasonGate === 'vacation-only' && !state.isVacation) continue;
    if (a.requires && !a.requires(state)) continue;
    // vacationLimit
    if (a.vacationLimit && (counts[id] ?? 0) >= a.vacationLimit) continue;
    // 슬롯
    if (a.slots > slotsLeft) continue;
    // 비용/수입 — moneyCost 컨벤션: 양수 = 비용 / 음수 = 수입
    // 돈이 모자라면 스킵 (나중에 무료 대체로 채워짐)
    const cost = getActivityCost(a, state.year);
    if (cost > 0 && moneyLeft < cost) continue;
    picks.push(id);
    slotsLeft -= a.slots;
    if (cost > 0) moneyLeft -= cost;
    else if (cost < 0) moneyLeft += -cost;  // 알바 수입 → 같은 방학 안에서 유료 활동 선택 가능
  }

  // 슬롯이 남았으면 무료 fallback으로 채움 — 우선순위 안에서 무료 후보 다시 시도
  // 그래도 안 차면 vacation-library / neighborhood-hangout 우선
  const fallbacks = ['vacation-library', 'neighborhood-hangout', 'creative-project'];
  for (const id of fallbacks) {
    if (slotsLeft <= 0) break;
    const a = ACTIVITIES.find(x => x.id === id);
    if (!a) continue;
    if (a.vacationLimit && (counts[id] ?? 0) >= a.vacationLimit) continue;
    if (a.slots > slotsLeft) continue;
    const cost = getActivityCost(a, state.year);
    if (cost > 0) continue;
    picks.push(id);
    slotsLeft -= a.slots;
  }
  return picks;
}

// ===== 측정 데이터 =====
interface Measurement {
  pattern: string;
  totalVacations: number;             // 방학 횟수 (=14: 7년×2)
  shortTermJobCount: number;          // 단기일자리 총 선택 횟수
  catchupTotal: number;               // catch-up 발동 총 횟수
  catchupActivityCount: number;       // catch-up 트리거 가능 활동 선택 횟수 (분모)
  perVacationMix: { picks: string[] }[]; // 방학당 정렬된 선택 리스트 (메타 패턴 검출용)
  countrysideCount: number;
  familyTripCount: number;
  // 학년별 catch-up 발동 횟수 (방학 단위)
  catchupByYear: Record<number, number[]>; // year → [방학당 발동 수, ...]
}

// ===== 시뮬 실행 =====
async function runVacationSim(p: Pattern): Promise<Measurement> {
  let s = createInitialState(p.gender, p.parents);
  s.routineSlot2 = p.routine2;
  s.routineSlot3 = p.routine3;

  const m: Measurement = {
    pattern: p.name,
    totalVacations: 0,
    shortTermJobCount: 0,
    catchupTotal: 0,
    catchupActivityCount: 0,
    perVacationMix: [],
    countrysideCount: 0,
    familyTripCount: 0,
    catchupByYear: {},
  };

  // 현재 진행 중인 방학 추적
  let currentVacKey = '';
  let currentVacPicks: string[] = [];
  let currentVacCatchups = 0;
  let currentVacYear = 0;

  for (let i = 0; i < 400 && s.year <= 7; i++) {
    // 방학 진입 직전 상태로 정보 조회 (week 기반)
    const info = getWeekInfo(s.week);

    // 방학이 끝났는지 확인 — 이전 vacKey와 다르면 정산
    const vacKey = info.isVacation ? `${s.year}-${s.week <= 24 ? 'summer' : 'winter'}` : '';
    if (vacKey !== currentVacKey) {
      if (currentVacKey) {
        // 이전 방학 정산
        m.perVacationMix.push({ picks: [...currentVacPicks].sort() });
        m.totalVacations++;
        if (!m.catchupByYear[currentVacYear]) m.catchupByYear[currentVacYear] = [];
        m.catchupByYear[currentVacYear].push(currentVacCatchups);
      }
      currentVacKey = vacKey;
      currentVacPicks = [];
      currentVacCatchups = 0;
      currentVacYear = s.year;
    }

    // 방학 + 빈 슬롯 → 자동 채움
    if (info.isVacation && s.vacationChoices.length === 0) {
      // 방학 첫 주에서 vacationActivityCounts가 학기에서 비워져 있는 상태 (processWeek가 학기 중 매주 비우므로)
      const picks = pickVacationChoices({ ...s, isVacation: true }, p);
      s.vacationChoices = picks;

      // 측정용 — 각 활동 선택 카운트
      for (const id of picks) {
        currentVacPicks.push(id);
        if (id === 'short-term-job') m.shortTermJobCount++;
        if (id === 'countryside') m.countrysideCount++;
        if (id === 'family-trip') m.familyTripCount++;

        // catch-up 발동 가능 여부 사전 측정 (실제 적용 전 스탯 기준)
        const a = ACTIVITIES.find(x => x.id === id);
        if (a?.catchupBonus && a.catchupBonus.bonus > 0) {
          m.catchupActivityCount++;
          if (s.stats[a.catchupBonus.targetStat] < a.catchupBonus.threshold) {
            m.catchupTotal++;
            currentVacCatchups++;
          }
        }
      }
    }

    s = processWeek(s);

    // 이벤트 해결
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
      if (choice.npcEffects) {
        for (const ne of choice.npcEffects) {
          const npc = s.npcs.find(n => n.id === ne.npcId);
          if (npc) { npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange)); npc.met = true; }
        }
      }
      applyMemorySlotFromChoice(s, event, ci, choice);
      if (choice.addBuff) {
        if (!s.activeBuffs) s.activeBuffs = [];
        s.activeBuffs = s.activeBuffs.filter(b => b.id !== choice.addBuff!.id);
        s.activeBuffs.push({ ...choice.addBuff });
      }
      s.events.push({ ...event, resolvedChoice: ci, week: s.week, year: s.year,
        resolvedFemale: s.gender === 'female' && !!event.femaleChoices });
      s.currentEvent = null;
      const followup = getFollowupForWeek(s, event.location);
      if (followup) s.currentEvent = followup;
    }

    if (s.phase === 'year-end') {
      s.week = 1; s.year++; s.phase = 'weekday';
    }
    if (s.phase === 'ending') break;
  }

  // 마지막 방학 정산
  if (currentVacKey) {
    m.perVacationMix.push({ picks: [...currentVacPicks].sort() });
    m.totalVacations++;
    if (!m.catchupByYear[currentVacYear]) m.catchupByYear[currentVacYear] = [];
    m.catchupByYear[currentVacYear].push(currentVacCatchups);
  }

  return m;
}

// ===== 메타패턴 검출 =====
function isJobHeavyPattern(picks: string[]): boolean {
  // "알바 2회 + 회복 1회" — short-term-job 2회 + countryside 1회 이상
  const jobs = picks.filter(p => p === 'short-term-job').length;
  const rests = picks.filter(p => p === 'countryside').length;
  return jobs >= 2 && rests >= 1;
}

// ===== 리포트 =====
function printMeasurement(m: Measurement) {
  console.log('\n' + '='.repeat(70));
  console.log(`▶ 패턴: ${m.pattern}`);
  console.log('='.repeat(70));
  console.log(`총 방학 수: ${m.totalVacations}회`);
  console.log(`short-term-job 총 선택: ${m.shortTermJobCount}회 → 방학당 평균 ${(m.shortTermJobCount / Math.max(1, m.totalVacations)).toFixed(2)}회`);
  console.log(`catch-up 발동: ${m.catchupTotal}/${m.catchupActivityCount} (활동당 ${(m.catchupTotal / Math.max(1, m.catchupActivityCount) * 100).toFixed(1)}%)`);
  console.log(`countryside=${m.countrysideCount}회 / family-trip=${m.familyTripCount}회`);

  const jobHeavy = m.perVacationMix.filter(v => isJobHeavyPattern(v.picks)).length;
  console.log(`알바2+회복1 메타패턴: ${jobHeavy}/${m.totalVacations} (${(jobHeavy / Math.max(1, m.totalVacations) * 100).toFixed(1)}%)`);

  console.log(`\n[학년별 catch-up 평균/방학]`);
  for (const y of Object.keys(m.catchupByYear).map(Number).sort((a, b) => a - b)) {
    const arr = m.catchupByYear[y];
    const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    console.log(`  Y${y}: 평균 ${avg.toFixed(2)}회 (방학 ${arr.length}회 중)`);
  }
}

async function main() {
  console.log('Phase 1 방학 시뮬레이션 리포트\n');
  const all: Measurement[] = [];
  for (const p of PATTERNS) {
    const m = await runVacationSim(p);
    printMeasurement(m);
    all.push(m);
  }

  // ===== 종합 =====
  console.log('\n\n' + '='.repeat(70));
  console.log('▶ 종합 (전체 패턴)');
  console.log('='.repeat(70));

  const totalVacations = all.reduce((a, b) => a + b.totalVacations, 0);
  const totalJobs = all.reduce((a, b) => a + b.shortTermJobCount, 0);
  const avgJobPerVac = totalJobs / Math.max(1, totalVacations);
  const totalCatchupTrig = all.reduce((a, b) => a + b.catchupTotal, 0);
  const totalCatchupAct = all.reduce((a, b) => a + b.catchupActivityCount, 0);
  const catchupRate = totalCatchupTrig / Math.max(1, totalCatchupAct);

  // 학년별 catch-up 평균 (전체 패턴 통합)
  const yearCatchups: Record<number, number[]> = {};
  for (const m of all) {
    for (const [y, arr] of Object.entries(m.catchupByYear)) {
      const yn = Number(y);
      if (!yearCatchups[yn]) yearCatchups[yn] = [];
      yearCatchups[yn].push(...arr);
    }
  }

  // 메타패턴 비율 (전체)
  const allMixes = all.flatMap(m => m.perVacationMix);
  const jobHeavyTotal = allMixes.filter(v => isJobHeavyPattern(v.picks)).length;
  const jobHeavyRatio = jobHeavyTotal / Math.max(1, allMixes.length);

  // 회복 활동 선택률 (전체 방학 중)
  const totalCountryside = all.reduce((a, b) => a + b.countrysideCount, 0);
  const totalFamilyTrip = all.reduce((a, b) => a + b.familyTripCount, 0);
  // 한 방학에 한 번 가능한 1회짜리들 → 분모는 방학 횟수
  const countrysideRate = totalCountryside / Math.max(1, totalVacations);
  const familyTripRate = totalFamilyTrip / Math.max(1, totalVacations);

  console.log(`\n총 방학 수: ${totalVacations}회 (5패턴 × 14방학 = ${5 * 14})`);
  console.log(`\n[측정 1] short-term-job 방학당 평균: ${avgJobPerVac.toFixed(2)}회 (총 ${totalJobs}회)`);
  console.log(`  임계값 1.5 — ${avgJobPerVac > 1.5 ? '🔴 초과' : avgJobPerVac > 1.3 ? '⚠ 근접' : '✓ 미만'}`);
  console.log(`  → ${avgJobPerVac > 1.5 ? '수입 +8만 → +6만 다운그레이드 권고' : '+8만 유지 OK'}`);

  console.log(`\n[측정 2] catch-up 활동당 발동률: ${(catchupRate * 100).toFixed(1)}% (${totalCatchupTrig}/${totalCatchupAct})`);
  console.log(`  학년별 방학당 평균:`);
  const exceedYears: number[] = [];
  for (const y of Object.keys(yearCatchups).map(Number).sort((a, b) => a - b)) {
    const arr = yearCatchups[y];
    const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const exceed = avg > 3;
    if (exceed) exceedYears.push(y);
    console.log(`    Y${y}: 평균 ${avg.toFixed(2)}회/방학 ${exceed ? '🔴 (3 초과)' : ''}`);
  }
  console.log(`  → ${exceedYears.length > 0 ? `Y${exceedYears.join(',')} 학년에서 임계값 초과 → threshold 50→45 다운그레이드 권고` : '학년별 모두 임계값 이하 → threshold 50 유지 OK'}`);

  console.log(`\n[측정 3] "알바2+회복1" 메타 패턴: ${jobHeavyTotal}/${allMixes.length} (${(jobHeavyRatio * 100).toFixed(1)}%)`);
  console.log(`  임계값 50% — ${jobHeavyRatio > 0.5 ? '🔴 초과 — 알바 너프 권고' : '✓ 미만'}`);

  console.log(`\n[측정 4] 회복/여행 선택률 (방학당)`);
  console.log(`  countryside: ${(countrysideRate * 100).toFixed(1)}%`);
  console.log(`  family-trip: ${(familyTripRate * 100).toFixed(1)}%`);
  const overdom = [
    countrysideRate > 0.9 ? 'countryside' : null,
    familyTripRate > 0.9 ? 'family-trip' : null,
  ].filter(Boolean);
  console.log(`  → ${overdom.length > 0 ? `${overdom.join(',')} 90% 초과 — 너프 권고` : '편중 없음'}`);

  // ===== 요약 =====
  console.log('\n\n' + '='.repeat(70));
  console.log('▶ 조정 권고 요약');
  console.log('='.repeat(70));
  const recos: string[] = [];
  if (avgJobPerVac > 1.5) recos.push('1. short-term-job 수입 +8만 → +6만 다운그레이드');
  else recos.push('1. short-term-job +8만 유지 OK');
  if (exceedYears.length > 0) recos.push(`2. catch-up threshold 50→45 다운그레이드 (초과 학년: Y${exceedYears.join(',')})`);
  else recos.push('2. catch-up threshold 50 유지 OK');
  if (jobHeavyRatio > 0.5) recos.push('3. 알바 너프 (메타화 신호)');
  else recos.push('3. 알바 메타화 없음 OK');
  if (overdom.length > 0) recos.push(`4. ${overdom.join(',')} 너프`);
  else recos.push('4. 회복/여행 편중 없음 OK');
  recos.forEach(r => console.log('  ' + r));
}

main().catch(e => { console.error(e); process.exit(1); });
