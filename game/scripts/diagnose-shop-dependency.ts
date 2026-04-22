// Shop Dependency Root Cause Diagnosis
// 목적: 상점 의존(snack/energy-drink/sweet-drink 매주 구매)의 근본 원인 분석
// - 자연 회복 vs 소모품 회복 balance sheet
// - shop-off 시나리오 위기 구간 검출
// - shop-on vs shop-off 격차
// - 개선 레버 제안
// 실행: cd game && npx tsx scripts/diagnose-shop-dependency.ts

import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { ACTIVITIES } from '../src/engine/activities';
import { SHOP_ITEMS, applyItemEffects, canBuyItem } from '../src/engine/shopSystem';
import type { GameState, ParentStrength } from '../src/engine/types';

// ===== 시뮬 유틸 =====
function mkState(seed: number, parents: [ParentStrength, ParentStrength] = ['freedom', 'emotional']): GameState {
  // seed는 시나리오 변주용 (결정론 유지)
  const s = createInitialState('male', parents);
  // 기본 루틴: 일반 플레이 가정
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'light-exercise';
  return s;
}

// 주말 선택 휴리스틱 — 실제 플레이어가 고를 법한 합리적 루틴
// 피로 주도형: 피로 높으면 rest / deep-rest, 아니면 self-study + hang-out
function pickChoices(state: GameState, seed: number, variant: 'baseline' | 'rest-heavy' | 'study-heavy' | 'no-rest'): string[] {
  const f = state.fatigue;
  const m = state.stats.mental;

  if (state.isVacation) {
    // 방학: 2슬롯 (주말 기준으로 채움, 방학은 최대 3)
    if (variant === 'rest-heavy') {
      if (f >= 60) return ['deep-rest'];
      return ['self-study', 'rest'];
    }
    if (variant === 'study-heavy') {
      if (f >= 80) return ['deep-rest'];
      return ['self-study', 'self-study', 'hang-out'];
    }
    // baseline
    if (f >= 70) return ['deep-rest'];
    if (f >= 50) return ['rest', 'self-study'];
    return ['self-study', 'hang-out'];
  }

  // 학기 중 주말: 2슬롯
  if (variant === 'rest-heavy') {
    if (f >= 60 || m <= 30) return ['rest', 'rest'];
    if (f >= 40) return ['rest', 'self-study'];
    return ['self-study', 'hang-out'];
  }
  if (variant === 'study-heavy') {
    if (f >= 85) return ['rest', 'rest'];
    return ['self-study', 'self-study'];
  }
  if (variant === 'no-rest') {
    // 절대 쉬지 않는 플레이어 — 피로/멘탈 무시
    return ['self-study', 'hang-out'];
  }
  // baseline
  if (f >= 75 || m <= 25) return ['rest', 'rest'];
  if (f >= 55) return ['rest', 'self-study'];
  return ['self-study', 'hang-out'];
}

