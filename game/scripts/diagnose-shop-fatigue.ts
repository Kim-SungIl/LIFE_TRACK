// Shop Fatigue Diagnosis Simulation
// 목적: LIFE_TRACK의 SHOP_ITEMS 시스템이 실제 플레이 중 "의사결정 피로"를 유발하는지 정량 분석
// 실행: cd game && npx tsx scripts/diagnose-shop-fatigue.ts

import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { SHOP_ITEMS, canBuyItem, applyItemEffects, SHOP_CATEGORIES, ShopItem, ItemCategory, ItemEffectType } from '../src/engine/shopSystem';
import type { GameState, ParentStrength, StatKey } from '../src/engine/types';

// ============ 공통 유틸 ============
type BuyStrategy = 'none' | 'greedy' | 'smart';

function setupState(seed = 0): GameState {
  const parents: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  const s = createInitialState('male', parents);
  // 루틴 고정: 일반적 플레이 시뮬
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'light-exercise';
  return s;
}

// 카테고리별 weekend 선택 — 실제 플레이어가 고를 법한 기본 세팅
function pickWeekendChoices(state: GameState): string[] {
  // 간단한 휴리스틱: 피로 높으면 rest, 아니면 self-study + hang-out
  if (state.fatigue >= 70) return ['rest', 'rest'];
  if (state.isVacation) return ['self-study', 'self-study', 'hang-out'];
  return ['self-study', 'hang-out'];
}

// 아이템 '즉시 가치' 점수 — 가격당 이득 계산 (greedy 비교용)
function itemImmediateValue(item: ShopItem, state: GameState): number {
  let val = 0;
  for (const eff of item.effects) {
    if (eff.type === 'instant') {
      if (eff.stat === 'fatigue') val += Math.abs(eff.value || 0) * 1.0;  // 피로 -1 ≈ 스탯 +1 가치
      else if (eff.stat === 'money') val += eff.value || 0;
      else val += Math.abs(eff.value || 0) * 1.0;
    } else if (eff.type === 'buff') {
      // 버프는 duration × amount로 추정, all 타겟은 약간 할증
      const mul = eff.buffTarget === 'all' ? 5 : 3;
      val += (eff.buffAmount || 0) * (eff.buffDuration || 0) * mul;
    } else if (eff.type === 'npc_intimacy') {
      val += (eff.npcBonus || 0) * 0.3;
    } else if (eff.type === 'event_unlock') {
      val += 10; // 일회성 해금은 고정 점수
    }
  }
  return item.price > 0 ? val / item.price : val;
}

// ============ 시뮬 루프 ============
interface SimStats {
  strategy: BuyStrategy;
  finalStats: Record<StatKey, number>;
  finalMoney: number;
  finalFatigue: number;
  endingAvailable: boolean;
  totalSpent: number;
  purchaseCount: Record<string, number>;
  // 주당 "고려 대상" 아이템 수 기록
  weeklyBuyableCount: number[];
  // 주당 "의미있는 선택지" (2+ 구매 가능 & 예산 내)
  weeklyMeaningfulChoices: number[];
  // 주당 "실제로 뭔가 샀는지"
  weeklyBought: boolean[];
  // 돈이 흐르는 양상
  weeklyMoney: number[];
  burnoutCount: number;
}

