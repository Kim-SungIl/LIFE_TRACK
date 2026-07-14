// 저장/로드 마이그레이션 회귀 검증 — migrateLoadedState (stateMigration.ts)
// 코드리뷰 6/9에서 수정된 P0 3건(SCHOOL_LIFE 재수화 · currentEvent.week 보존 · phase fallback)과
// 구세이브 호환(필드 백필 · gene→resilience · do-nothing 필터 · routineWeeks 복제 · rngSeed)을
// 회귀 방지로 고정한다. F5 roundtrip = JSON 직렬화(함수 필드 손실)된 state를 다시 로드하는 경로.
//
// 실행: cd game && npx tsx scripts/verify/verify-save-load.ts

import { migrateLoadedState } from '../../src/engine/stateMigration';
import { createInitialState } from '../../src/engine/gameEngine';
import { GAME_EVENTS } from '../../src/engine/events';
import { SCHOOL_LIFE_EVENTS } from '../../src/engine/events/school-life';
import type { GameState, ParentStrength } from '../../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

// F5 roundtrip 시뮬: localStorage에 들어갔다 나온 것처럼 JSON 직렬화/역직렬화(함수 필드 손실)
function roundtrip(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

const PARENTS: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];

console.log('\n=== 1. P0: SCHOOL_LIFE 전용 이벤트 도중 새로고침 — currentEvent 재수화 (soft-lock 차단) ===');
{
  const slEvent = SCHOOL_LIFE_EVENTS[0]; // 'random-quiz' — GAME_EVENTS 풀에 없음
  assert('전제: SCHOOL_LIFE[0]가 GAME_EVENTS에 없음', !GAME_EVENTS.some(e => e.id === slEvent.id), slEvent.id);
  const s = createInitialState('male', PARENTS);
  s.phase = 'event';
  s.currentEvent = { ...slEvent, week: 7 };
  const loaded = migrateLoadedState(roundtrip(s));
  assert('currentEvent 유실 안 됨(null 아님)', loaded.currentEvent !== null, String(loaded.currentEvent));
  assert('currentEvent.id 보존', loaded.currentEvent?.id === slEvent.id);
  assert('phase=event 유지(soft-lock 아님)', loaded.phase === 'event');
  assert('choices 복원(함수 필드 포함 원본 재참조)', (loaded.currentEvent?.choices?.length ?? 0) > 0);
}

console.log('\n=== 2. P0: currentEvent.week 보존 (발생주 off-by-one 차단) ===');
{
  const ev = GAME_EVENTS.find(e => e.id === 'first-week')!;
  const s = createInitialState('female', PARENTS);
  s.phase = 'event';
  s.week = 10;                                   // week++ 이후 값(엔진)
  s.currentEvent = { ...ev, week: 9 };           // 실제 발생주
  const loaded = migrateLoadedState(roundtrip(s));
  assert('currentEvent.week = 발생주(9), result.week(10) 아님', loaded.currentEvent?.week === 9,
    `got ${loaded.currentEvent?.week}`);
  assert('condition 함수 복원(직렬화로 손실됐던 것)', typeof (loaded.currentEvent as { condition?: unknown })?.condition === 'function');
}

console.log('\n=== 3. P0: 카탈로그에서 사라진 currentEvent → null + phase fallback (soft-lock 차단) ===');
{
  // weekLog 있음 → result 로
  const s1 = createInitialState('male', PARENTS);
  s1.phase = 'event';
  s1.currentEvent = { id: 'deleted-event-xyz', title: 'gone', description: '', choices: [] } as unknown as GameState['currentEvent'];
  s1.weekLog = { week: 5, year: 1, statChanges: {}, messages: [], fatigueChange: 0 } as unknown as GameState['weekLog'];
  const l1 = migrateLoadedState(roundtrip(s1));
  assert('미존재 currentEvent → null', l1.currentEvent === null);
  assert('weekLog 있으면 phase=result', l1.phase === 'result', l1.phase);

  // weekLog 없음 → weekday 로
  const s2 = createInitialState('male', PARENTS);
  s2.phase = 'event';
  s2.currentEvent = { id: 'deleted-event-xyz', title: 'gone', description: '', choices: [] } as unknown as GameState['currentEvent'];
  s2.weekLog = null;
  const l2 = migrateLoadedState(roundtrip(s2));
  assert('weekLog 없으면 phase=weekday', l2.phase === 'weekday', l2.phase);
}

