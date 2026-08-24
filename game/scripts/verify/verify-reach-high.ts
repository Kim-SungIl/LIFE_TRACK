// Wave 1·2 검증 — 고교/신규 reach 컷이 실제 페이싱 엔진(getReachForWeek)에서 픽되는지 헤드리스 확인.
// 게임이 매주 호출하는 selection.getReachForWeek를 그대로 태운다(단위테스트 아님 — 실제 루프 함수).
// 각 컷을 fresh 조건(weekStartIntimacy < tier <= intimacy, year===Y, !vacation)으로 만들고 픽 여부 확인.
import { createInitialState } from '../../src/engine/gameEngine';
import { getReachForWeek } from '../../src/engine/events/selection';
import { GAME_EVENTS } from '../../src/engine/events';
import { HIGH_REACH_EVENTS } from '../../src/engine/events/reachHigh';
import { NEW_NPC_REACH_EVENTS } from '../../src/engine/events/reachNew';

// 부모 특성 게이트가 하나도 안 걸리는 중립 상태 — 실제 ParentStrength에 없는 센티널이라 캐스트로 명시.
// (getParentMods는 includes()만 쓰므로 미매칭 값 = 보정 0. 실값을 넣으면 초기 스탯/효율이 바뀜)
const NEUTRAL_PARENTS = ['neutral', 'neutral'] as unknown as [import('../../src/engine/types').ParentStrength, import('../../src/engine/types').ParentStrength];

const cuts = [...HIGH_REACH_EVENTS, ...NEW_NPC_REACH_EVENTS].map((e) => ({
  id: e.id, npc: e.reach!.npc, tier: e.reach!.tier, year: e.reach!.year,
}));

// 선행 조건이 붙은 컷은 픽스처를 그 조건에 맞춘다 — 균일 픽스처(W10 · 이벤트 없음)로는
// 원천적으로 못 뜨는 컷이 생겼기 때문이다. **조건을 느슨하게 하려고 여기를 고치지 말 것**:
// 조건 자체는 src/engine/__tests__/junhaRecipeOrder.test.ts가 양방향으로 잠근다.
const FIXTURE_OVERRIDES: Record<string, { week?: number; priorEvents?: string[] }> = {
  // 꿈 첫 고백은 junha-cook이고 이 컷은 그 4주 뒤 심화다(같은 고백 2회 방지).
  'junha-hs-recipe': { week: 16, priorEvents: ['junha-cook'] },
  // "졸업 무렵 짐 가방"이라 W>=40. 게이트가 없던 동안 Y7 W2에 떴다.
  'junha-hs-farewell': { week: 40 },
};
// 선행 이벤트를 events에 심는다 — 발동 주차는 픽스처 주차보다 4주 이상 앞(간격 조건 충족).
function seedPriorEvent(id: string, year: number, week: number) {
  const def = GAME_EVENTS.find(e => e.id === id);
  if (!def) throw new Error(`FIXTURE_OVERRIDES 전제 붕괴: ${id} 가 GAME_EVENTS에 없다`);
  return { ...def, condition: undefined, year, week, resolvedChoice: 0 };
}

let pass = 0;
const fails: string[] = [];

for (const c of cuts) {
  const s = createInitialState('male', NEUTRAL_PARENTS, { rngSeed: 12345 });
  const override = FIXTURE_OVERRIDES[c.id];
  s.year = c.year;
  s.week = override?.week ?? 10;   // 학기 중(비방학)
  s.isVacation = false;
  for (const id of override?.priorEvents ?? []) {
    s.events.push(seedPriorEvent(id, c.year, s.week - 4));
  }
  // 모든 NPC를 met=false로 깔아 간섭 제거
  for (const n of s.npcs) { n.met = false; }
  const target = s.npcs.find((n) => n.id === c.npc)!;
  target.met = true;
  target.weekStartIntimacy = c.tier - 1;  // 직전 주엔 tier 미만 → 이번 주 fresh 진입
  target.intimacy = c.tier;               // 이번 주 tier 도달
  const picked = getReachForWeek(s);
  if (picked?.id === c.id) pass++;
  else fails.push(`${c.id} (${c.npc} t${c.tier} Y${c.year}) → ${picked?.id ?? 'null'}`);
}

console.log(`\n=== Wave 1·2 reach 발동 검증 ===`);
console.log(`fresh 픽 성공: ${pass}/${cuts.length}`);
if (fails.length) {
  console.log(`\n실패:`);
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
} else {
  console.log(`✓ ${cuts.length}컷 전부 페이싱 엔진에서 정상 픽`);
}