function runSimulation(strategy: BuyStrategy): SimStats {
  let state = setupState();
  const purchaseCount: Record<string, number> = {};
  const weeklyBuyableCount: number[] = [];
  const weeklyMeaningfulChoices: number[] = [];
  const weeklyBought: boolean[] = [];
  const weeklyMoney: number[] = [];
  let totalSpent = 0;

  for (let i = 0; i < 48 * 7; i++) {
    // 주말 선택 세팅
    state.weekendChoices = pickWeekendChoices(state);
    state.vacationChoices = state.isVacation ? pickWeekendChoices(state) : [];

    // === 구매 단계 (주차 시작 전) ===
    const weekPurchases: Record<string, number> = {};
    const buyable: ShopItem[] = [];
    for (const it of SHOP_ITEMS) {
      const chk = canBuyItem(it, state, weekPurchases);
      if (chk.ok) buyable.push(it);
    }
    weeklyBuyableCount.push(buyable.length);

    // "의미있는 선택지" = 예산이 허용하는 구매 가능 아이템이 2+
    // (2+여야 비교 의사결정 발생)
    weeklyMeaningfulChoices.push(buyable.length >= 2 ? buyable.length : 0);

    let boughtThisWeek = false;

    if (strategy === 'greedy') {
      // 매주 "돈 여유"에 따라 구매: 가격당 가치 Top3 중 상황에 맞는 것 여러 개 구매
      // 보다 현실적: 여러 아이템 살 수도 있음 (maxPerWeek 한도 내)
      const ranked = [...buyable].sort((a, b) => itemImmediateValue(b, state) - itemImmediateValue(a, state));
      let budgetLeft = Math.max(0, state.money - 3); // 3만원은 안전 비축
      for (const top of ranked) {
        if (budgetLeft < top.price) continue;
        const chk = canBuyItem(top, state, weekPurchases);
        if (!chk.ok) continue;
        const before = state.money;
        const { newState } = applyItemEffects(top, state, state.npcs.find(n => n.met)?.id);
        state = newState;
        const spent = before - state.money;
        totalSpent += spent;
        budgetLeft -= spent;
        purchaseCount[top.id] = (purchaseCount[top.id] || 0) + 1;
        weekPurchases[top.id] = (weekPurchases[top.id] || 0) + 1;
        boughtThisWeek = true;
      }
    } else if (strategy === 'smart') {
      // 컨디션 기반: 피로 높으면 energy-drink / 멘탈 낮으면 sweet-drink / 시험주차면 workbook
      const upcoming = [8, 17, 30, 38];
      const nearExam = upcoming.some(w => Math.abs(w - state.week) <= 1);
      const needFatigue = state.fatigue >= 60;
      const needMental = state.stats.mental <= 40;
      let pick: ShopItem | null = null;
      if (nearExam) pick = buyable.find(i => i.id === 'workbook') || null;
      if (!pick && needFatigue) pick = buyable.find(i => i.id === 'energy-drink') || null;
      if (!pick && needMental) pick = buyable.find(i => i.id === 'sweet-drink') || null;
      if (pick) {
        const before = state.money;
        const { newState } = applyItemEffects(pick, state);
        state = newState;
        totalSpent += (before - state.money);
        purchaseCount[pick.id] = (purchaseCount[pick.id] || 0) + 1;
        boughtThisWeek = true;
      }
    }
    // 'none' 전략은 아무것도 안 삼

    weeklyBought.push(boughtThisWeek);
    weeklyMoney.push(state.money);

    // 주차 진행
    state = processWeek(state);

    // 이벤트 자동 해결 (첫 선택지)
    while (state.currentEvent) {
      const ch = state.currentEvent.choices[0];
      if (!ch) break;
      state.currentEvent = null;
    }
    if (state.year > 7) break;
  }

  return {
    strategy,
    finalStats: { ...state.stats },
    finalMoney: state.money,
    finalFatigue: state.fatigue,
    endingAvailable: state.year > 7 || state.phase === 'ending',
    totalSpent,
    purchaseCount,
    weeklyBuyableCount,
    weeklyMeaningfulChoices,
    weeklyBought,
    weeklyMoney,
    burnoutCount: state.burnoutCount,
  };
}

// ============ 분석 리포트 ============
function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function pct(n: number, total: number): string {
  return total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';
}

console.log('='.repeat(80));
console.log('SHOP FATIGUE DIAGNOSIS — 336주 플레이 시뮬 (wealth+emotional)');
console.log('='.repeat(80));

// ============ 질문 1: SHOP_ITEMS 구조 ============
console.log('\n### Q1. SHOP_ITEMS 구조 분석\n');
const byCategory: Record<ItemCategory, ShopItem[]> = {
  consumable: [], growth: [], gift: [], fashion: [], opportunity: [],
};
for (const it of SHOP_ITEMS) byCategory[it.category].push(it);