// ===== Q1: balance sheet =====
function q1BalanceSheet() {
  console.log('='.repeat(80));
  console.log('Q1. 자연 회복 vs 소모품 효과 — Balance Sheet');
  console.log('='.repeat(80));

  // 피로 자연 회복 수식: max(3, min(12, fatigue*0.15)) + emotional(+2 or +1) + vacation(+2)
  // school class: +2 피로
  // 활동 피로: rest -10, deep-rest -22, light-exercise +2, self-study +5, study-group +4
  console.log('\n[자연 회복 / 증가 수치]');
  console.log('  피로 자연회복(주 1회):  min 3, 최대 12 (비례 15%) + emotional +1~2 + 방학 +2');
  console.log('  학교수업(학기중):       피로 +2, 학업 +0.3');
  console.log('  tired 상태:            피로 -5 + 멘탈 +1 (자동)');
  console.log('  burnout 상태:          피로 -12 + 멘탈 +4 (자동)');
  console.log('  멘탈 자연감소:         80+ -2/주, 90+ -4/주');
  console.log('  피로→멘탈 침식:        40+ -1, 60+ -2, 80+ -4');

  console.log('\n[활동별 피로·멘탈 효율]');
  const relevant = ['self-study', 'light-exercise', 'school-sports', 'rest', 'deep-rest', 'hang-out', 'gaming', 'family-dinner', 'reading', 'park-walk'];
  console.log('  id                fat     mental  other     note');
  for (const id of relevant) {
    const a = ACTIVITIES.find(x => x.id === id);
    if (!a) continue;
    const fat = a.fatigue >= 0 ? `+${a.fatigue}` : `${a.fatigue}`;
    const m = (a.effects.mental ?? 0);
    const othr = Object.entries(a.effects).filter(([k]) => k !== 'mental').map(([k, v]) => `${k}:+${v}`).join(' ');
    console.log(`  ${id.padEnd(16)}  ${fat.padStart(4)}  ${String(m).padStart(5)}   ${othr.padEnd(20)}`);
  }

  console.log('\n[소모품 instant 효과 (편의점 3종)]');
  const consum = SHOP_ITEMS.filter(i => ['snack', 'energy-drink', 'sweet-drink'].includes(i.id));
  for (const it of consum) {
    const desc = it.effects.map(e => {
      if (e.type === 'instant') return `${e.stat} ${e.value! > 0 ? '+' : ''}${e.value}`;
      if (e.type === 'buff') return `buff ${e.buffTarget} +${((e.buffAmount || 0) * 100).toFixed(0)}% x${e.buffDuration}주`;
      return e.type;
    }).join(' | ');
    console.log(`  ${it.id.padEnd(14)} ${it.price}만원  ${desc}  (max/주=${it.maxPerWeek ?? '-'})`);
  }

  console.log('\n[용돈 모델]');
  console.log('  freedom/normal:  주 +3 - 생활비 1.2 = net +1.8/주');
  console.log('  wealth:          주 +8 - 생활비 2.5 = net +5.5/주');

  console.log('\n[주간 피로 balance — self-study + light-exercise 루틴, 주말 휴식 없음 가정]');
  // self-study +5, light-exercise +2 (health가 낮으면 그대로, 30+면 -1 감소 적용)
  // 학교 +2
  // 자연회복: 최소 3, 피로가 어느 정도 누적돼야 증가
  console.log('  피로 증가: 학교+2, self-study+5, light-ex+2 = +9/주 (루틴만)');
  console.log('  주말 추가 활동(self-study+hang-out): +5+3 = +8 → 합 +17/주');
  console.log('  자연회복: -3~-6 (emotional 없으면), -5~-8 (emotional)');
  console.log('  → 순 피로 +9~+14/주. 빠르면 6주, 늦어도 10주 내 피로 50+ 돌입');
}

// ===== Q2: shop-off 시뮬 =====
interface WeekSnap {
  yearWeek: string;
  week: number;
  year: number;
  isVacation: boolean;
  fatigue: number;
  mental: number;
  mentalState: string;
  burnoutCount: number;
  consecutiveTiredWeeks: number;
  crisis: string[]; // 이 주에 발동된 위기 플래그
}

function runShopOffSim(seed: number, variant: 'baseline' | 'rest-heavy' | 'study-heavy' | 'no-rest', parents: [ParentStrength, ParentStrength]): {
  snaps: WeekSnap[];
  finalState: GameState;
} {
  let s = mkState(seed, parents);
  const snaps: WeekSnap[] = [];
  let prevBurnout = 0;

  for (let i = 0; i < 48 * 7; i++) {
    const ch = pickChoices(s, seed, variant);
    if (s.isVacation) { s.vacationChoices = ch; s.weekendChoices = []; }
    else { s.weekendChoices = ch; s.vacationChoices = []; }

    // NO shop purchases

    const beforeWeek = s.week;
    const beforeYear = s.year;
    const beforeVac = s.isVacation;
    s = processWeek(s);

    // 이벤트 자동 패스 (첫 선택지, stat 효과 적용)
    while (s.currentEvent) {
      const c = s.currentEvent.choices[0];
      if (!c) { s.currentEvent = null; break; }
      // 이벤트는 대부분 0 이하 효과지만 그냥 무시 (스탯 자연 적용 skip) — 원래 gameEngine 밖에서 해결됨
      // 단순히 currentEvent만 클리어
      s.currentEvent = null;
      s.phase = s.isVacation ? 'vacation' : 'weekday';
    }

    const crisis: string[] = [];
    if (s.fatigue >= 80) crisis.push('FATIGUE80+');
    if (s.stats.mental <= 20) crisis.push('MENTAL20-');
    if (s.burnoutCount > prevBurnout) crisis.push(`BURNOUT(${s.burnoutCount - prevBurnout})`);
    if ((s.consecutiveTiredWeeks || 0) >= 8) crisis.push('CHRONIC-TIRED');
    prevBurnout = s.burnoutCount;

    snaps.push({
      yearWeek: `Y${beforeYear}W${beforeWeek}`,
      week: beforeWeek,
      year: beforeYear,
      isVacation: beforeVac,
      fatigue: s.fatigue,
      mental: s.stats.mental,
      mentalState: s.mentalState,
      burnoutCount: s.burnoutCount,
      consecutiveTiredWeeks: s.consecutiveTiredWeeks || 0,
      crisis,
    });

    if (s.phase === 'ending') break;
  }
  return { snaps, finalState: s };
}