console.log('\n=== 4. 구세이브 호환: 누락 필드 백필 (크래시 없이 기본값) ===');
{
  const s = createInitialState('female', PARENTS);
  const raw = roundtrip(s) as unknown as Record<string, unknown>;
  // 신규 필드들을 통째로 제거 → 구세이브 시뮬
  for (const k of ['totalTiredWeeks', 'consecutiveTiredWeeks', 'burnoutCooldown', 'examResults',
    'activeBuffs', 'memorySlots', 'milestoneScenes', 'parentIntimacy', 'parentEventsFired',
    'parentClimaxFired', 'parentPositiveTags', 'talkEventsFired']) {
    delete raw[k];
  }
  const loaded = migrateLoadedState(raw as unknown as GameState);
  assert('totalTiredWeeks 백필 = 0', loaded.totalTiredWeeks === 0);
  assert('consecutiveTiredWeeks 백필 = 0', loaded.consecutiveTiredWeeks === 0);
  assert('examResults 백필 = []', Array.isArray(loaded.examResults) && loaded.examResults.length === 0);
  assert('memorySlots 백필 = []', Array.isArray(loaded.memorySlots));
  assert('parentIntimacy 백필 = 50', loaded.parentIntimacy === 50);
  assert('parentPositiveTags 백필 = {}', !!loaded.parentPositiveTags && typeof loaded.parentPositiveTags === 'object');
  // 관계 신호: lastInteractionWeek는 undefined→현재 절대주차로 시딩(구세이브 대량 '뜸하다' 오탐 방지)
  const nowAbs = (loaded.year - 1) * 48 + loaded.week;
  assert('npc.lastInteractionWeek 시딩 = 현재 주차', loaded.npcs.every(n => n.lastInteractionWeek === nowAbs),
    `nowAbs=${nowAbs}, got=${loaded.npcs.map(n => n.lastInteractionWeek).join(',')}`);
}

console.log('\n=== 5. 리네임/제거 마이그레이션: gene→resilience, do-nothing 필터 ===');
{
  const s = createInitialState('male', PARENTS);
  const raw = roundtrip(s) as unknown as Record<string, unknown>;
  raw.parents = ['gene', 'emotional'];                       // 구 명칭
  raw.vacationChoices = ['do-nothing', 'self-study', 'rest']; // 제거 대상 포함
  const loaded = migrateLoadedState(raw as unknown as GameState);
  assert('gene → resilience 리네임', loaded.parents[0] === 'resilience', loaded.parents.join(','));
  assert('emotional 유지', loaded.parents[1] === 'emotional');
  assert('do-nothing 필터 제거', !loaded.vacationChoices.includes('do-nothing'));
  assert('나머지 vacationChoices 보존', loaded.vacationChoices.includes('self-study') && loaded.vacationChoices.includes('rest'));
}

console.log('\n=== 6. 슬롯 카운터 호환: 구 routineWeeks 단일값 → 양 슬롯 복제 ===');
{
  const s = createInitialState('female', PARENTS);
  const raw = roundtrip(s) as unknown as Record<string, unknown>;
  delete raw.routineSlot2Weeks;
  delete raw.routineSlot3Weeks;
  raw.routineWeeks = 4;                                       // 구세이브 단일 카운터
  const loaded = migrateLoadedState(raw as unknown as GameState);
  assert('routineSlot2Weeks ← routineWeeks(4)', loaded.routineSlot2Weeks === 4, String(loaded.routineSlot2Weeks));
  assert('routineSlot3Weeks ← routineWeeks(4)', loaded.routineSlot3Weeks === 4, String(loaded.routineSlot3Weeks));
}

console.log('\n=== 7. rngSeed: 0/누락이면 재생성, 유효하면 보존 ===');
{
  const s = createInitialState('male', PARENTS);
  const raw0 = roundtrip(s) as unknown as Record<string, unknown>;
  raw0.rngSeed = 0;
  const l0 = migrateLoadedState(raw0 as unknown as GameState);
  assert('rngSeed 0 → 재생성(양수)', typeof l0.rngSeed === 'number' && l0.rngSeed > 0, String(l0.rngSeed));

  const rawKeep = roundtrip(s) as unknown as Record<string, unknown>;
  rawKeep.rngSeed = 123456;
  const lKeep = migrateLoadedState(rawKeep as unknown as GameState);
  assert('유효 rngSeed 보존', lKeep.rngSeed === 123456, String(lKeep.rngSeed));
}

console.log('\n=== 8. currentEvent 없는 일반 세이브는 무손상 통과 ===');
{
  const s = createInitialState('female', PARENTS);
  s.phase = 'weekday';
  s.currentEvent = null;
  const loaded = migrateLoadedState(roundtrip(s));
  assert('currentEvent null 유지', loaded.currentEvent === null);
  assert('phase weekday 유지', loaded.phase === 'weekday');
  assert('크래시 없이 통과', typeof loaded === 'object');
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
