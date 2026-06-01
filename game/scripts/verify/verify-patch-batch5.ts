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
import { createInitialState, processWeek } from '../../src/engine/gameEngine';
import { FOLLOWUP_EVENT_IDS, GAME_EVENTS, getFollowupForWeek } from '../../src/engine/events';
import type { GameEvent, GameState } from '../../src/engine/types';
import { applyParentIntimacyDelta, applyParentMeanReversion } from '../../src/engine/parentIntimacy';

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
    ], events: [], isVacation: false, hardCrisisYears: [],
  } as unknown as GameState;
  const followup = getFollowupForWeek(fakeState);
  assert(`getFollowupForWeek가 정상 followup 반환 (id=${followup?.id ?? 'null'})`,
    followup !== null && FOLLOWUP_EVENT_IDS.has(followup.id));
}

// ============================================================================
console.log('\n=== P22. speakers met 처리 — 대사 전용 등장 NPC도 만남 인정 ===');
// ============================================================================
{
  const src = readFileSync('./src/engine/store.ts', 'utf8');
  assert('store.ts resolveEvent가 speakers 순회로 met 처리',
    /currentEvent!?\.speakers/.test(src) && /npc\.met\s*=\s*true/.test(src));

  // 콘텐츠 일관성: 현재 모든 speakers NPC는 어떤 분기에서든 npcEffects 로 등장
  // → 현재 콘텐츠 기준 픽스 영향 0건. 픽스는 미래 콘텐츠 보호용 방어 가드.
  // 0건이 깨지는 순간(speakers-only NPC 등장) 픽스가 그 NPC를 자동으로 met 처리.
  const speakerOnlyEvents = GAME_EVENTS.filter(e => {
    if (!e.speakers || e.speakers.length === 0) return false;
    const allChoices = [...e.choices, ...(e.femaleChoices ?? [])];
    const npcsInEffects = new Set<string>();
    for (const c of allChoices) {
      for (const ne of c.npcEffects ?? []) npcsInEffects.add(ne.npcId);
    }
    return e.speakers.some(s => !npcsInEffects.has(s));
  });
  console.log(`     (참고) speakers 사용 이벤트=${GAME_EVENTS.filter(e => e.speakers?.length).length}, speakers-only NPC 등장=${speakerOnlyEvents.length}`);
  assert('콘텐츠 일관성: speakers의 모든 NPC가 npcEffects에서도 등장 (현재 0건이 정상)',
    speakerOnlyEvents.length === 0);
}

