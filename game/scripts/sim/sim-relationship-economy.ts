// 관계·경제 계측 sim — 기존 test-7year-balance.ts가 shop·동행을 전혀 쓰지 않아
// "962만 잔고 / 전원 99 수렴" 같은 수치가 봇 정책 아티팩트였던 문제를 보완한다.
// 여기서는 "관계 최대화" 정책(매주 최저 친밀도 met NPC를 동행 슬롯에 배정 + 생일선물 구매)을
// 다중 고정 시드로 돌려, 친밀도 획득 경로(동행 +3 / 선물 +15)가 고구간 감쇠를 우회하는지
// 계측한다. 친밀도 경로 감쇠 통일(scaleIntimacyChange 편입)의 before/after 측정 도구.
//
// 주의: 이 하네스는 동행·선물 경로만 행사한다(미니톡 talkToNpc는 store 액션이라 미포함).
// 이벤트는 기존 하네스처럼 choices[0]의 스탯/피로/돈만 적용 — 친밀도 변화 소스를
// 동행·선물로 격리해 감쇠 통일 효과를 깨끗하게 관측하기 위함.

import { createInitialState, processWeek, scaleIntimacyChange } from '../../src/engine/gameEngine';
import { getFollowupForWeek } from '../../src/engine/events';
import { SHOP_ITEMS, applyItemEffects, canBuyItem, limitKey, type ShopItem } from '../../src/engine/shopSystem';
import type { GameState, ParentStrength } from '../../src/engine/types';

const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];
const STAT_KEYS: readonly string[] = ['academic', 'social', 'talent', 'mental', 'health'];

function requireItem(id: string): ShopItem {
  const item = SHOP_ITEMS.find(i => i.id === id);
  if (!item) throw new Error(`${id} 아이템을 찾을 수 없음`);
  return item;
}
// 선물 구매 우선순위 — 강한 것부터. concert/movie는 limitGroup 'outing' 공유 슬롯이라
// concert를 먼저 시도하면 movie는 canBuyItem에서 자동 차단된다(공유 슬롯 소진).
// 주간 캡(small 1 / outing 1 / birthday 생일주+1) 하에 "돈으로 살 수 있는 최대 친밀도"를 계측.
const GIFT_ORDER = ['birthday-gift', 'concert-ticket', 'movie-ticket', 'small-gift'];

// 선물 친밀도(npcBonus) 값 스케일 비교용 — id→npcBonus 오버라이드.
// 소스(shopSystem)를 안 건드리고 값 스케일별 before/after를 한 번에 측정한다.
type GiftScale = Record<string, number>;
const SCALES: { label: string; scale: GiftScale | null }[] = [
  { label: '종전 5/8/12/15', scale: { 'small-gift': 5, 'movie-ticket': 8, 'concert-ticket': 12, 'birthday-gift': 15 } },
  { label: '중간 3/5/7/9', scale: { 'small-gift': 3, 'movie-ticket': 5, 'concert-ticket': 7, 'birthday-gift': 9 } },
  { label: '채택 2/4/6/8(현재)', scale: null }, // null = 소스(shopSystem) 실값 — 회귀 방지 겸용
];

// 스케일을 적용한 선물 아이템(npc_intimacy effect의 npcBonus만 치환한 얕은 복제)
function giftsWithScale(scale: GiftScale | null): ShopItem[] {
  return GIFT_ORDER.map(id => {
    const base = requireItem(id);
    if (!scale || scale[id] == null) return base;
    return { ...base, effects: base.effects.map(e => e.type === 'npc_intimacy' ? { ...e, npcBonus: scale[id] } : e) };
  });
}

interface SeedResult {
  seed: number;
  money: number;
  giftsBought: number;
  giftSpend: number;
  metCount: number;
  meanIntimacy: number;
  meanIntimacyY1: number; // Y1 말(중1 진급 시점) met 평균 — 버스트 구매 억제 효과 관측용
  atMax: number; // >=95
  high: number; // >=85
  warm: number; // >=70
}

type Policy = 'maxing' | 'events-only' | 'events-best';

// 선택지의 npcEffects 양수 친밀도 합 (관계 최대화 선택 판단용)
function intimacyGain(ch: { npcEffects?: { intimacyChange: number }[] }): number {
  return (ch.npcEffects ?? []).reduce((s, ne) => s + Math.max(0, ne.intimacyChange), 0);
}

