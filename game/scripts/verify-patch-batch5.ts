// 묶음 5 패치 검증 — followup 가드 + currentEvent 직렬화 위생
//
// P18. store.ts resolveEvent — 같은 주에 followup이 이미 발동했으면 추가 followup 안 띄움
// P19. store.ts resolveEvent — events.push 시 condition 함수 제거 (직렬화 안전)
// P20. (회귀) Y1 W26 subin-bridge / W25 minjae-sports followup은 여전히 도달 가능
//
// 실행: cd game && npx tsx scripts/verify-patch-batch5.ts

// localStorage 폴리필
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

import { readFileSync } from 'fs';
import { createInitialState, processWeek } from '../src/engine/gameEngine';
import { FOLLOWUP_EVENT_IDS, GAME_EVENTS, getFollowupForWeek } from '../src/engine/events';
import type { GameEvent, GameState } from '../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

// ============================================================================
console.log('\n=== P18. store.ts followup same-week 1회 가드 ===');
// ============================================================================
{
  const src = readFileSync('./src/engine/store.ts', 'utf8');
  assert('store.ts가 FOLLOWUP_EVENT_IDS를 import',
    /from\s+['"]\.\/events['"][^;]*FOLLOWUP_EVENT_IDS/.test(src) ||
    /FOLLOWUP_EVENT_IDS[^;]*from\s+['"]\.\/events['"]/.test(src));
  assert('store.ts에 followupFiredThisWeek 가드 변수',
    /followupFiredThisWeek/.test(src));
  assert('store.ts 가드가 같은 week+year+FOLLOWUP_EVENT_IDS 검사',
    /prev\.week\s*===\s*newState\.week/.test(src) &&
    /prev\.year\s*===\s*newState\.year/.test(src) &&
    /FOLLOWUP_EVENT_IDS\.has\(prev\.id\)/.test(src));

  // 런타임 가드 시뮬 — store.ts와 동일한 가드 로직을 직접 검증
  // (store는 zustand+React에 결합되어 있어 직접 호출이 어려워 로직 자체 검증)
  function followupGuard(events: { id: string; week: number; year: number }[], state: { week: number; year: number }): boolean {
    return events.some(prev =>
      prev.week === state.week && prev.year === state.year && FOLLOWUP_EVENT_IDS.has(prev.id),
    );
  }
  const followupId = [...FOLLOWUP_EVENT_IDS][0];
  // 같은 주에 followup 이미 1개 → 가드 발동
  assert('같은 주에 followup 이미 있음 → 가드 발동(추가 followup 차단)',
    followupGuard(
      [{ id: followupId, week: 10, year: 1 }],
      { week: 10, year: 1 },
    ) === true);
  // 다른 주의 followup → 가드 통과
  assert('다른 주의 followup → 가드 통과(이번 주는 자유롭게 발동)',
    followupGuard(
      [{ id: followupId, week: 9, year: 1 }],
      { week: 10, year: 1 },
    ) === false);
  // followup 아닌 일반 이벤트 → 가드 통과
  assert('이번 주에 일반 이벤트만 → 가드 통과',
    followupGuard(
      [{ id: 'first-week', week: 10, year: 1 }],
      { week: 10, year: 1 },
    ) === false);
}

// ============================================================================
console.log('\n=== P19. events.push에서 condition 함수 제거 (직렬화 안전) ===');
// ============================================================================
{
  const src = readFileSync('./src/engine/store.ts', 'utf8');
  assert('store.ts에 events.push 전 recordedEvent에서 condition 제거 코드',
    /delete\s+recordedEvent\.condition/.test(src));

  // 런타임: GameEvent 샘플의 push 시뮬 (store와 동일한 destructure 동작)
  const sample = GAME_EVENTS.find(e => e.condition);
  assert('샘플 이벤트가 condition 함수를 가짐 (검증 전제)',
    !!sample && typeof sample.condition === 'function');
  if (sample) {
    const recordedEvent: Partial<GameEvent> = { ...sample };
    delete recordedEvent.condition;
    const pushed = { ...(recordedEvent as GameEvent), resolvedChoice: 0, week: 1, year: 1 };
    assert(`push된 객체에 condition 함수 없음 (typeof=${typeof pushed.condition})`,
      typeof pushed.condition === 'undefined');

    // 직렬화 round-trip 안전성
    const roundTrip = JSON.parse(JSON.stringify(pushed));
    assert('JSON 직렬화 round-trip 후에도 동일 (id/week/year 보존)',
      roundTrip.id === pushed.id && roundTrip.week === pushed.week && roundTrip.year === pushed.year);
  }
}

// ============================================================================
console.log('\n=== P20. (회귀) Y1 W26 subin-bridge / W25 minjae-sports 도달 ===');
// ============================================================================
{
  // 빈 루틴(자습×2)으로 Y1 진행 — 첫 선택지 자동 처리
  let s: GameState = createInitialState('male', ['emotional', 'wealth'], { rngSeed: 1234567 });
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'self-study';

  const reachedAt: Record<string, number | null> = {
    'subin-bridge': null,
    'minjae-sports': null,
  };

  for (let w = 0; w < 48; w++) {
    s = processWeek(s);
    if (s.currentEvent) {
      const c = s.currentEvent.choices[0];
      if (c?.npcEffects) for (const ne of c.npcEffects) {
        const npc = s.npcs.find(n => n.id === ne.npcId);
        if (npc) { npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + ne.intimacyChange)); npc.met = true; }
      }
      const recordedEvent: Partial<GameEvent> = { ...s.currentEvent };
      delete recordedEvent.condition;
      s.events.push({ ...(recordedEvent as GameEvent), resolvedChoice: 0, week: s.week, year: s.year });
      s.currentEvent = null;
    }
    for (const fid of Object.keys(reachedAt)) {
      if (reachedAt[fid] !== null) continue;
      const def = GAME_EVENTS.find(e => e.id === fid);
      if (def?.condition && def.condition(s)) reachedAt[fid] = s.week;
    }
    if (s.phase === 'year-end') break;
  }

  assert(`subin-bridge Y1 도달 (W=${reachedAt['subin-bridge']})`,
    reachedAt['subin-bridge'] !== null && reachedAt['subin-bridge']! >= 26);
  assert(`minjae-sports Y1 도달 (W=${reachedAt['minjae-sports']})`,
    reachedAt['minjae-sports'] !== null && reachedAt['minjae-sports']! >= 25);
}

// ============================================================================
console.log('\n=== P21. (회귀) followup이 정상 1회는 여전히 발동 ===');
// ============================================================================
{
  // FOLLOWUP_EVENT_IDS의 한 항목이 condition 충족 시 getFollowupForWeek가 그 이벤트 반환
  // 가드는 store에서 events 배열로 검사하므로, getFollowupForWeek 자체는 영향 없음
  const fakeState = {
    year: 1, week: 26, npcs: [
      { id: 'subin', met: true, intimacy: 30 },
      { id: 'minjae', met: true, intimacy: 40 },
    ], events: [], isVacation: false, hardCrisisYears: [], unlockedEvents: [],
  } as unknown as GameState;
  const followup = getFollowupForWeek(fakeState);
  assert(`getFollowupForWeek가 정상 followup 반환 (id=${followup?.id ?? 'null'})`,
    followup !== null && FOLLOWUP_EVENT_IDS.has(followup.id));
}

// ============================================================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
if (failed > 0) process.exit(1);