// ============================================================================
console.log('\n=== P23. Phase 2.1 말걸기 미니 이벤트 (사전 결정 모델) ===');
// ============================================================================
{
  // 1. 인프라 — types/createInitialState/migrateLoadedState/processWeek 모두 새 필드 처리
  const typesSrc = readFileSync('./src/engine/types.ts', 'utf8');
  const engineSrc = readFileSync('./src/engine/gameEngine.ts', 'utf8');
  const migrationSrc = readFileSync('./src/engine/stateMigration.ts', 'utf8');
  const storeSrc = readFileSync('./src/engine/store.ts', 'utf8');
  assert('types.ts에 사전 결정 필드 (npcEventPendingThisWeek/parentEventPendingThisWeek)',
    /npcEventPendingThisWeek:\s*boolean/.test(typesSrc)
    && /parentEventPendingThisWeek:\s*boolean/.test(typesSrc)
    && /parentIntimacy:\s*number/.test(typesSrc));
  assert('createInitialState — 첫 주 pending=true (첫 인상 보장)',
    /npcEventPendingThisWeek:\s*true/.test(engineSrc)
    && /parentEventPendingThisWeek:\s*true/.test(engineSrc));
  assert('migrateLoadedState — 백필 처리 (stateMigration.ts 로 이동)',
    /npcEventPendingThisWeek:\s*state\.npcEventPendingThisWeek\s*\?\?\s*false/.test(migrationSrc));
  assert('processWeek가 매주 pressure +0.1/+0.05 + 사전 결정 굴림(seededRandom < pressure)',
    /talkEventPressure\s*=\s*Math\.min\(1,.*\+\s*0\.1/.test(engineSrc)
    && /npcEventPendingThisWeek\s*=\s*seededRandom\(newState\)\s*<\s*newState\.talkEventPressure/.test(engineSrc));
  assert('store.ts에 talkToNpc/talkToHome 액션 + fire 시 pressure=0 + pending=false',
    /talkToNpc:\s*\(npcId\)\s*=>/.test(storeSrc)
    && /talkToHome:\s*\(\)\s*=>/.test(storeSrc)
    && /talkEventPressure\s*=\s*0/.test(storeSrc)
    && /npcEventPendingThisWeek\s*=\s*false/.test(storeSrc));
  // P3-9: 데이터/로직 분리 — talkSystem.ts 가 풀 데이터를 talkData.ts 에서 import
  const talkSystemSrc = readFileSync('./src/engine/talkSystem.ts', 'utf8');
  assert('talkSystem.ts 가 talkData.ts 에서 풀 데이터 import (P3-9)',
    /from\s+['"]\.\/talkData['"]/.test(talkSystemSrc)
    && /NPC_MINI_EVENTS/.test(talkSystemSrc)
    && /PARENT_MINI_EVENTS/.test(talkSystemSrc));

  // 2. 풀 자체 검증 — 6 NPC + 6 강점
  const { NPC_MINI_EVENTS, PARENT_MINI_EVENTS } = await import('../../src/engine/talkData');
  const npcIds = new Set(NPC_MINI_EVENTS.map(e => e.npcId));
  assert(`NPC 미니 이벤트 풀: ${npcIds.size} NPC 커버, ${NPC_MINI_EVENTS.length}개 시드 (최소 6 NPC 필요)`,
    NPC_MINI_EVENTS.length >= 6 && npcIds.size >= 6);
  const parentStrengths = new Set(PARENT_MINI_EVENTS.map(e => e.parentStrength));
  assert(`부모 미니 이벤트 풀: 6 강점 커버 (현재 ${PARENT_MINI_EVENTS.length}개)`,
    PARENT_MINI_EVENTS.length >= 6 && parentStrengths.size === 6);
  assert('모든 미니 이벤트 ID 고유',
    new Set([...NPC_MINI_EVENTS, ...PARENT_MINI_EVENTS].map(e => e.id)).size
    === NPC_MINI_EVENTS.length + PARENT_MINI_EVENTS.length);

  // 3. 누적 확률 — 초기 0, processWeek로 +0.1/+0.05, cap 1.0
  let s = createInitialState('male', ['emotional', 'wealth']);
  assert(`초기 pressure 0 + 첫 주 pending=true (실제 pressure=${s.talkEventPressure}, pending=${s.npcEventPendingThisWeek})`,
    s.talkEventPressure === 0 && s.npcEventPendingThisWeek === true);
  s = processWeek(s);
  assert(`1주 후 pressure 0.1 (실제 ${s.talkEventPressure.toFixed(2)})`,
    Math.abs(s.talkEventPressure - 0.1) < 0.001);
  for (let i = 0; i < 12; i++) s = processWeek(s);
  assert(`pressure 1.0 cap (13주 후 ${s.talkEventPressure})`, s.talkEventPressure === 1);

  // 4. 부모 친밀도 재설계(태그 기반 하이브리드) — 강점 자동 드리프트 제거 확인
  //    옛 동작: emotional +0.1/주, strict -0.1/주. 새 설계: 자동 드리프트 없음, 행동 없으면 50 회귀(중립).
  let s2 = createInitialState('male', ['emotional', 'wealth']);
  for (let i = 0; i < 10; i++) s2 = processWeek(s2);
  assert(`emotional 부모 — 자동 드리프트 제거 (무행동 10주 → 50 유지, 실제 ${s2.parentIntimacy.toFixed(2)})`,
    Math.abs(s2.parentIntimacy - 50) < 0.001);

  let s3 = createInitialState('male', ['strict', 'info']);
  for (let i = 0; i < 10; i++) s3 = processWeek(s3);
  assert(`strict 부모 — 자동 하락 제거 (무행동 10주 → 50 유지, 실제 ${s3.parentIntimacy.toFixed(2)})`,
    Math.abs(s3.parentIntimacy - 50) < 0.001);

  // 4b. 결정론 탈피 — strict 가정도 성적 향상(gradeImprove)으로 상승, emotional은 성적에 둔감
  const strictGrade = applyParentIntimacyDelta(
    { parents: ['strict', 'info'], parentIntimacy: 50 } as GameState, 0.8, 'gradeImprove');
  assert(`결정론 탈피 — strict 가정 gradeImprove +0.8 → +${strictGrade.toFixed(2)} (강점 배율 1.4)`,
    Math.abs(strictGrade - 1.12) < 0.001);
  const emoGrade = applyParentIntimacyDelta(
    { parents: ['emotional', 'wealth'], parentIntimacy: 50 } as GameState, 0.8, 'gradeImprove');
  assert(`결정론 탈피 — emotional 가정은 성적에 둔감 (+${emoGrade.toFixed(2)} < strict ${strictGrade.toFixed(2)})`,
    emoGrade < strictGrade);

  // 4c. 평균 회귀 — 무행동 주만 50으로 수렴(상↓ 0.01), 부모 행동 시 면제
  const revHigh = { parentIntimacy: 70, actedWithParentThisWeek: false } as GameState;
  applyParentMeanReversion(revHigh);
  assert(`평균 회귀 — pi70 무행동 → ${revHigh.parentIntimacy.toFixed(2)} (50 방향 하락)`,
    Math.abs(revHigh.parentIntimacy - 69.8) < 0.001);
  const revActed = { parentIntimacy: 70, actedWithParentThisWeek: true } as GameState;
  applyParentMeanReversion(revActed);
  assert(`평균 회귀 — pi70 부모 행동 시 면제 (유지 ${revActed.parentIntimacy.toFixed(2)})`,
    revActed.parentIntimacy === 70);
  const revLow = { parentIntimacy: 30, actedWithParentThisWeek: false } as GameState;
  applyParentMeanReversion(revLow);
  assert(`평균 회귀 — pi30 무행동 → ${revLow.parentIntimacy.toFixed(2)} (저구간 0.006 비대칭, 회복 더딤)`,
    Math.abs(revLow.parentIntimacy - 30.12) < 0.001);

  // 4d. 하강 경로 — 음수 delta에도 강점 배율 곱 적용 (strict 성적급락 증폭, emotional/resilience 완충)
  const strictDrop = applyParentIntimacyDelta(
    { parents: ['strict', 'info'], parentIntimacy: 50 } as GameState, -1.0, 'gradeDrop');
  assert(`하강 — strict 가정 gradeDrop -1.0 → ${strictDrop.toFixed(2)} (1.4×1.0)`,
    Math.abs(strictDrop - (-1.4)) < 0.001);
  const emoResDrop = applyParentIntimacyDelta(
    { parents: ['emotional', 'resilience'], parentIntimacy: 50 } as GameState, -1.0, 'gradeDrop');
  assert(`하강 — emotional+resilience gradeDrop -1.0 → ${emoResDrop.toFixed(2)} (0.6×0.6 완충)`,
    Math.abs(emoResDrop - (-0.36)) < 0.001);

  // 4e. 연속 구간 감쇠 — pi=50 외 구간에서 factor가 실제 적용되는지 (계단 아님)
  const dampHigh = applyParentIntimacyDelta(
    { parents: ['emotional', 'wealth'], parentIntimacy: 70 } as GameState, 1.0, 'familyTime');
  assert(`구간 감쇠 — pi70 familyTime(1.4×1.4) → ${dampHigh.toFixed(3)} (factor 0.6)`,
    Math.abs(dampHigh - 1.176) < 0.001); // 1.0*1.96*0.6
  const dampVeryHigh = applyParentIntimacyDelta(
    { parents: ['emotional', 'wealth'], parentIntimacy: 85 } as GameState, 1.0, 'familyTime');
  assert(`구간 감쇠 — pi85 → ${dampVeryHigh.toFixed(3)} (factor 0.3, pi70보다 작음)`,
    Math.abs(dampVeryHigh - 0.588) < 0.001 && dampVeryHigh < dampHigh); // 1.96*0.3

  // 4f. 경계 — pi=100 양수 차단 / pi=0 음수 차단 (clamp)
  const ceil = { parents: ['emotional', 'wealth'], parentIntimacy: 100 } as GameState;
  applyParentIntimacyDelta(ceil, 1.0, 'familyTime');
  assert(`경계 — pi100 양수 delta → ${ceil.parentIntimacy} (100 초과 불가)`, ceil.parentIntimacy === 100);
  const floor = { parents: ['strict', 'info'], parentIntimacy: 0 } as GameState;
  applyParentIntimacyDelta(floor, -1.0, 'gradeDrop');
  assert(`경계 — pi0 음수 delta → ${floor.parentIntimacy} (0 미만 불가)`, floor.parentIntimacy === 0);

  // 4g. processWeek 후 actedWithParentThisWeek 리셋 확인
  let s5 = createInitialState('male', ['emotional', 'wealth']);
  s5 = processWeek(s5);
  assert(`플래그 리셋 — processWeek 후 actedWithParentThisWeek=false (실제 ${s5.actedWithParentThisWeek})`,
    s5.actedWithParentThisWeek === false);

  // 4h. family-dinner 2슬롯 중복 방지 — 루틴 두 칸에 같은 부모 활동을 넣어도 친밀도는 1회만
  let s6 = createInitialState('male', ['emotional', 'wealth']);
  s6.routineSlot2 = 'family-dinner';
  s6.routineSlot3 = 'family-dinner';
  const piBefore = s6.parentIntimacy;
  s6 = processWeek(s6);
  // 1회 적용분 = 0.5 × 1.4 × 1.4 × factor(pi50→1.0) = 0.98. 2회였다면 ~1.9.
  assert(`2배 방지 — family-dinner 2슬롯 → 친밀도 +${(s6.parentIntimacy - piBefore).toFixed(2)} (1회분 ≈0.98, 2배 아님)`,
    Math.abs((s6.parentIntimacy - piBefore) - 0.98) < 0.05);

  // 6. (회귀) pressure가 1.0이면 매주 pending=true 보장 (오래 안 만나면 100% 발동 보장)
  let s4 = createInitialState('male', ['emotional', 'wealth']);
  for (let i = 0; i < 30; i++) s4 = processWeek(s4);
  assert(`pressure 1.0 → pending=true 보장 (rng < 1.0 → 항상 true)`,
    s4.talkEventPressure === 1 && s4.npcEventPendingThisWeek === true);
}

// ============================================================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
if (failed > 0) process.exit(1);
