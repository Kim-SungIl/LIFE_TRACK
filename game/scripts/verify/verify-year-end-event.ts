// P0 #1 학년말 이벤트 증발 + P1 #6 이벤트 기록 week off-by-one + P0 #5 결산 phase 검증
// 실행: cd game && npx tsx scripts/verify/verify-year-end-event.ts
//
// 핵심 시나리오: W48(학년 마감 주)에 이벤트가 발동하면
//   - processWeek가 학년 전환(year-end/ending)을 보류하고 phase='event'를 유지해야 한다
//   - resolveEvent로 이벤트를 끝낸 뒤에야 학년 전환이 일어나야 한다
//   - 이벤트는 발생주(48)로 기록돼야 한다 (49로 어긋나면 off-by-one)
// 결정론적 발동을 위해 RNG 게이트가 없는 HARD 크라이시스 high-panic을 사용한다.
//   (조건: year 5~7 && mental<=55 && academic>=50)

import type { GameState, ParentStrength } from '../../src/engine/types';

// node 환경에는 완전한 localStorage가 없어 store(startGame의 removeItem 등)가 깨진다.
// store 모듈 로드 전에 메모리 기반 폴리필을 깔고, 이후 동적 import로 store를 가져온다.
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { useGameStore } = await import('../../src/engine/store');
const { applyYearTransition } = await import('../../src/engine/gameEngine');
const { HARD_CRISIS_IDS } = await import('../../src/engine/events/constants');

const store = useGameStore;
const PARENTS: [ParentStrength, ParentStrength] = ['wealth', 'emotional'];

// 새 게임을 시작한 뒤 원하는 상황으로 state를 덮어쓴다.
function setupState(overrides: Partial<GameState>): GameState {
  store.getState().startGame('male', PARENTS);
  const base = store.getState().state!;
  const next: GameState = { ...base, ...overrides };
  store.setState({ state: next, npcActivityMap: {} });
  return next;
}

// currentEvent가 사라질 때까지 첫 선택지로 모든 연쇄 이벤트를 해소한다.
function resolveAll(): void {
  let guard = 0;
  while (store.getState().state!.currentEvent && guard++ < 20) {
    store.getState().resolveEvent(0);
  }
}