console.log('카테고리별 아이템 수 / 가격대:');
console.log('Cat        Count  PriceRange   Avg   Items');
for (const cat of Object.keys(byCategory) as ItemCategory[]) {
  const items = byCategory[cat];
  const prices = items.map(i => i.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const avgP = avg(prices).toFixed(1);
  console.log(`${cat.padEnd(11)}${String(items.length).padStart(4)}   ${String(minP).padStart(4)}~${String(maxP).padEnd(5)} ${avgP.padStart(5)}   ${items.map(i => i.id).join(', ')}`);
}

// 효과 타입별 분포
const byEffect: Record<ItemEffectType, number> = {
  instant: 0, buff: 0, event_unlock: 0, npc_intimacy: 0,
};
for (const it of SHOP_ITEMS) {
  for (const e of it.effects) byEffect[e.type]++;
}
console.log('\n효과 타입 분포 (effect 단위 count, 아이템 1개가 여러 effect 가질 수 있음):');
for (const k of Object.keys(byEffect) as ItemEffectType[]) {
  console.log(`  ${k.padEnd(15)} ${byEffect[k]}`);
}

// 제약 필드 사용
const withReqYear = SHOP_ITEMS.filter(i => i.requireYear).length;
const withReqStat = SHOP_ITEMS.filter(i => i.requireStat).length;
const withSeasonal = SHOP_ITEMS.filter(i => i.seasonal).length;
const withMaxPerWeek = SHOP_ITEMS.filter(i => i.maxPerWeek).length;
const withCustomMsg = SHOP_ITEMS.filter(i => i.purchaseMessage).length;
console.log('\n제약 필드 사용 현황:');
console.log(`  requireYear:    ${withReqYear}/${SHOP_ITEMS.length}`);
console.log(`  requireStat:    ${withReqStat}/${SHOP_ITEMS.length}`);
console.log(`  seasonal:       ${withSeasonal}/${SHOP_ITEMS.length}`);
console.log(`  maxPerWeek:     ${withMaxPerWeek}/${SHOP_ITEMS.length}`);
console.log(`  purchaseMessage:${withCustomMsg}/${SHOP_ITEMS.length}`);

// 가벼운 vs 무거운 결정
// 가벼운: price <= 2 + instant 효과만 + maxPerWeek 있음 (반복형)
// 무거운: price >= 5 or requireYear/Stat or event_unlock (일회성·조건부)
const light = SHOP_ITEMS.filter(i =>
  i.price <= 2 && i.effects.every(e => e.type === 'instant' || e.type === 'buff') && !i.requireYear && !i.requireStat
);
const heavy = SHOP_ITEMS.filter(i =>
  i.price >= 5 || i.requireYear || i.requireStat || i.effects.some(e => e.type === 'event_unlock')
);
const medium = SHOP_ITEMS.length - light.length - heavy.length;
console.log('\n결정 무게:');
console.log(`  가벼운 결정 (저가/즉시/반복): ${light.length}개  [${light.map(i => i.id).join(', ')}]`);
console.log(`  중간:                        ${medium}개`);
console.log(`  무거운 결정 (고가/조건부/일회): ${heavy.length}개  [${heavy.map(i => i.id).join(', ')}]`);

// ============ 질문 2: 실제 플레이 시뮬 ============
console.log('\n\n### Q2. 실플레이 시뮬 — 3가지 전략 비교\n');

const none = runSimulation('none');
const greedy = runSimulation('greedy');
const smart = runSimulation('smart');

function report(sim: SimStats) {
  console.log(`\n[${sim.strategy.toUpperCase()} 전략]`);
  console.log(`  최종 스탯: aca=${sim.finalStats.academic.toFixed(1)} soc=${sim.finalStats.social.toFixed(1)} tal=${sim.finalStats.talent.toFixed(1)} men=${sim.finalStats.mental.toFixed(1)} hea=${sim.finalStats.health.toFixed(1)}`);
  console.log(`  최종 돈=${sim.finalMoney.toFixed(1)}, 피로=${sim.finalFatigue.toFixed(1)}, 번아웃=${sim.burnoutCount}회`);
  console.log(`  총 지출: ${sim.totalSpent.toFixed(1)}만원 (336주)`);
  console.log(`  주당 평균 고려 대상 아이템: ${avg(sim.weeklyBuyableCount).toFixed(2)}개`);
  console.log(`  주당 "의미있는 선택지(2+)" 비율: ${pct(sim.weeklyMeaningfulChoices.filter(n => n > 0).length, sim.weeklyMeaningfulChoices.length)}`);
  console.log(`  실제 구매한 주 비율: ${pct(sim.weeklyBought.filter(Boolean).length, sim.weeklyBought.length)}`);
  const avgMoney = avg(sim.weeklyMoney);
  const maxMoney = Math.max(...sim.weeklyMoney);
  const minMoney = Math.min(...sim.weeklyMoney);
  console.log(`  돈 추이: 평균=${avgMoney.toFixed(1)} min=${minMoney.toFixed(1)} max=${maxMoney.toFixed(1)}`);
  // Top 구매
  const sorted = Object.entries(sim.purchaseCount).sort((a, b) => b[1] - a[1]);
  console.log(`  구매 Top 5: ${sorted.slice(0, 5).map(([id, n]) => `${id}×${n}`).join(', ')}`);
}

report(none);
report(greedy);
report(smart);

// 데드 아이템 분석
console.log('\n\n### 데드 아이템 분석 (greedy 전략에서 0회 구매된 아이템)');
const greedyBought = new Set(Object.keys(greedy.purchaseCount));
const deadItems = SHOP_ITEMS.filter(i => !greedyBought.has(i.id));
console.log(`데드 아이템 ${deadItems.length}/${SHOP_ITEMS.length}개:`);
for (const item of deadItems) {
  const reasons: string[] = [];
  if (item.price >= 5) reasons.push(`고가(${item.price})`);
  if (item.requireYear) reasons.push(`Y${item.requireYear}+`);
  if (item.requireStat) reasons.push(`${item.requireStat.stat}${item.requireStat.min}+`);
  if (item.effects.some(e => e.type === 'event_unlock')) reasons.push('event_unlock');
  if (item.seasonal) reasons.push('방학한정');
  console.log(`  ${item.id.padEnd(18)} price=${String(item.price).padStart(4)}  [${reasons.join(', ') || 'low-value'}]`);
}

// ============ 질문 3: 의존도 진단 ============
console.log('\n\n### Q3. 상점 의존도 진단 — none vs greedy 비교');

const statKeys: StatKey[] = ['academic', 'social', 'talent', 'mental', 'health'];
console.log('\n상점 미사용(none) vs 매주 구매(greedy) 스탯 격차:');
console.log('Stat       None   Greedy  Gap(%)');
for (const k of statKeys) {
  const nv = none.finalStats[k];
  const gv = greedy.finalStats[k];
  const gap = nv > 0 ? ((gv - nv) / nv) * 100 : 0;
  console.log(`  ${k.padEnd(10)} ${nv.toFixed(1).padStart(5)}  ${gv.toFixed(1).padStart(5)}  ${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%`);
}
const noneTotal = statKeys.reduce((s, k) => s + none.finalStats[k], 0);
const greedyTotal = statKeys.reduce((s, k) => s + greedy.finalStats[k], 0);
console.log(`  총합       ${noneTotal.toFixed(1).padStart(5)}  ${greedyTotal.toFixed(1).padStart(5)}  ${((greedyTotal - noneTotal) / noneTotal * 100).toFixed(1)}%`);

console.log(`\n번아웃 횟수: none=${none.burnoutCount}, greedy=${greedy.burnoutCount}, smart=${smart.burnoutCount}`);
console.log(`최종 피로:   none=${none.finalFatigue.toFixed(1)}, greedy=${greedy.finalFatigue.toFixed(1)}, smart=${smart.finalFatigue.toFixed(1)}`);

// 돈 흐름 관찰
console.log('\n돈 흐름 — 연도별 평균 잔고 (none 전략):');
for (let y = 1; y <= 7; y++) {
  const slice = none.weeklyMoney.slice((y - 1) * 48, y * 48);
  if (slice.length) console.log(`  Y${y}: 평균=${avg(slice).toFixed(1)}만원, 최대=${Math.max(...slice).toFixed(1)}만원`);
}
console.log('\n돈 흐름 — 연도별 평균 잔고 (greedy 전략):');
for (let y = 1; y <= 7; y++) {
  const slice = greedy.weeklyMoney.slice((y - 1) * 48, y * 48);
  if (slice.length) console.log(`  Y${y}: 평균=${avg(slice).toFixed(1)}만원, 최대=${Math.max(...slice).toFixed(1)}만원`);
}

console.log('\n' + '='.repeat(80));
console.log('END');
console.log('='.repeat(80));