function runRelationshipMaxing(seed: number, policy: Policy = 'maxing', giftItems: ShopItem[] = giftsWithScale(null), traits: [ParentStrength, ParentStrength] = ['emotional', 'wealth']): SeedResult {
  let s = createInitialState('male', traits, { rngSeed: seed });
  s.routineSlot2 = 'club';
  s.routineSlot3 = 'light-exercise';

  let giftsBought = 0;
  let giftSpend = 0;
  let meanIntimacyY1 = 0; // Y1 종료 시점 스냅샷

  for (let week = 0; week < 336; week++) {
    s.weekendChoices = ['hang-out', 'club'];
    s.vacationChoices = ['club', 'hang-out', 'rest'];

    // 동행: met NPC 중 친밀도 최저 2명을 동행 슬롯에 배정 (전원 끌어올리기 정책)
    const npcActivityMap: Record<string, string> = {};
    if (policy === 'maxing') {
      const companions = s.npcs.filter(n => n.met).sort((a, b) => a.intimacy - b.intimacy).slice(0, 2);
      companions.forEach((n, i) => { npcActivityMap[`slot${i}`] = n.id; });
    }

    s = processWeek(s, npcActivityMap);

    // 이벤트 해결 — choices[0] 적용. resolveEvent(store)와 동일하게 스탯/피로/돈 +
    // npcEffects(scaleIntimacyChange 경유)·speakers로 met 처리까지 재현해야 NPC를 실제로 만난다.
    while (s.currentEvent) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      // events-best: 친밀도 최대 선택지 / 그 외: choices[0]
      const ch = policy === 'events-best'
        ? [...choices].sort((a, b) => intimacyGain(b) - intimacyGain(a))[0]
        : choices[0];
      for (const [k, v] of Object.entries(ch.effects)) {
        if (STAT_KEYS.includes(k)) {
          const stat = k as keyof GameState['stats'];
          s.stats[stat] = Math.max(0, Math.min(100, s.stats[stat] + Number(v)));
        }
      }
      if (ch.fatigueEffect) s.fatigue = Math.max(0, Math.min(100, s.fatigue + ch.fatigueEffect));
      if (ch.moneyEffect) s.money += ch.moneyEffect;
      // 선택한 choice의 npcEffects: 친밀도(감쇠 경유) + met
      if (ch.npcEffects) {
        for (const ne of ch.npcEffects) {
          const npc = s.npcs.find(n => n.id === ne.npcId);
          if (npc) {
            npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + scaleIntimacyChange(ne.intimacyChange, npc.intimacy)));
            npc.met = true;
          }
        }
      }
      // 모든 분기 npcEffects + speakers 등장 NPC도 met (resolveEvent 규칙)
      for (const c of [...ev.choices, ...(ev.femaleChoices ?? [])]) {
        for (const ne of c.npcEffects ?? []) {
          const npc = s.npcs.find(n => n.id === ne.npcId);
          if (npc) npc.met = true;
        }
      }
      for (const npcId of ev.speakers ?? []) {
        const npc = s.npcs.find(n => n.id === npcId);
        if (npc) npc.met = true;
      }
      s.events.push({ ...ev, resolvedChoice: 0, week: s.week, year: s.year });
      s.currentEvent = null;
      const fu = getFollowupForWeek(s, ev.location);
      if (fu) s.currentEvent = fu;
    }

    // 선물: 주간 캡을 존중해 살 수 있는 선물을 우선순위대로 전부 구매(가장 낮은 met NPC 대상).
    // canBuyItem이 maxPerWeek/limitGroup(공유 슬롯)/requireBirthday를 강제하고,
    // store.buyItem과 동일하게 limitKey로 weekPurchases를 수동 증가시켜 캡을 반영한다.
    if (policy === 'maxing') {
      s.weekPurchases = { ...(s.weekPurchases ?? {}) };
      for (const gift of giftItems) {
        const target = s.npcs.filter(n => n.met && n.intimacy < 95).sort((a, b) => a.intimacy - b.intimacy)[0];
        if (!target) break;
        if (!canBuyItem(gift, s, s.weekPurchases).ok) continue;
        const { newState } = applyItemEffects(gift, s, target.id);
        s = newState;
        const key = limitKey(gift);
        s.weekPurchases = { ...(s.weekPurchases ?? {}) };
        s.weekPurchases[key] = (s.weekPurchases[key] || 0) + 1;
        giftsBought++;
        giftSpend += gift.price;
      }
    }

    if (s.phase === 'year-end') {
      if (s.year === 1) {
        const m = s.npcs.filter(n => n.met);
        meanIntimacyY1 = m.length ? m.reduce((sum, n) => sum + n.intimacy, 0) / m.length : 0;
      }
      s.week = 1; s.year++; s.phase = 'weekday';
    }
    if (s.phase === 'ending') break;
  }

  const met = s.npcs.filter(n => n.met);
  const meanIntimacy = met.length ? met.reduce((sum, n) => sum + n.intimacy, 0) / met.length : 0;
  return {
    seed,
    money: s.money,
    giftsBought,
    giftSpend,
    metCount: met.length,
    meanIntimacy,
    meanIntimacyY1,
    atMax: met.filter(n => n.intimacy >= 95).length,
    high: met.filter(n => n.intimacy >= 85).length,
    warm: met.filter(n => n.intimacy >= 70).length,
  };
}

