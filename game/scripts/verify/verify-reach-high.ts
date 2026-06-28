// Wave 1 검증 — 고교 reach 23컷이 실제 페이싱 엔진(getReachForWeek)에서 픽되는지 헤드리스 확인.
// 게임이 매주 호출하는 selection.getReachForWeek를 그대로 태운다(단위테스트 아님 — 실제 루프 함수).
// 각 컷을 fresh 조건(weekStartIntimacy < tier <= intimacy, year===Y, !vacation)으로 만들고 픽 여부 확인.
import { createInitialState } from '../../src/engine/gameEngine';
import { getReachForWeek } from '../../src/engine/events/selection';
import { HIGH_REACH_EVENTS } from '../../src/engine/events/reachHigh';

const cuts = HIGH_REACH_EVENTS.map((e: any) => ({
  id: e.id, npc: e.reach.npc, tier: e.reach.tier, year: e.reach.year,
}));

let pass = 0;
const fails: string[] = [];

for (const c of cuts) {
  const s = createInitialState('male', ['neutral', 'neutral'], { rngSeed: 12345 });
  s.year = c.year;
  s.week = 10;            // 학기 중(비방학)
  s.isVacation = false;
  // 모든 NPC를 met=false로 깔아 간섭 제거
  for (const n of s.npcs) { n.met = false; }
  const target = s.npcs.find((n: any) => n.id === c.npc)!;
  target.met = true;
  target.weekStartIntimacy = c.tier - 1;  // 직전 주엔 tier 미만 → 이번 주 fresh 진입
  target.intimacy = c.tier;               // 이번 주 tier 도달
  const picked = getReachForWeek(s);
  if (picked?.id === c.id) pass++;
  else fails.push(`${c.id} (${c.npc} t${c.tier} Y${c.year}) → ${picked?.id ?? 'null'}`);
}

console.log(`\n=== Wave 1 reach 발동 검증 ===`);
console.log(`fresh 픽 성공: ${pass}/${cuts.length}`);
if (fails.length) {
  console.log(`\n실패:`);
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
} else {
  console.log('✓ 23컷 전부 페이싱 엔진에서 정상 픽');
}
