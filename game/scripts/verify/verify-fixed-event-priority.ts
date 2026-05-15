// P0-A 검증: 같은 주에 학교일정 + NPC 이벤트가 같이 매칭될 때
// NPC 이벤트(speakers 보유)가 우선 선택되는지 확인.
// 실행: cd game && npx tsx scripts/verify-fixed-event-priority.ts

import { GAME_EVENTS, getEventForWeek } from '../../src/engine/events';
import { createInitialState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}

function setupAt(week: number, year: number, opts?: Partial<GameState>): GameState {
  const s = createInitialState('male', ['wealth', 'emotional']);
  s.week = week;
  s.year = year;
  if (opts) Object.assign(s, opts);
  return s;
}

function meetNpc(state: GameState, npcId: string, intimacy: number) {
  const npc = state.npcs.find(n => n.id === npcId);
  if (!npc) throw new Error(`NPC ${npcId} not found`);
  npc.met = true;
  npc.intimacy = intimacy;
}

console.log('=== 1. W37 시험 알림 / W38 yuna-birthday — 충돌 회피 검증 ===');
// 설계 변경: yuna-birthday를 W37→W38로 이동하여 시험 알림과 충돌 제거.
// W37은 단원평가(Y1)/기말(Y2+) 알림 전용, W38은 yuna 생일 전용.
{
  // Y1 W37: yuna 친밀도와 무관하게 elementary-unit-test-2 발동
  const s = setupAt(37, 1);
  meetNpc(s, 'yuna', 50);
  const ev = getEventForWeek(s);
  assert(ev?.id === 'elementary-unit-test-2', `Y1 W37 → elementary-unit-test-2 (실제: ${ev?.id})`);
}
{
  // Y2 W37: yuna 친밀도와 무관하게 final-exam-2 발동
  const s = setupAt(37, 2);
  meetNpc(s, 'yuna', 50);
  const ev = getEventForWeek(s);
  assert(ev?.id === 'final-exam-2', `Y2 W37 → final-exam-2 (실제: ${ev?.id})`);
}
{
  // Y1 W38: yuna-birthday 발동 (Y1 조건: yuna.met)
  const s = setupAt(38, 1);
  meetNpc(s, 'yuna', 10);
  const ev = getEventForWeek(s);
  assert(ev?.id === 'yuna-birthday', `Y1 W38 yuna.met → yuna-birthday (실제: ${ev?.id})`);
}
{
  // Y2 W38: 친밀도 30 이상 → yuna-birthday
  const s = setupAt(38, 2);
  meetNpc(s, 'yuna', 30);
  const ev = getEventForWeek(s);
  assert(ev?.id === 'yuna-birthday', `Y2 W38 yuna 친밀도 30 → yuna-birthday (실제: ${ev?.id})`);
}
{
  // Y2 W38: 친밀도 부족 → yuna-birthday 발동 안 됨 (확률 NPC 이벤트로 폴백 가능)
  const s = setupAt(38, 2);
  meetNpc(s, 'yuna', 20);
  const ev = getEventForWeek(s);
  assert(ev?.id !== 'yuna-birthday', `Y2 W38 yuna 친밀도 20 → not yuna-birthday (실제: ${ev?.id})`);
}

console.log('\n=== 1-bis. final-exam-2 매년 발동 (ANNUAL_EVENT_IDS) ===');
{
  // Y3 W37: 이전에 final-exam-2가 발동된 적 있어도 ANNUAL이라 다시 발동
  const s = setupAt(37, 3);
  s.events.push({ id: 'final-exam-2', year: 2, week: 37, choiceIndex: 0 });
  const ev = getEventForWeek(s);
  assert(ev?.id === 'final-exam-2', `Y3 W37 (Y2에 발동 이력 있음) → final-exam-2 (실제: ${ev?.id})`);
}

console.log('\n=== 2. W20 junha-birthday: summer-start보다 우선 ===');
{
  // Y6 W20: summer-start (no condition) vs junha-birthday (year>=6, intimacy>=10)
  const s = setupAt(20, 6);
  meetNpc(s, 'junha', 30);
  const ev = getEventForWeek(s);
  assert(ev?.id === 'junha-birthday', `Y6 W20 junha 친밀도 30 → junha-birthday (실제: ${ev?.id})`);
}
{
  // junha 못 만남 → summer-start fallback
  const s = setupAt(20, 6);
  // junha.met=false (default)
  const ev = getEventForWeek(s);
  assert(ev?.id === 'summer-start', `Y6 W20 junha 미만남 → summer-start (실제: ${ev?.id})`);
}

console.log('\n=== 3. NPC 이벤트가 없는 주는 기존대로 ===');
{
  // W7 minjae-birthday Y1: minjae 만나야 함, first-midterm은 year>=2라 Y1엔 후보 아님
  const s = setupAt(7, 1);
  meetNpc(s, 'minjae', 30);
  const ev = getEventForWeek(s);
  assert(ev?.id === 'minjae-birthday', `Y1 W7 minjae 친밀도 30 → minjae-birthday (실제: ${ev?.id})`);
}

console.log('\n=== 4. NPC 이벤트끼리 충돌 시 array 순서 유지 ===');
{
  // 같은 주에 NPC 이벤트가 겹치는 경우는 현재 데이터에 없지만,
  // 만약 있다면 GAME_EVENTS 배열에서 먼저 나오는 게 우선되어야 함 (find 의 안정성).
  // 직접 검증은 어려워서 skip — 코드 리뷰로 보장.
  console.log('  (현재 데이터에 NPC 이벤트끼리 같은 주 충돌 없음 — skip)');
}

console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
