// 크라이시스 이벤트 리그레션
// 목적: HARD_CRISIS_IDS / SOFT_CRISIS_IDS에 등록된 모든 ID가
//  (1) 실제 GameEvent로 정의돼 있고
//  (2) condition 함수를 가지며
//  (3) 인위적으로 조건 충족시키면 getEventForWeek가 선택해 반환하는지
//  (4) HARD는 연간 1회, SOFT는 연간 2회 상한이 지켜지는지 확인.
//
// 실행: cd game && npx tsx scripts/verify-crisis-events.ts

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

import { createInitialState } from '../src/engine/gameEngine';
import { GAME_EVENTS, HARD_CRISIS_IDS, SOFT_CRISIS_IDS, getEventForWeek } from '../src/engine/events';
import type { GameState } from '../src/engine/types';

function mkState(patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['wealth', 'emotional']);
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
function assert(label: string, cond: boolean, hint?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ''}`); failed++; failures.push(label); }
}

// ========================================
// 1. 정적 — 모든 크라이시스 ID가 정의되고 condition 보유
// ========================================
console.log('\n=== 1. 크라이시스 정의 ===');
{
  const byId = new Map(GAME_EVENTS.map(e => [e.id, e]));
  const allCrisis = [...HARD_CRISIS_IDS, ...SOFT_CRISIS_IDS];

  for (const id of allCrisis) {
    const ev = byId.get(id);
    assert(`"${id}" 정의 존재`, !!ev);
    if (ev) {
      assert(`"${id}" condition 보유`, !!ev.condition);
      assert(`"${id}" choices ≥ 2`, ev.choices.length >= 2);
    }
  }
}

// ========================================
// 2. 동적 — 각 크라이시스 condition이 의도한 상태에서 true/false 반환
//    (getEventForWeek는 고정 주차/followup이 먼저 걸려서 직접 검증 어려움 →
//     condition 함수만 단위 테스트)
// ========================================
console.log('\n=== 2. HARD 크라이시스 condition 정합성 ===');
{
  const byId = new Map(GAME_EVENTS.map(e => [e.id, e]));
  const hc = (id: string) => byId.get(id)?.condition;

  // middle-burnout: Y3 + idleWeeks≥3 + mental≤55
  {
    const cond = hc('middle-burnout')!;
    const yes = mkState({ year: 3, idleWeeks: 4, stats: { academic: 50, social: 40, talent: 30, mental: 50, health: 60 } });
    const noYear = mkState({ year: 2, idleWeeks: 4, stats: { academic: 50, social: 40, talent: 30, mental: 50, health: 60 } });
    const noIdle = mkState({ year: 3, idleWeeks: 1, stats: { academic: 50, social: 40, talent: 30, mental: 50, health: 60 } });
    const noMental = mkState({ year: 3, idleWeeks: 4, stats: { academic: 50, social: 40, talent: 30, mental: 70, health: 60 } });
    assert('middle-burnout: Y3 + idleWeeks 4 + mental 50 → true', cond(yes));
    assert('middle-burnout: Y2 → false', !cond(noYear));
    assert('middle-burnout: idleWeeks 1 → false', !cond(noIdle));
    assert('middle-burnout: mental 70 → false', !cond(noMental));
  }

  // high-panic: Y5~Y7 + mental≤55 + academic≥50
  {
    const cond = hc('high-panic')!;
    const yes = mkState({ year: 5, stats: { academic: 60, social: 50, talent: 40, mental: 45, health: 60 } });
    const noYear = mkState({ year: 4, stats: { academic: 60, social: 50, talent: 40, mental: 45, health: 60 } });
    const noMental = mkState({ year: 5, stats: { academic: 60, social: 50, talent: 40, mental: 70, health: 60 } });
    const noAcademic = mkState({ year: 5, stats: { academic: 30, social: 50, talent: 40, mental: 45, health: 60 } });
    assert('high-panic: Y5 + mental 45 + academic 60 → true', cond(yes));
    assert('high-panic: Y4 → false', !cond(noYear));
    assert('high-panic: mental 70 → false', !cond(noMental));
    assert('high-panic: academic 30 → false', !cond(noAcademic));
  }

  // family-strain: Y3~Y6 + (idleWeeks≥4 OR (mental≤45 && academic≤55))
  {
    const cond = hc('family-strain')!;
    const viaIdle = mkState({ year: 4, idleWeeks: 4, stats: { academic: 70, social: 50, talent: 40, mental: 60, health: 60 } });
    const viaLowStats = mkState({ year: 4, idleWeeks: 0, stats: { academic: 50, social: 40, talent: 30, mental: 40, health: 55 } });
    const noYear = mkState({ year: 7, idleWeeks: 4, stats: { academic: 70, social: 50, talent: 40, mental: 60, health: 60 } });
    const noTrigger = mkState({ year: 4, idleWeeks: 0, stats: { academic: 70, social: 50, talent: 40, mental: 60, health: 60 } });
    assert('family-strain: Y4 + idleWeeks 4 → true', cond(viaIdle));
    assert('family-strain: Y4 + mental 40 + academic 50 → true', cond(viaLowStats));
    assert('family-strain: Y7 → false', !cond(noYear));
    assert('family-strain: 평온한 상태 → false', !cond(noTrigger));
  }

  // identity-crisis: (Y5 || Y6) + mental≤55 + 미발동
  {
    const cond = hc('identity-crisis')!;
    const yes = mkState({ year: 6, stats: { academic: 40, social: 40, talent: 40, mental: 50, health: 55 } });
    const noYear = mkState({ year: 7, stats: { academic: 40, social: 40, talent: 40, mental: 50, health: 55 } });
    const noMental = mkState({ year: 6, stats: { academic: 40, social: 40, talent: 40, mental: 70, health: 55 } });
    const already = mkState({ year: 6, stats: { academic: 40, social: 40, talent: 40, mental: 50, health: 55 } });
    already.events.push({ id: 'identity-crisis', title: '', description: '', choices: [], week: 5, year: 6 });
    assert('identity-crisis: Y6 + mental 50 → true', cond(yes));
    assert('identity-crisis: Y7 → false', !cond(noYear));
    assert('identity-crisis: mental 70 → false', !cond(noMental));
    assert('identity-crisis: 이미 발동 → false', !cond(already));
  }
}

console.log('\n=== 3. SOFT 크라이시스 condition 정합성 ===');
{
  const byId = new Map(GAME_EVENTS.map(e => [e.id, e]));
  const sc = (id: string) => byId.get(id)?.condition;

  // yuna-misunderstanding: yuna.met + intimacy 40~75 + Y2~Y5 + !isVacation
  {
    const cond = sc('yuna-misunderstanding')!;
    let yes = mkState({ year: 3, isVacation: false });
    yes = setNpc(yes, 'yuna', { met: true, intimacy: 55 });
    let noUnmet = mkState({ year: 3, isVacation: false });
    noUnmet = setNpc(noUnmet, 'yuna', { met: false, intimacy: 55 });
    let noIntimacy = mkState({ year: 3, isVacation: false });
    noIntimacy = setNpc(noIntimacy, 'yuna', { met: true, intimacy: 20 });
    let noYear = mkState({ year: 6, isVacation: false });
    noYear = setNpc(noYear, 'yuna', { met: true, intimacy: 55 });
    assert('yuna-misunderstanding: met + intimacy 55 + Y3 → true', cond(yes));
    assert('yuna-misunderstanding: 미만남 → false', !cond(noUnmet));
    assert('yuna-misunderstanding: intimacy 20 → false', !cond(noIntimacy));
    assert('yuna-misunderstanding: Y6 → false', !cond(noYear));
  }

  // subin-drift: subin.met + intimacy 30~65 + Y3~Y5 + !isVacation
  {
    const cond = sc('subin-drift')!;
    let yes = mkState({ year: 4, isVacation: false });
    yes = setNpc(yes, 'subin', { met: true, intimacy: 45 });
    let noIntimacy = mkState({ year: 4, isVacation: false });
    noIntimacy = setNpc(noIntimacy, 'subin', { met: true, intimacy: 80 });
    assert('subin-drift: met + intimacy 45 + Y4 → true', cond(yes));
    assert('subin-drift: intimacy 80 → false', !cond(noIntimacy));
  }

  // jihun-envy: jihun.met + intimacy 45~75 + Y2~Y5 + stat(social/talent/academic) 하나 ≥ 60/65 + !isVacation
  {
    const cond = sc('jihun-envy')!;
    let yes = mkState({ year: 3, isVacation: false, stats: { academic: 50, social: 65, talent: 30, mental: 50, health: 50 } });
    yes = setNpc(yes, 'jihun', { met: true, intimacy: 60 });
    let noStat = mkState({ year: 3, isVacation: false, stats: { academic: 50, social: 50, talent: 50, mental: 50, health: 50 } });
    noStat = setNpc(noStat, 'jihun', { met: true, intimacy: 60 });
    assert('jihun-envy: met + intimacy 60 + social 65 → true', cond(yes));
    assert('jihun-envy: 스탯 미달 → false', !cond(noStat));
  }

  // haeun-distance: haeun.met + intimacy 40~80 + (Y3 || Y4) + !isVacation
  {
    const cond = sc('haeun-distance')!;
    let yes = mkState({ year: 3, isVacation: false });
    yes = setNpc(yes, 'haeun', { met: true, intimacy: 60 });
    let noYear = mkState({ year: 5, isVacation: false });
    noYear = setNpc(noYear, 'haeun', { met: true, intimacy: 60 });
    assert('haeun-distance: met + intimacy 60 + Y3 → true', cond(yes));
    assert('haeun-distance: Y5 → false', !cond(noYear));
  }
}

// ========================================
// 4. HARD 크라이시스 연간 1회 상한
// ========================================
console.log('\n=== 4. HARD 1회/년 상한 ===');
{
  const s = mkState({ year: 5, week: 20, hardCrisisYears: [5], stats: { academic: 60, social: 50, talent: 40, mental: 40, health: 55 } });
  const ev = getEventForWeek(s);
  assert(`hardCrisisYears에 Y5 기록됐으면 HARD 크라이시스 선별 안 됨 (got "${ev?.id}")`, !ev || !HARD_CRISIS_IDS.has(ev.id));
}

// ========================================
// 5. SOFT 크라이시스 연간 2건 상한
// ========================================
console.log('\n=== 5. SOFT 2건/년 상한 ===');
{
  let s = mkState({ year: 4, week: 20, hardCrisisYears: [4] });
  s = setNpc(s, 'yuna', { met: true, intimacy: 55 });
  s = setNpc(s, 'subin', { met: true, intimacy: 45 });
  s = setNpc(s, 'jihun', { met: true, intimacy: 60 });
  // 이미 이번 해에 소프트 2건 기록됨
  s.events.push({ id: 'yuna-misunderstanding', title: '', description: '', choices: [], resolvedChoice: 0, week: 5, year: 4 });
  s.events.push({ id: 'subin-drift', title: '', description: '', choices: [], resolvedChoice: 0, week: 12, year: 4 });

  const ev = getEventForWeek(s);
  assert(`같은 해 SOFT 2건 기록됐으면 세 번째 SOFT는 선별 안 됨 (got "${ev?.id}")`, !ev || !SOFT_CRISIS_IDS.has(ev.id));
}

// ========================================
// 6. memorySlotDraft 커버 — 각 크라이시스가 최소 1개 선택지에 기억 슬롯 초안 보유
// ========================================
console.log('\n=== 6. memorySlot 커버 ===');
{
  const byId = new Map(GAME_EVENTS.map(e => [e.id, e]));
  for (const id of [...HARD_CRISIS_IDS, ...SOFT_CRISIS_IDS]) {
    const ev = byId.get(id);
    if (!ev) continue;
    const hasDraft = ev.choices.some(c => !!c.memorySlotDraft);
    assert(`"${id}" 선택지 중 memorySlotDraft 보유 ≥ 1`, hasDraft);
  }
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
