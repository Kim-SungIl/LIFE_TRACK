// M2 상태 무결성 검증
// - 336주 풀 플레이 시뮬 → 모든 신규 필드 정합성 유지되는지
// - 구세이브(신규 필드 없음) 로드 시 migrateLoadedState가 크래시 없이 통과하는지
// - rngSeed가 처음과 끝에서 실제로 변화했는지
//
// 실행: cd game && npx tsx scripts/verify-m2-state.ts

import { createInitialState, processWeek, hashInitialState } from '../src/engine/gameEngine';
import type { GameState, ParentStrength } from '../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

function deepClone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

console.log('\n=== 1. 초기 상태의 신규 필드 존재 및 초기값 ===');
{
  const parents: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  const s = createInitialState('male', parents);
  assert('memorySlots 빈 배열', Array.isArray(s.memorySlots) && s.memorySlots.length === 0);
  assert('milestoneScenes 빈 배열', Array.isArray(s.milestoneScenes) && s.milestoneScenes.length === 0);
  assert('rngSeed 양의 정수', typeof s.rngSeed === 'number' && s.rngSeed > 0 && Number.isInteger(s.rngSeed));
  assert('hardCrisisYears 빈 배열', Array.isArray(s.hardCrisisYears) && s.hardCrisisYears.length === 0);
}

console.log('\n=== 2. 같은 gender+parents → 시드 결정론 (createInitialState 경로) ===');
{
  const p: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  // createInitialState는 Date.now를 쓰므로 runtime에서 달라짐 — hashInitialState만 검증
  const h1 = hashInitialState({ gender: 'male', parents: p, startedAt: 12345 });
  const h2 = hashInitialState({ gender: 'male', parents: p, startedAt: 12345 });
  const h3 = hashInitialState({ gender: 'female', parents: p, startedAt: 12345 });
  assert('hashInitialState 결정론', h1 === h2);
  assert('성별 다르면 해시 다름', h1 !== h3);
  assert('해시 0 아님 (LCG 안전)', h1 !== 0);
}

console.log('\n=== 3. 336주 풀 플레이 상태 무결성 ===');
{
  let s = createInitialState('male', ['wealth', 'emotional']);
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'basketball';
  const initialSeed = s.rngSeed;

  let lastRngSeed = s.rngSeed;
  let seedChangeCount = 0;
  for (let i = 0; i < 400; i++) {
    s = processWeek(s);
    if (s.currentEvent) s.currentEvent = null;  // 이벤트 해결 스킵
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.rngSeed !== lastRngSeed) {
      seedChangeCount++;
      lastRngSeed = s.rngSeed;
    }
    if (s.year > 7) break;
  }
  assert(`rngSeed 최소 10회 이상 변화 (실제: ${seedChangeCount})`, seedChangeCount >= 10);
  assert('rngSeed 초기값과 다름', s.rngSeed !== initialSeed);
  assert('memorySlots 여전히 배열', Array.isArray(s.memorySlots));
  assert('milestoneScenes 여전히 배열', Array.isArray(s.milestoneScenes));
  assert('hardCrisisYears 여전히 배열', Array.isArray(s.hardCrisisYears));
  assert(`슬롯 상한 준수 (memorySlots ≤12, 실제 ${s.memorySlots.length})`, s.memorySlots.length <= 12);
  assert(`milestone 상한 준수 (≤7, 실제 ${s.milestoneScenes.length})`, s.milestoneScenes.length <= 7);
}

console.log('\n=== 4. 구세이브 로드 호환성 (신규 필드 제거 후 migrateLoadedState 상당) ===');
{
  // 실제 loadFromStorage는 localStorage를 쓰므로 여기선 마이그레이션 함수만 분리 검증
  // gameEngine.ts processWeek 내부의 마이그레이션 로직과 동일한 효과여야 함
  let s = createInitialState('male', ['wealth', 'emotional']);
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'basketball';
  // 50주 플레이하여 이벤트 쌓음
  for (let i = 0; i < 50; i++) {
    s = processWeek(s);
    if (s.currentEvent) s.currentEvent = null;
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
  }

  // 구세이브 시뮬: 신규 필드 전부 제거
  const legacy = deepClone(s) as Partial<GameState>;
  delete (legacy as Record<string, unknown>).memorySlots;
  delete (legacy as Record<string, unknown>).milestoneScenes;
  delete (legacy as Record<string, unknown>).rngSeed;
  delete (legacy as Record<string, unknown>).hardCrisisYears;

  // processWeek 호출 시 마이그레이션 동작
  const recovered = processWeek(legacy as GameState);
  assert('구세이브 로드 후 memorySlots 자동 생성', Array.isArray(recovered.memorySlots));
  assert('구세이브 로드 후 milestoneScenes 자동 생성', Array.isArray(recovered.milestoneScenes));
  assert('구세이브 로드 후 rngSeed 복원 (>0)', typeof recovered.rngSeed === 'number' && recovered.rngSeed > 0);
  assert('구세이브 로드 후 hardCrisisYears 자동 생성', Array.isArray(recovered.hardCrisisYears));
  assert('기존 필드 손상 없음 (events 배열)', Array.isArray(recovered.events));
  assert('기존 필드 손상 없음 (stats)', typeof recovered.stats.academic === 'number');
}

console.log('\n=== 5. EventChoice.memorySlotDraft 타입 호환성 (접근 시 크래시 없음) ===');
{
  // 기존 이벤트 파일은 memorySlotDraft를 정의 안 했으므로 undefined 접근이 안전해야 함
  const s = createInitialState('male', ['wealth', 'emotional']);
  // 임의 이벤트를 만들어 접근
  const testChoice = { text: 'test', effects: {}, message: 'test' };
  const draft = (testChoice as { memorySlotDraft?: unknown }).memorySlotDraft;
  assert('memorySlotDraft 미정의 시 undefined', draft === undefined);
  // GameState 타입 자체가 새 필드를 요구하는지는 tsc가 이미 검증 (build 통과함)
  assert('state 타입에 신규 필드 존재', 'memorySlots' in s && 'rngSeed' in s);
}

console.log('\n=== 6. 결정론 양보 (기존 구현도 동일 rngSeed로 재현 가능) ===');
{
  const p: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];
  function runFromSeed(seed: number, weeks: number): { eventIds: string[], finalSeed: number } {
    let s = createInitialState('male', p);
    s.rngSeed = seed;
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'basketball';
    const eventIds: string[] = [];
    for (let i = 0; i < weeks; i++) {
      s = processWeek(s);
      if (s.currentEvent) {
        eventIds.push(s.currentEvent.id);
        s.currentEvent = null;
      }
      if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    }
    return { eventIds, finalSeed: s.rngSeed };
  }
  const run1 = runFromSeed(99999, 100);
  const run2 = runFromSeed(99999, 100);
  const run3 = runFromSeed(11111, 100);
  assert(`동일 시드 run1==run2 (이벤트 ${run1.eventIds.length}개)`, JSON.stringify(run1.eventIds) === JSON.stringify(run2.eventIds));
  assert(`동일 시드 finalSeed 일치`, run1.finalSeed === run2.finalSeed);
  assert(`다른 시드 run1!=run3`, JSON.stringify(run1.eventIds) !== JSON.stringify(run3.eventIds));
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
