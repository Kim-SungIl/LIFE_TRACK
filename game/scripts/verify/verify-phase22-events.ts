/**
 * Phase 2.2: Y1 친밀도 도달형 이벤트 12개 검증
 *
 * 검증 항목:
 *  1. 12개 이벤트가 GAME_EVENTS에 모두 존재
 *  2. 각 이벤트가 week 없음 (조건부 풀 진입)
 *  3. 친밀도 도달 시 condition === true
 *  4. 친밀도 미달 시 condition === false
 *  5. NPC 미만남(met=false) 시 condition === false
 *  6. 학년 ≠ 1 시 condition === false
 *  7. doyun-comic-share: 도달형 변환 확인 (week 제거 + intimacy 30)
 *  8. 충돌 검증: subin-divorce / minjae-effort 학년 분리 OK
 *
 * 실행: npx tsx scripts/verify-phase22-events.ts
 */

import { GAME_EVENTS } from '../../src/engine/events';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

// minWeek: 겨울(W41+) 게이트가 걸린 capstone은 해당 주차 이상에서만 발동.
const NEW_EVENT_SPECS: Array<{ id: string; npcId: string; threshold: number; minWeek?: number }> = [
  { id: 'yuna-milk-duty', npcId: 'yuna', threshold: 30 },
  { id: 'yuna-sticker-plan', npcId: 'yuna', threshold: 50 },
  { id: 'yuna-perfect-smile', npcId: 'yuna', threshold: 70 },
  { id: 'yuna-window-promise', npcId: 'yuna', threshold: 90, minWeek: 41 },
  { id: 'subin-reading-marathon', npcId: 'subin', threshold: 30 },
  { id: 'subin-keychain', npcId: 'subin', threshold: 50 },
  { id: 'subin-night-light', npcId: 'subin', threshold: 70 },
  { id: 'subin-paper-airplane', npcId: 'subin', threshold: 90, minWeek: 41 },
  { id: 'doyun-secret-spot', npcId: 'doyun', threshold: 40 },
  { id: 'doyun-window-school', npcId: 'doyun', threshold: 60 },
  { id: 'minjae-crumbled-note', npcId: 'minjae', threshold: 70 },
];

const RETOOLED_DOYUN_COMIC: { id: string; npcId: string; threshold: number; minWeek?: number } = { id: 'doyun-comic-share', npcId: 'doyun', threshold: 30 };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function makeState(npcId: string, intimacy: number, met: boolean, year: number = 1, week: number = 20): GameState {
  const s = createInitialState('male', ['emotional', 'wealth']);
  s.year = year;
  s.week = week;
  const npc = s.npcs.find(n => n.id === npcId);
  if (npc) {
    npc.met = met;
    npc.intimacy = intimacy;
  }
  return s;
}

console.log('=== Phase 2.2 이벤트 검증 ===\n');

console.log('[1] 12개 이벤트가 GAME_EVENTS에 존재');
for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  check(`  ${spec.id} 존재`, !!ev);
}

console.log('\n[2] 모든 도달형 이벤트가 week 없음 (조건부 풀)');
for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  if (!ev) continue;
  check(`  ${spec.id} week 없음`, ev.week === undefined);
}

console.log('\n[3] 친밀도 도달 시 condition === true');
for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  if (!ev || !ev.condition) continue;
  const minWeek = spec.minWeek;
  const s = makeState(spec.npcId, spec.threshold, true, 1, minWeek ?? 20);
  const result = ev.condition(s);
  check(`  ${spec.id} (intimacy=${spec.threshold}${minWeek ? `, week=${minWeek}` : ''}) fires`, result === true);
}

console.log('\n[4] 친밀도 미달 시 condition === false');
for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  if (!ev || !ev.condition) continue;
  const s = makeState(spec.npcId, spec.threshold - 1, true);
  const result = ev.condition(s);
  check(`  ${spec.id} (intimacy=${spec.threshold - 1}) does NOT fire`, result === false);
}

console.log('\n[5] NPC 미만남(met=false) 시 condition === false');
for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  if (!ev || !ev.condition) continue;
  const s = makeState(spec.npcId, spec.threshold + 10, false);
  const result = ev.condition(s);
  check(`  ${spec.id} (met=false) does NOT fire`, result === false);
}

console.log('\n[6] 학년 ≠ 1 시 condition === false (Y1 한정)');
for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  if (!ev || !ev.condition) continue;
  const s = makeState(spec.npcId, spec.threshold + 10, true, 2);
  const result = ev.condition(s);
  check(`  ${spec.id} (Y2) does NOT fire`, result === false);
}

console.log('\n[7] doyun-comic-share 도달형 변환 확인');
{
  const ev = GAME_EVENTS.find(e => e.id === 'doyun-comic-share');
  check('  week 제거됨', ev?.week === undefined);
  if (ev?.condition) {
    const sLow = makeState('doyun', 29, true);
    const sHi = makeState('doyun', 30, true);
    check('  intimacy 29 미만에서 false', ev.condition(sLow) === false);
    check('  intimacy 30 도달에서 true', ev.condition(sHi) === true);
  }
}

console.log('\n[8] 충돌 검증 (학년 분리)');
{
  const subinDivorce = GAME_EVENTS.find(e => e.id === 'subin-divorce');
  const minjaeEffort = GAME_EVENTS.find(e => e.id === 'minjae-effort');
  // 새 이벤트는 Y1, 기존은 Y2+
  if (subinDivorce?.condition) {
    const s = makeState('subin', 100, true, 1);
    check('  subin-divorce Y1에서 발동 안 함 (Y2+ 한정)', subinDivorce.condition(s) === false);
  }
  if (minjaeEffort?.condition) {
    const s = makeState('minjae', 100, true, 1);
    check('  minjae-effort Y1에서 발동 안 함 (Y2+ 한정)', minjaeEffort.condition(s) === false);
  }
}

console.log('\n[9] conditionalEvents 풀 진입 확인');
{
  // !e.week 이벤트는 conditional 풀에서 매주 50% 확률로 픽됨
  for (const spec of [...NEW_EVENT_SPECS, RETOOLED_DOYUN_COMIC]) {
    const ev = GAME_EVENTS.find(e => e.id === spec.id);
    if (!ev) continue;
    check(`  ${spec.id} conditional 풀 (week 없음 + condition 있음)`,
      ev.week === undefined && typeof ev.condition === 'function');
  }
}

console.log('\n[10] winter capstone week-gate (W41+ 전엔 발동 안 함)');
for (const spec of NEW_EVENT_SPECS) {
  if (!('minWeek' in spec) || !spec.minWeek) continue;
  const ev = GAME_EVENTS.find(e => e.id === spec.id);
  if (!ev || !ev.condition) continue;
  // 친밀도는 충족하지만 주차가 게이트 직전(minWeek-1)이면 false여야 함
  const sBefore = makeState(spec.npcId, spec.threshold, true, 1, spec.minWeek - 1);
  check(`  ${spec.id} (intimacy=${spec.threshold}, week=${spec.minWeek - 1}) does NOT fire`,
    ev.condition(sBefore) === false);
  // 봄(W6)에서도 발동 안 함 — 원래 desync 케이스
  const sSpring = makeState(spec.npcId, spec.threshold, true, 1, 6);
  check(`  ${spec.id} (intimacy=${spec.threshold}, 봄 week=6) does NOT fire`,
    ev.condition(sSpring) === false);
}

console.log('\n=========================');
console.log(`결과: ${passed} passed / ${failed} failed`);
if (failed > 0) {
  console.log('\n실패한 항목:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('✅ Phase 2.2 검증 완료');
