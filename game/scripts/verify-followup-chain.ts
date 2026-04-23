// Followup 이벤트 체이닝 리그레션
// 목적: FOLLOWUP_EVENT_IDS에 등록된 이벤트들이
//  (1) 모두 condition-gated 이고 (gate 없으면 매주 강제 발동됨)
//  (2) 같은 장소 followup은 필터링되고
//  (3) 이미 발동한 followup은 재발동되지 않으며
//  (4) 조건 통과 시 getFollowupForWeek가 해당 이벤트를 반환하는지
// 를 정적 + 동적 시뮬로 확인한다.
//
// 실행: cd game && npx tsx scripts/verify-followup-chain.ts

// Node 환경용 localStorage 폴리필 (store.ts가 세이브 용도로 참조)
// Node 25는 부분 구현된 localStorage 객체를 제공하지만 removeItem 등이 없어 항상 덮어씀
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

import { createInitialState } from '../src/engine/gameEngine';
import { GAME_EVENTS, FOLLOWUP_EVENT_IDS, getFollowupForWeek } from '../src/engine/events';
import type { GameState, ParentStrength } from '../src/engine/types';

function mkState(patch: Partial<GameState> = {}): GameState {
  const parents: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  const s = createInitialState('male', parents);
  return { ...s, ...patch };
}

function setNpc(state: GameState, id: string, p: { met?: boolean; intimacy?: number }): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const npc = s.npcs.find(n => n.id === id);
  if (npc) {
    if (p.met !== undefined) npc.met = p.met;
    if (p.intimacy !== undefined) npc.intimacy = p.intimacy;
  }
  return s;
}