function q2ShopOff() {
  console.log('\n' + '='.repeat(80));
  console.log('Q2. Shop-OFF 시뮬 — 336주, 소모품 미사용');
  console.log('='.repeat(80));

  const seeds = [1, 2, 3];
  const variants: Array<'baseline' | 'rest-heavy' | 'study-heavy' | 'no-rest'> = ['baseline', 'rest-heavy', 'study-heavy', 'no-rest'];

  for (const variant of variants) {
    console.log(`\n--- Variant: ${variant} (seed 평균 n=${seeds.length}) ---`);
    let totalCrises = 0, totalF80 = 0, totalM20 = 0, totalBO = 0, totalCT = 0;
    let firstCrisisWeeks: number[] = [];
    const firstCrisisByReason: Record<string, number[]> = {};
    let finals: GameState[] = [];
    let crisisWeekLists: string[][] = [];

    for (const seed of seeds) {
      const { snaps, finalState } = runShopOffSim(seed, variant, ['freedom', 'emotional']);
      finals.push(finalState);
      const crisisWeeks: string[] = [];
      let firstAny = -1;
      const firstByReason: Record<string, number> = {};
      for (let i = 0; i < snaps.length; i++) {
        const sn = snaps[i];
        if (sn.crisis.length) {
          totalCrises++;
          if (firstAny < 0) firstAny = i + 1;
          for (const r of sn.crisis) {
            if (firstByReason[r] == null) firstByReason[r] = i + 1;
            if (r === 'FATIGUE80+') totalF80++;
            if (r === 'MENTAL20-') totalM20++;
            if (r.startsWith('BURNOUT')) totalBO++;
            if (r === 'CHRONIC-TIRED') totalCT++;
          }
          if (crisisWeeks.length < 20) crisisWeeks.push(`${sn.yearWeek}[${sn.crisis.join(',')} f=${sn.fatigue} m=${sn.mental}]`);
        }
      }
      if (firstAny > 0) firstCrisisWeeks.push(firstAny);
      for (const [k, v] of Object.entries(firstByReason)) {
        if (!firstCrisisByReason[k]) firstCrisisByReason[k] = [];
        firstCrisisByReason[k].push(v);
      }
      crisisWeekLists.push(crisisWeeks);
    }

    const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    console.log(`  총 위기 주수(합계): ${totalCrises} (fatigue80+: ${totalF80}, mental20-: ${totalM20}, burnout: ${totalBO}, chronic-tired: ${totalCT})`);
    console.log(`  평균 번아웃 횟수: ${avg(finals.map(f => f.burnoutCount)).toFixed(1)}`);
    console.log(`  평균 최종 피로: ${avg(finals.map(f => f.fatigue)).toFixed(1)}`);
    console.log(`  평균 최종 멘탈: ${avg(finals.map(f => f.stats.mental)).toFixed(1)}`);
    console.log(`  첫 위기 주차 평균: W${avg(firstCrisisWeeks).toFixed(1)}`);
    for (const [k, v] of Object.entries(firstCrisisByReason)) {
      console.log(`    첫 ${k}: W${avg(v).toFixed(1)} (시드별=${v.join(',')})`);
    }
    console.log(`  위기 주차 샘플 (seed=${seeds[0]}):`);
    for (const cw of crisisWeekLists[0].slice(0, 12)) {
      console.log(`    ${cw}`);
    }
  }

  // 학기 vs 방학 분석 — baseline seed=1
  console.log('\n--- 학기 중 vs 방학 중 위기 분포 (baseline, seed=1) ---');
  const { snaps } = runShopOffSim(1, 'baseline', ['freedom', 'emotional']);
  const semesterCrises = snaps.filter(s => !s.isVacation && s.crisis.length);
  const vacationCrises = snaps.filter(s => s.isVacation && s.crisis.length);
  const semesterTotal = snaps.filter(s => !s.isVacation).length;
  const vacationTotal = snaps.filter(s => s.isVacation).length;
  console.log(`  학기 중: ${semesterCrises.length}/${semesterTotal} 주 위기 (${(semesterCrises.length / semesterTotal * 100).toFixed(1)}%)`);
  console.log(`  방학 중: ${vacationCrises.length}/${vacationTotal} 주 위기 (${(vacationCrises.length / vacationTotal * 100).toFixed(1)}%)`);
}