let passed = 0;
let failed = 0;
function assert(label: string, cond: boolean, extra?: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${extra ? `  → ${extra}` : ''}`);
    failed++;
  }
}

// ===== 1. applyYearTransition 헬퍼 단위 검증 =====
console.log('\n=== 1. applyYearTransition: Y1~6 → year-end, Y7 → ending ===');
{
  const base = setupState({ year: 3, week: 49, phase: 'event' });
  applyYearTransition(base);
  assert('Y3 마감 → phase=year-end', base.phase === 'year-end', `phase=${base.phase}`);
  assert('Y3 마감 → year/week 유지(3/49)', base.year === 3 && base.week === 49, `${base.year}/${base.week}`);

  const base7 = setupState({ year: 7, week: 49, phase: 'event' });
  applyYearTransition(base7);
  assert('Y7 마감 → phase=ending', base7.phase === 'ending', `phase=${base7.phase}`);
  assert('Y7 마감 → year++/week=1 (8/1)', base7.year === 8 && base7.week === 1, `${base7.year}/${base7.week}`);
}

// ===== 2. W48 이벤트 발동 시 processWeek가 학년 전환을 보류 (Y3 → year-end) =====
console.log('\n=== 2. W48 이벤트: 전환 보류 + 발생주 기록 (Y5) ===');
{
  setupState({ year: 5, week: 48, stats: { ...store.getState().state!.stats, mental: 30, academic: 85 }, hardCrisisYears: [] });
  store.getState().advanceWeek();
  const afterAdvance = store.getState().state!;
  assert('W48 이벤트가 보존됨 (currentEvent != null)', afterAdvance.currentEvent !== null, `currentEvent=${afterAdvance.currentEvent?.id ?? 'null'}`);
  assert('phase가 event 유지 (year-end로 덮이지 않음)', afterAdvance.phase === 'event', `phase=${afterAdvance.phase}`);
  assert('week=49 / year=5 (전환 보류)', afterAdvance.week === 49 && afterAdvance.year === 5, `${afterAdvance.year}/${afterAdvance.week}`);
  assert('currentEvent.week가 발생주 48로 스탬프', afterAdvance.currentEvent?.week === 48, `week=${afterAdvance.currentEvent?.week}`);
  assert('발동 이벤트가 HARD 크라이시스', !!afterAdvance.currentEvent && HARD_CRISIS_IDS.has(afterAdvance.currentEvent.id), afterAdvance.currentEvent?.id);

  const firedId = afterAdvance.currentEvent!.id;
  resolveAll();
  const afterResolve = store.getState().state!;
  assert('이벤트 종료 후 phase=year-end (보류했던 전환 수행)', afterResolve.phase === 'year-end', `phase=${afterResolve.phase}`);
  assert('currentEvent 정리됨', afterResolve.currentEvent === null);
  const rec = afterResolve.events.find(e => e.id === firedId);
  assert('events 기록의 week=48 (off-by-one 없음)', rec?.week === 48, `week=${rec?.week}`);
  assert('events 기록의 year=5', rec?.year === 5, `year=${rec?.year}`);
}

// ===== 3. Y7 W48 이벤트 → 엔딩 전환도 보류 후 수행 =====
console.log('\n=== 3. Y7 W48 이벤트: 엔딩 전환 보류 후 수행 ===');
{
  setupState({ year: 7, week: 48, stats: { ...store.getState().state!.stats, mental: 30, academic: 85 }, hardCrisisYears: [] });
  store.getState().advanceWeek();
  const a = store.getState().state!;
  assert('Y7 W48 이벤트 보존 + phase=event', a.currentEvent !== null && a.phase === 'event', `phase=${a.phase}`);
  assert('엔딩 전환 보류 (year=7 유지, ending 아님)', a.year === 7 && a.phase !== 'ending', `${a.year}/${a.phase}`);
  const firedId = a.currentEvent!.id;
  resolveAll();
  const b = store.getState().state!;
  assert('이벤트 종료 후 phase=ending', b.phase === 'ending', `phase=${b.phase}`);
  assert('엔딩 진입 시 year++/week=1 (8/1)', b.year === 8 && b.week === 1, `${b.year}/${b.week}`);
  const rec = b.events.find(e => e.id === firedId);
  assert('events 기록의 week=48', rec?.week === 48, `week=${rec?.week}`);
}

// ===== 4. 일반 주(W20) 이벤트: off-by-one 없음 + 종료 후 phase=result (#5/#6) =====
console.log('\n=== 4. 일반 주 이벤트: 발생주 기록 + phase=result ===');
{
  setupState({ year: 5, week: 20, stats: { ...store.getState().state!.stats, mental: 30, academic: 85 }, hardCrisisYears: [] });
  store.getState().advanceWeek();
  const a = store.getState().state!;
  assert('W20 이벤트 발동 + phase=event', a.currentEvent !== null && a.phase === 'event', `phase=${a.phase}`);
  assert('currentEvent.week=20 (발생주)', a.currentEvent?.week === 20, `week=${a.currentEvent?.week}`);
  const firedId = a.currentEvent!.id;
  resolveAll();
  const b = store.getState().state!;
  assert('이벤트 종료 후 phase=result (일반 주)', b.phase === 'result', `phase=${b.phase}`);
  const rec = b.events.find(e => e.id === firedId);
  assert('events 기록의 week=20 (off-by-one 없음)', rec?.week === 20, `week=${rec?.week}`);
}

// ===== 5. 일반 주 결산 phase: 이벤트 없어도 advanceWeek가 result로 전환 (#5) =====
console.log('\n=== 5. advanceWeek → phase=result (결산 새로고침 유지) ===');
{
  // 이벤트가 떠도 resolveAll로 소진하면 최종 phase는 result여야 한다 (일반 주 한정).
  setupState({ year: 2, week: 10, hardCrisisYears: [] });
  store.getState().advanceWeek();
  resolveAll();
  const b = store.getState().state!;
  assert('일반 주 진행 종료 시 phase=result', b.phase === 'result', `phase=${b.phase}`);
  assert('weekLog 존재 (결산 렌더 가능)', !!b.weekLog);
}

console.log(`\n=== 결과: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