let passed = 0;
let failed = 0;
const failures: string[] = [];
function assert(label: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}`); failed++; failures.push(label); }
}

// ========================================
// 1. 정적 — 등록된 모든 followup 이벤트가 실제로 존재하고 condition을 가짐
// ========================================
console.log('\n=== 1. 정적 검증 ===');
{
  const allIds = Array.from(FOLLOWUP_EVENT_IDS);
  const eventIndex = new Map(GAME_EVENTS.map(e => [e.id, e]));

  let missingCount = 0;
  let noConditionCount = 0;
  const missing: string[] = [];
  const noCondition: string[] = [];

  for (const id of allIds) {
    const ev = eventIndex.get(id);
    if (!ev) { missingCount++; missing.push(id); continue; }
    if (!ev.condition) { noConditionCount++; noCondition.push(id); }
  }

  assert(`FOLLOWUP_EVENT_IDS에 등록된 모든 ID가 GAME_EVENTS에 존재 (missing=${missingCount})`, missingCount === 0);
  if (missing.length) console.log(`      누락: ${missing.join(', ')}`);
  assert(`모든 followup 이벤트가 condition 함수를 가짐 (no-condition=${noConditionCount})`, noConditionCount === 0);
  if (noCondition.length) console.log(`      조건 없음: ${noCondition.join(', ')}`);
  assert(`followup 이벤트 수 ≥ 30 (현재 ${allIds.length})`, allIds.length >= 30);
}

// ========================================
// 2. 동적 — 각 followup이 조건을 통과시키면 getFollowupForWeek가 반환
// ========================================
console.log('\n=== 2. 동적 — 대표 followup 선택 케이스 ===');
{
  // 케이스 A: haeun-meet — Y2 중1, 학업 40+
  let s = mkState({ year: 2, week: 10, stats: { academic: 45, social: 30, talent: 20, mental: 60, health: 60 } });
  const fu = getFollowupForWeek(s);
  assert('haeun-meet: Y2 + academic≥40에서 followup으로 선별됨', fu?.id === 'haeun-meet');

  // 케이스 B: junha-transfer — Y6, junha 미만남, 학기 중
  s = mkState({ year: 6, week: 5, isVacation: false });
  s = setNpc(s, 'junha', { met: false });
  const fu2 = getFollowupForWeek(s);
  assert('junha-transfer: Y6 + junha 미만남 + 학기 중에서 선별됨', fu2?.id === 'junha-transfer');

  // 케이스 C: 이미 해결된 followup은 재발동 안 됨
  const sResolved = JSON.parse(JSON.stringify(s)) as GameState;
  sResolved.events.push({ id: 'junha-transfer', title: '', description: '', choices: [], resolvedChoice: 0, week: 5, year: 6 });
  const fu3 = getFollowupForWeek(sResolved);
  assert('junha-transfer: 이미 events에 있으면 재선별되지 않음', fu3?.id !== 'junha-transfer');
}

// ========================================
// 3. 같은 장소 제외 필터
// ========================================
console.log('\n=== 3. excludeLocation 필터 ===');
{
  // Y6 개학, junha 미만남 → junha-transfer는 classroom에서 발생
  let s = mkState({ year: 6, week: 5, isVacation: false });
  s = setNpc(s, 'junha', { met: false });

  const fuNoExclude = getFollowupForWeek(s);
  assert('excludeLocation 없이 junha-transfer 선별', fuNoExclude?.id === 'junha-transfer');

  const fuExcludeClassroom = getFollowupForWeek(s, 'classroom');
  assert('excludeLocation=classroom 시 junha-transfer 제외됨', fuExcludeClassroom?.id !== 'junha-transfer');
}

// ========================================
// 4. 체이닝 — 첫 followup 해결 후 state.events에 추가되면 같은 followup 재선별 안 됨
// ========================================
console.log('\n=== 4. 체이닝 무한 루프 방지 ===');
{
  let s = mkState({ year: 2, week: 10, stats: { academic: 45, social: 30, talent: 20, mental: 60, health: 60 } });
  const first = getFollowupForWeek(s);
  if (first) {
    s.events.push({ ...first, resolvedChoice: 0, week: s.week, year: s.year });
  }
  const second = getFollowupForWeek(s);
  assert('첫 followup 해결 기록 후 같은 ID 재선별 안 됨', second?.id !== first?.id);
}

// ========================================
// 5. eventResultData 계약 — resolveEvent 후 state 전이 확인
//    (GameScreen UX 버그 리그레션: followup 이어질 때도 결과화면 경유해야 함)
// ========================================
console.log('\n=== 5. resolveEvent 상태 전이 계약 ===');
{
  // zustand 스토어를 통해 테스트 — 이벤트 해결 후 followup이 currentEvent로 세팅되면
  // GameScreen의 `!eventResultData` 가드가 결과화면을 먼저 노출하는 전제를 만족
  // (결과화면 렌더 자체는 React 런타임 이슈라 여기서는 phase+currentEvent 전이만 확인)
  const { useGameStore } = await import('../src/engine/store');
  const store = useGameStore.getState();
  store.resetGame();
  store.startGame('male', ['wealth', 'emotional']);

  // Y2 W10, 학업 45 세팅 후 수동으로 이벤트 트리거
  const current = useGameStore.getState();
  const s0: GameState = JSON.parse(JSON.stringify(current.state));
  s0.year = 2;
  s0.week = 10;
  s0.stats.academic = 45;
  s0.phase = 'event';
  // haeun-meet을 currentEvent로 세팅
  const haeunMeet = GAME_EVENTS.find(e => e.id === 'haeun-meet')!;
  s0.currentEvent = { ...haeunMeet, year: 2, week: 10 };
  useGameStore.setState({ state: s0 });

  // 선택지 0 해결
  useGameStore.getState().resolveEvent(0);

  const afterState = useGameStore.getState().state!;
  assert('resolveEvent 후 events에 haeun-meet 기록됨', afterState.events.some(e => e.id === 'haeun-meet'));
  // haeun-meet이 completed되면 haeun-advice 등 추가 followup이 조건 충족하면 이어짐
  // 여기서는 "followup이 이어지든(event) 아니든(weekday) 둘 중 하나"만 확인
  const validPhase = afterState.phase === 'event' || afterState.phase === 'weekday';
  assert(`resolveEvent 후 phase 정상 전이 (현재: ${afterState.phase})`, validPhase);
  if (afterState.phase === 'event') {
    assert('followup 연쇄 시 currentEvent가 null이 아님', afterState.currentEvent !== null);
    assert('followup의 id가 직전 이벤트와 다름', afterState.currentEvent?.id !== 'haeun-meet');
  } else {
    assert('followup 없으면 currentEvent가 null', afterState.currentEvent === null);
  }

  store.resetGame();
}

// ========================================
// 결과
// ========================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
if (failed > 0) {
  console.log('실패:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