// ===== Q3: shop-off vs shop-on 격차 =====
function runWithShop(seed: number, variant: 'baseline' | 'rest-heavy' | 'no-rest', parents: [ParentStrength, ParentStrength], shopMode: 'off' | 'greedy3' | 'crisis-only'): {
  snaps: WeekSnap[]; finalState: GameState; totalSpent: number; purchaseCount: Record<string, number>;
} {
  let s = mkState(seed, parents);
  const snaps: WeekSnap[] = [];
  let prevBurnout = 0;
  let totalSpent = 0;
  const purchaseCount: Record<string, number> = {};

  for (let i = 0; i < 48 * 7; i++) {
    const ch = pickChoices(s, seed, variant);
    if (s.isVacation) { s.vacationChoices = ch; s.weekendChoices = []; }
    else { s.weekendChoices = ch; s.vacationChoices = []; }

    // === 구매 ===
    if (shopMode === 'greedy3') {
      // snack(max 2/주), energy-drink(1/주), sweet-drink(max 2/주) — 매주 가능한 만큼
      const weekP: Record<string, number> = {};
      for (const id of ['snack', 'sweet-drink', 'energy-drink']) {
        const item = SHOP_ITEMS.find(x => x.id === id);
        if (!item) continue;
        const maxTries = item.maxPerWeek ?? 1;
        for (let t = 0; t < maxTries; t++) {
          const chk = canBuyItem(item, s, weekP);
          if (!chk.ok) break;
          if (s.money < item.price + 1) break; // 최소 1만원 비축
          const before = s.money;
          const res = applyItemEffects(item, s);
          s = res.newState;
          totalSpent += (before - s.money);
          weekP[item.id] = (weekP[item.id] || 0) + 1;
          purchaseCount[item.id] = (purchaseCount[item.id] || 0) + 1;
        }
      }
    } else if (shopMode === 'crisis-only') {
      // 위기 감지 시에만: fatigue >= 70 → energy-drink, mental <= 30 → sweet-drink, fatigue 60+ → snack x2
      const weekP: Record<string, number> = {};
      const buys: string[] = [];
      if (s.fatigue >= 70) buys.push('energy-drink', 'snack', 'snack');
      else if (s.fatigue >= 60) buys.push('snack', 'snack');
      if (s.stats.mental <= 30) buys.push('sweet-drink', 'sweet-drink');
      for (const id of buys) {
        const item = SHOP_ITEMS.find(x => x.id === id);
        if (!item) continue;
        const chk = canBuyItem(item, s, weekP);
        if (!chk.ok) continue;
        if (s.money < item.price + 1) continue;
        const before = s.money;
        const res = applyItemEffects(item, s);
        s = res.newState;
        totalSpent += (before - s.money);
        weekP[item.id] = (weekP[item.id] || 0) + 1;
        purchaseCount[item.id] = (purchaseCount[item.id] || 0) + 1;
      }
    }

    const beforeWeek = s.week;
    const beforeYear = s.year;
    const beforeVac = s.isVacation;
    s = processWeek(s);

    while (s.currentEvent) {
      s.currentEvent = null;
      s.phase = s.isVacation ? 'vacation' : 'weekday';
    }

    const crisis: string[] = [];
    if (s.fatigue >= 80) crisis.push('FATIGUE80+');
    if (s.stats.mental <= 20) crisis.push('MENTAL20-');
    if (s.burnoutCount > prevBurnout) crisis.push(`BURNOUT`);
    if ((s.consecutiveTiredWeeks || 0) >= 8) crisis.push('CHRONIC-TIRED');
    prevBurnout = s.burnoutCount;

    snaps.push({
      yearWeek: `Y${beforeYear}W${beforeWeek}`,
      week: beforeWeek,
      year: beforeYear,
      isVacation: beforeVac,
      fatigue: s.fatigue, mental: s.stats.mental,
      mentalState: s.mentalState, burnoutCount: s.burnoutCount,
      consecutiveTiredWeeks: s.consecutiveTiredWeeks || 0, crisis,
    });
    if (s.phase === 'ending') break;
  }
  return { snaps, finalState: s, totalSpent, purchaseCount };
}