function summarize(label: string, results: SeedResult[]) {
  const n = results.length;
  const avg = (f: (r: SeedResult) => number) => results.reduce((s, r) => s + f(r), 0) / n;
  console.log(`\n[${label}] met ${avg(r => r.metCount).toFixed(1)} | mean ${avg(r => r.meanIntimacy).toFixed(1)} | ` +
    `Y1말 ${avg(r => r.meanIntimacyY1).toFixed(1)} | ` +
    `≥95 ${avg(r => r.atMax).toFixed(1)} | ≥85 ${avg(r => r.high).toFixed(1)} | ≥70 ${avg(r => r.warm).toFixed(1)} | ` +
    `잔고 ${avg(r => r.money).toFixed(0)}만 | 선물 ${avg(r => r.giftsBought).toFixed(1)}회/${avg(r => r.giftSpend).toFixed(0)}만`);
}

function main() {
  console.log('=== 관계·경제 계측 sim ===');
  console.log(`시드 ${SEEDS.length}개 / male / [emotional, wealth]\n`);

  const eventsOnly = SEEDS.map(s => runRelationshipMaxing(s, 'events-only'));
  summarize('이벤트만·choices[0] (안전선택) — 하한', eventsOnly);

  const eventsBest = SEEDS.map(s => runRelationshipMaxing(s, 'events-best'));
  summarize('이벤트만·최적선택 (동행·선물 0, 돈 0) — 진짜 이벤트 천장', eventsBest);

  // 선물 값 스케일 비교 — 관계 최대화 정책을 스케일별로 돌려 값 하향 효과 계측.
  // 부자(주5만·무한자금)와 비부자(주3만·예산제약) 두 렌즈로: 값 하향은 예산제약 플레이어에게 물린다.
  const n = SEEDS.length;
  const avgOf = (rs: SeedResult[], f: (r: SeedResult) => number) => rs.reduce((s, r) => s + f(r), 0) / n;
  const budgets: { label: string; traits: [ParentStrength, ParentStrength] }[] = [
    { label: '부자 (주5만·무한자금)', traits: ['emotional', 'wealth'] },
    { label: '비부자 (주3만·예산제약)', traits: ['emotional', 'resilience'] },
  ];
  for (const { label: blabel, traits } of budgets) {
    console.log(`\n=== 선물 값 스케일 × ${blabel} (관계 최대화, 캡 적용) ===`);
    console.log('스케일          | mean | Y1말 | 만렙≥95 | ≥85 | ≥70 | 선물수 | 선물지출 | 잔고(만)');
    console.log('----------------|------|------|--------|-----|-----|--------|---------|--------');
    for (const { label, scale } of SCALES) {
      const items = giftsWithScale(scale);
      const rs = SEEDS.map(s => runRelationshipMaxing(s, 'maxing', items, traits));
      console.log(
        `${label.padEnd(15)} | ${avgOf(rs, r => r.meanIntimacy).toFixed(1).padStart(4)} | ` +
        `${avgOf(rs, r => r.meanIntimacyY1).toFixed(1).padStart(4)} | ` +
        `${avgOf(rs, r => r.atMax).toFixed(1).padStart(6)} | ${avgOf(rs, r => r.high).toFixed(1).padStart(3)} | ` +
        `${avgOf(rs, r => r.warm).toFixed(1).padStart(3)} | ` +
        `${avgOf(rs, r => r.giftsBought).toFixed(1).padStart(6)} | ${avgOf(rs, r => r.giftSpend).toFixed(0).padStart(7)} | ${avgOf(rs, r => r.money).toFixed(0).padStart(6)}`,
      );
    }
  }
  console.log('\n※ 부자: 무한자금이라 값 내려도 선물만 더 삼(천장 불변) — 값이 안 물림.');
  console.log('  비부자: 예산이 병목 → 값 하향이 만렙수·mean을 실제로 끌어내림 ← 값 조정의 진짜 대상.');
}

main();