function q3Comparison() {
  console.log('\n' + '='.repeat(80));
  console.log('Q3. Shop-OFF vs Shop-ON 격차');
  console.log('='.repeat(80));

  const seeds = [1, 2, 3];
  const parents: [ParentStrength, ParentStrength] = ['freedom', 'emotional'];

  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  // 두 variants 비교: baseline(합리적 플레이) vs no-rest(쉬지 않는 무모한 플레이)
  for (const variant of ['baseline', 'no-rest'] as const) {
    console.log(`\n--- Variant: ${variant} ---`);
    const results: Record<string, { crises: number[]; burnouts: number[]; finalF: number[]; finalM: number[]; spent: number[]; purchases: Record<string, number>[] }> = {
      'OFF': { crises: [], burnouts: [], finalF: [], finalM: [], spent: [], purchases: [] },
      'GREEDY3': { crises: [], burnouts: [], finalF: [], finalM: [], spent: [], purchases: [] },
      'CRISIS-ONLY': { crises: [], burnouts: [], finalF: [], finalM: [], spent: [], purchases: [] },
    };
    for (const seed of seeds) {
      const off = runWithShop(seed, variant, parents, 'off');
      const greedy = runWithShop(seed, variant, parents, 'greedy3');
      const crisis = runWithShop(seed, variant, parents, 'crisis-only');
      for (const [key, r] of [['OFF', off], ['GREEDY3', greedy], ['CRISIS-ONLY', crisis]] as const) {
        results[key].crises.push(r.snaps.filter(s => s.crisis.length).length);
        results[key].burnouts.push(r.finalState.burnoutCount);
        results[key].finalF.push(r.finalState.fatigue);
        results[key].finalM.push(r.finalState.stats.mental);
        results[key].spent.push(r.totalSpent);
        results[key].purchases.push(r.purchaseCount);
      }
    }

    console.log('  Mode          CrisisWks  Burnout  FinalFat  FinalMen  Spent(만)  주요구매');
    for (const k of ['OFF', 'GREEDY3', 'CRISIS-ONLY'] as const) {
      const r = results[k];
      const agg: Record<string, number> = {};
      for (const p of r.purchases) for (const [id, n] of Object.entries(p)) agg[id] = (agg[id] || 0) + n;
      const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${id}×${(n / seeds.length).toFixed(0)}`).join(',');
      console.log(`  ${k.padEnd(13)} ${avg(r.crises).toFixed(1).padStart(9)}  ${avg(r.burnouts).toFixed(1).padStart(6)}  ${avg(r.finalF).toFixed(1).padStart(7)}  ${avg(r.finalM).toFixed(1).padStart(7)}  ${avg(r.spent).toFixed(0).padStart(7)}    ${top}`);
    }

    const off = results['OFF'];
    const greedy = results['GREEDY3'];
    const ca = results['CRISIS-ONLY'];
    console.log('  [격차]');
    console.log(`    OFF→GREEDY3: crisis -${(avg(off.crises) - avg(greedy.crises)).toFixed(1)}주, 번아웃 -${(avg(off.burnouts) - avg(greedy.burnouts)).toFixed(1)}회, 지출 ${avg(greedy.spent).toFixed(0)}만원`);
    console.log(`    OFF→CRISIS-ONLY: crisis -${(avg(off.crises) - avg(ca.crises)).toFixed(1)}주, 지출 ${avg(ca.spent).toFixed(0)}만원`);
  }
}

// ===== Q4: 레버 시뮬 — 현재 설정에서 각 레버 변경 시 효과 추정 =====
// 실제 코드는 안 고치고, 후처리 패치로 시뮬. 간이 approach:
//   - L1 (자연회복 +3): 매 주 피로 추가 -3
//   - L2 (rest 효율 -15 대신 -10): rest 활동을 deep-rest처럼 치환 (overkill이지만 상한 추정)
//   - L3 (주말 +2 피로 회복): 주말에 피로 -2 추가
//   - L4 (routine에 피로 -1): 루틴 피로 증가 -1
//   - L5 (snack 피로 -3 → -1): 소모품 효과 감소 — 이건 shop-off엔 영향 없음
function runShopOffWithLever(seed: number, variant: 'baseline', parents: [ParentStrength, ParentStrength], lever: 'none' | 'L1' | 'L3' | 'L4' | 'L1+L4'): {
  crises: number; burnouts: number; finalF: number; finalM: number;
} {
  let s = mkState(seed, parents);
  let prevBurnout = 0;
  let crises = 0;

  for (let i = 0; i < 48 * 7; i++) {
    const ch = pickChoices(s, seed, variant);
    if (s.isVacation) { s.vacationChoices = ch; s.weekendChoices = []; }
    else { s.weekendChoices = ch; s.vacationChoices = []; }

    s = processWeek(s);
    while (s.currentEvent) { s.currentEvent = null; s.phase = s.isVacation ? 'vacation' : 'weekday'; }

    // Post-processWeek 레버 패치
    if (lever === 'L1' || lever === 'L1+L4') {
      s.fatigue = Math.max(0, s.fatigue - 3); // 자연회복 +3
    }
    if (lever === 'L3') {
      // 주말 전용 추가 회복 (실제론 주말 계산이 별개지만, 근사로 매주 -1로 평탄화)
      s.fatigue = Math.max(0, s.fatigue - 1);
    }
    if (lever === 'L4' || lever === 'L1+L4') {
      s.fatigue = Math.max(0, s.fatigue - 2); // 루틴에 -1*2 (두 슬롯)
    }

    const c: string[] = [];
    if (s.fatigue >= 80) c.push('F');
    if (s.stats.mental <= 20) c.push('M');
    if (s.burnoutCount > prevBurnout) c.push('B');
    if ((s.consecutiveTiredWeeks || 0) >= 8) c.push('T');
    prevBurnout = s.burnoutCount;
    if (c.length) crises++;
    if (s.phase === 'ending') break;
  }
  return { crises, burnouts: s.burnoutCount, finalF: s.fatigue, finalM: s.stats.mental };
}

function q4Levers() {
  console.log('\n' + '='.repeat(80));
  console.log('Q4. 개선 레버 후보 — 시뮬 추정 (shop-off 기준)');
  console.log('='.repeat(80));

  const seeds = [1, 2, 3];
  const parents: [ParentStrength, ParentStrength] = ['freedom', 'emotional'];
  const levers: Array<'none' | 'L1' | 'L3' | 'L4' | 'L1+L4'> = ['none', 'L1', 'L3', 'L4', 'L1+L4'];
  const names: Record<string, string> = {
    'none': 'baseline (shop-off)',
    'L1': 'L1: 자연회복 +3/주',
    'L3': 'L3: 주 -1 추가 회복 (주말 +2 근사)',
    'L4': 'L4: 루틴 활동 피로 -1/슬롯 (-2/주)',
    'L1+L4': 'L1+L4 병행',
  };

  console.log('\n  Lever                              CrisisWks  Burnout  FinalFat  FinalMen');
  for (const lv of levers) {
    let cs: number[] = [], bos: number[] = [], fs: number[] = [], ms: number[] = [];
    for (const sd of seeds) {
      const r = runShopOffWithLever(sd, 'baseline', parents, lv);
      cs.push(r.crises); bos.push(r.burnouts); fs.push(r.finalF); ms.push(r.finalM);
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`  ${names[lv].padEnd(34)} ${avg(cs).toFixed(1).padStart(9)}  ${avg(bos).toFixed(1).padStart(6)}  ${avg(fs).toFixed(1).padStart(7)}  ${avg(ms).toFixed(1).padStart(7)}`);
  }

  console.log('\n  [해석]');
  console.log('    - baseline 위기 주수에서 각 레버가 얼마나 줄이는지 확인');
  console.log('    - L1 (+3/주 자연회복)은 주당 고정 효과 → 장기 누적');
  console.log('    - L4 (루틴 -2)는 학기 중에만 적용되므로 방학 영향 적음');
  console.log('    - L1+L4 조합은 과잉회복 가능성 있음 (피로 0 고착)');
}

// ===== Q2-B: 주간 피로/멘탈 분포 =====
function q2bDistribution() {
  console.log('\n' + '='.repeat(80));
  console.log('Q2-B. 주간 피로/멘탈 분포 — 시스템이 정말 여유로운가?');
  console.log('='.repeat(80));

  for (const variant of ['baseline', 'no-rest', 'study-heavy'] as const) {
    const { snaps } = runShopOffSim(1, variant, ['freedom', 'emotional']);
    const fs = snaps.map(s => s.fatigue);
    const ms = snaps.map(s => s.mental);
    const bucket = (xs: number[], bins: number[]): string => {
      const counts = new Array(bins.length + 1).fill(0);
      for (const x of xs) {
        let idx = bins.findIndex(b => x < b);
        if (idx < 0) idx = bins.length;
        counts[idx]++;
      }
      return counts.map(c => `${c}(${(c / xs.length * 100).toFixed(0)}%)`).join(' ');
    };
    console.log(`\n  [${variant}]`);
    console.log(`    피로 분포 <20/20-40/40-60/60-80/80+: ${bucket(fs, [20, 40, 60, 80])}`);
    console.log(`    멘탈 분포 <20/20-40/40-60/60-80/80+: ${bucket(ms, [20, 40, 60, 80])}`);
    // tired/burnout 비율
    const tired = snaps.filter(s => s.mentalState === 'tired').length;
    const burnout = snaps.filter(s => s.mentalState === 'burnout').length;
    console.log(`    mentalState tired=${tired}/${snaps.length} (${(tired / snaps.length * 100).toFixed(0)}%), burnout=${burnout}`);
    // 피로 피크
    const maxF = Math.max(...fs);
    const maxFIdx = fs.indexOf(maxF);
    console.log(`    피로 최고: ${maxF.toFixed(1)} (${snaps[maxFIdx].yearWeek})`);
  }
}

// ===== Shop-ON baseline (기존 greedy 기준, 비교용) =====
function q3ShopOnBaseline() {
  // greedy3 모드를 쓰면 소모품 매주 구매 = 기존 진단과 동일 상한
  console.log('\n[참고: 실제 플레이어 분포 vs 이론 상한]');
  console.log('  GREEDY3 = 매주 기계 구매 = 이론 상한 (이전 진단 결과)');
  console.log('  CRISIS-ONLY = 위기 감지 시에만 구매 = 현실 플레이어 근사');
  console.log('  실제 플레이어는 UI 클릭 피로, 경제 제약, 잊어버림 등으로 greedy보다 훨씬 덜 삼');
}

// ===== 메인 =====
console.log('LIFE_TRACK Shop Dependency Root Cause Diagnosis');
console.log(`실행 시각: ${new Date().toISOString()}`);
q1BalanceSheet();
q2ShopOff();
q2bDistribution();
q3Comparison();
q3ShopOnBaseline();
q4Levers();

console.log('\n' + '='.repeat(80));
console.log('END — 해석은 최종 보고서 참고');
console.log('='.repeat(80));
