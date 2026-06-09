// Phase 2A 검증 — 부모 미니이벤트 ±선택지 + 반복발동(쿨다운/로테이션) + 메모리 슬롯
//
// 범위:
//  1. 데이터 무결성 — 6개 부모 이벤트가 모두 2지선다 choices + parentEffect + message,
//     memorySlotDraft는 회상 린트 통과 + 20~35자 + importance≥3.
//  2. 반복발동 — getAvailableHomeEvents가 영구잠금이 아니라 쿨다운(4주) + least-recently-fired 로테이션.
//  3. 선택 적용 수학 — applyParentIntimacyDelta가 강점 배율 적용(±선택 트레이드오프 확인).
//  4. 메모리 슬롯 — choice의 memorySlotDraft가 슬롯 생성 + sourceEventId당 1회(재발동 중복 방지).
//  5. store 소스 가드 — talkToHome가 choice 이벤트를 즉시 적용하지 않고, resolveParentTalkChoice 존재.
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-phase2a.ts

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
import { createInitialState } from '../../src/engine/gameEngine';
import { PARENT_MINI_EVENTS } from '../../src/engine/talkData';
import { getAvailableHomeEvents, PARENT_EVENT_COOLDOWN_WEEKS } from '../../src/engine/talkSystem';
import { applyParentIntimacyDelta } from '../../src/engine/parentIntimacy';
import { applyMemorySlotFromMiniTalk, lintRecallText } from '../../src/engine/memorySystem';
import type { GameState, MemoryCategory, ParentStrength } from '../../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

function freshState(parents: [ParentStrength, ParentStrength]): GameState {
  return createInitialState('male', parents);
}

const VALID_CATEGORIES: MemoryCategory[] = [
  'courage', 'betrayal', 'reconciliation', 'failure', 'discovery', 'growth', 'bypass', 'unspoken_debt',
];

// ============================================================================
console.log('\n=== 1. 데이터 무결성 — 6개 ±선택지 + 메모리 드래프트 ===');
// ============================================================================
{
  // Phase 2B: 강점당 2개로 확장 → 총 12개, 6강점 각 2개.
  assert('부모 미니이벤트 12개', PARENT_MINI_EVENTS.length === 12, `len=${PARENT_MINI_EVENTS.length}`);
  for (const st of ['emotional', 'wealth', 'info', 'strict', 'resilience', 'freedom'] as const) {
    const n = PARENT_MINI_EVENTS.filter(e => e.parentStrength === st).length;
    assert(`강점 ${st} 이벤트 2개`, n === 2, `${n}`);
  }
  for (const ev of PARENT_MINI_EVENTS) {
    assert(`${ev.id}: parentStrength 지정`, !!ev.parentStrength);
    assert(`${ev.id}: choices 2지선다`, (ev.choices?.length ?? 0) === 2, `len=${ev.choices?.length}`);
    for (const [i, c] of (ev.choices ?? []).entries()) {
      assert(`${ev.id}[${i}]: label/message`, !!c.label && !!c.message);
      assert(`${ev.id}[${i}]: parentEffect(baseDelta+tag)`,
        !!c.parentEffect && typeof c.parentEffect.baseDelta === 'number' && !!c.parentEffect.tag);
      if (c.memorySlotDraft) {
        const d = c.memorySlotDraft;
        const len = d.recallText.length;
        assert(`${ev.id}[${i}]: recallText 20~35자`, len >= 20 && len <= 35, `len=${len} "${d.recallText}"`);
        assert(`${ev.id}[${i}]: recallText 린트 통과`, lintRecallText(d.recallText).length === 0,
          lintRecallText(d.recallText).join(','));
        assert(`${ev.id}[${i}]: importance≥3`, d.importance >= 3, `imp=${d.importance}`);
        assert(`${ev.id}[${i}]: 유효 카테고리`, VALID_CATEGORIES.includes(d.category), d.category);
      }
    }
    // 트레이드오프: 한쪽은 친밀도 상승(+), 다른 쪽은 하락(−) 이어야 "하강압력"이 생긴다
    const deltas = (ev.choices ?? []).map(c => c.parentEffect?.baseDelta ?? 0);
    assert(`${ev.id}: ±트레이드오프(상승/하락 공존)`,
      deltas.some(d => d > 0) && deltas.some(d => d < 0), `deltas=${deltas.join(',')}`);
  }
}

// ============================================================================
console.log('\n=== 2. 반복발동 — 쿨다운 + 로테이션 (getAvailableHomeEvents) ===');
// ============================================================================
{
  assert('쿨다운 상수 = 4주', PARENT_EVENT_COOLDOWN_WEEKS === 4, `${PARENT_EVENT_COOLDOWN_WEEKS}`);

  const s = freshState(['emotional', 'strict']);
  s.totalWeeksPlayed = 10;
  s.parentEventsFired = [];
  const avail0 = getAvailableHomeEvents(s);
  assert('미발동: 두 강점의 이벤트 모두 가용(강점당 2개 → 4개)',
    avail0.length === 4 && avail0.every(e => e.parentStrength === 'emotional' || e.parentStrength === 'strict')
    && avail0.some(e => e.parentStrength === 'emotional') && avail0.some(e => e.parentStrength === 'strict'),
    avail0.map(e => e.id).join(','));

  // emotional을 week 10에 발동 기록
  s.parentEventsFired = [{ id: 'talk_parent_emotional', week: 10 }];
  s.totalWeeksPlayed = 11; // 1주 경과 < 4 → 쿨다운 중
  const avail1 = getAvailableHomeEvents(s);
  assert('쿨다운 중: 방금 발동한 이벤트 제외',
    !avail1.some(e => e.id === 'talk_parent_emotional'), avail1.map(e => e.id).join(','));
  assert('로테이션: 다른 강점 이벤트가 available[0]',
    avail1[0]?.id === 'talk_parent_strict', avail1[0]?.id);

  // 4주 경과 → 재발동 가능
  s.totalWeeksPlayed = 14; // 14-10 = 4 ≥ 4
  const avail2 = getAvailableHomeEvents(s);
  assert('쿨다운 종료: 재발동 가능(영구잠금 아님)',
    avail2.some(e => e.id === 'talk_parent_emotional'), avail2.map(e => e.id).join(','));

  // least-recently-fired 우선: 강점당 2개(총 4개)를 모두 다른 주에 발동시키고 가장 오래된 것이 첫 번째인지
  s.parentEventsFired = [
    { id: 'talk_parent_emotional', week: 10 },
    { id: 'talk_parent_strict', week: 12 },
    { id: 'talk_parent_emotional_2', week: 14 },
    { id: 'talk_parent_strict_2', week: 16 },
  ];
  s.totalWeeksPlayed = 30; // 모두 쿨다운 경과
  const avail3 = getAvailableHomeEvents(s);
  assert('로테이션: 가장 오래전 발동이 available[0]',
    avail3[0]?.id === 'talk_parent_emotional', avail3[0]?.id);

  // 강점 풀 필터: 보유하지 않은 강점 이벤트는 안 나옴 (year=5 — info_2 yearMin:5 게이트 통과시켜 4개 확인)
  const s2 = freshState(['wealth', 'info']);
  s2.year = 5;
  s2.totalWeeksPlayed = 10;
  s2.parentEventsFired = [];
  const availW = getAvailableHomeEvents(s2);
  assert('강점 필터: wealth/info만(각 2개 → 4개)',
    availW.every(e => e.parentStrength === 'wealth' || e.parentStrength === 'info') && availW.length === 4,
    availW.map(e => e.id).join(','));
}

// ============================================================================
console.log('\n=== 3. 선택 적용 수학 — 강점 배율 ±트레이드오프 (pi=50, factor=1.0) ===');
// ============================================================================
{
  // strict 긍정(keepPromise +0.6) × 1.4 = +0.84 / 중립 2번째 부모(emotional)
  const a = freshState(['strict', 'emotional']);
  a.parentIntimacy = 50;
  const dA = applyParentIntimacyDelta(a, 0.6, 'keepPromise');
  assert('strict keepPromise +0.6 → +0.84', approx(dA, 0.84), `${dA}`);

  // strict 부정(breakPromise -1.0) × 1.4 = -1.4 / freedom은 breakPromise 미정의(1.0)
  const b = freshState(['strict', 'freedom']);
  b.parentIntimacy = 50;
  const dB = applyParentIntimacyDelta(b, -1.0, 'breakPromise');
  assert('strict breakPromise -1.0 → -1.4', approx(dB, -1.4), `${dB}`);

  // emotional 긍정(shareWorry +1.5) × 1.4 = +2.1 / strict는 shareWorry 미정의(1.0)
  const c = freshState(['emotional', 'strict']);
  c.parentIntimacy = 50;
  const dC = applyParentIntimacyDelta(c, 1.5, 'shareWorry');
  assert('emotional shareWorry +1.5 → +2.1', approx(dC, 2.1), `${dC}`);

  // emotional 부정(hideProblem -0.6) × 1.4 = -0.84
  const d = freshState(['emotional', 'strict']);
  d.parentIntimacy = 50;
  const dD = applyParentIntimacyDelta(d, -0.6, 'hideProblem');
  assert('emotional hideProblem -0.6 → -0.84', approx(dD, -0.84), `${dD}`);

  // freedom 긍정(autonomyChoice +1.2) × 1.4 = +1.68 / emotional은 autonomyChoice 미정의(1.0)
  const e = freshState(['freedom', 'emotional']);
  e.parentIntimacy = 50;
  const dE = applyParentIntimacyDelta(e, 1.2, 'autonomyChoice');
  assert('freedom autonomyChoice +1.2 → +1.68', approx(dE, 1.68), `${dE}`);
}

// ============================================================================
console.log('\n=== 4. 메모리 슬롯 — choice 드래프트 생성 + sourceEventId 1회 ===');
// ============================================================================
{
  const s = freshState(['emotional', 'strict']);
  const ev = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_emotional')!;
  const positive = ev.choices![0]; // reconciliation 회상
  assert('emotional 긍정 선택에 memorySlotDraft', !!positive.memorySlotDraft);

  applyMemorySlotFromMiniTalk(s, ev.id, positive.memorySlotDraft);
  const slot = s.memorySlots.find(sl => sl.sourceEventId === ev.id);
  assert('슬롯 생성됨', !!slot, `slots=${s.memorySlots.length}`);
  assert('슬롯 카테고리 = reconciliation', slot?.category === 'reconciliation', slot?.category);

  // 재발동(쿨다운 후 다시 선택)해도 sourceEventId 같으면 중복 생성 안 됨
  const before = s.memorySlots.length;
  applyMemorySlotFromMiniTalk(s, ev.id, ev.choices![1].memorySlotDraft);
  assert('동일 sourceEventId 중복 방지', s.memorySlots.length === before, `${before}→${s.memorySlots.length}`);
}

// ============================================================================
console.log('\n=== 5. store 소스 가드 — select-then-apply ===');
// ============================================================================
{
  const src = readFileSync('./src/engine/store.ts', 'utf8');
  assert('resolveParentTalkChoice 액션 존재', /resolveParentTalkChoice\s*:/.test(src));
  assert('PARENT_MINI_EVENTS import', /PARENT_MINI_EVENTS/.test(src));
  assert('talkToHome: choice 이벤트는 즉시 적용 안 함(상태 미변경 return)',
    /ev\.choices\b[\s\S]{0,120}return\s*\{\s*kind:\s*'event'/.test(src));
  assert('resolveParentTalkChoice: parentEventPendingThisWeek 가드',
    /resolveParentTalkChoice[\s\S]{0,200}parentEventPendingThisWeek/.test(src));
  const implStart = src.indexOf('resolveParentTalkChoice: (eventId, choiceIdx)');
  const resolveBlock = src.slice(implStart, implStart + 900);
  assert('부모 발동은 parentEventsFired로 기록(resolve 블록에서 talkEventsFired 미사용)',
    /recordParentEventFired/.test(resolveBlock) && !/talkEventsFired/.test(resolveBlock));
  assert('getAvailableHomeEvents가 talkEventsFired로 부모 영구잠금 안 함',
    !/getAvailableHomeEvents[\s\S]{0,400}talkEventsFired/.test(readFileSync('./src/engine/talkSystem.ts', 'utf8')));
}

// ============================================================================
console.log('\n=== 6. 4자 리뷰 반영 (F1~F5) 회귀 ===');
// ============================================================================
{
  const wealth = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_wealth')!;
  const wAvoid = wealth.choices![1];
  assert('F2 wealth 회피 money +5→+3', wAvoid.effects?.money === 3, `${wAvoid.effects?.money}`);
  assert('F2 wealth 회피 baseDelta -0.5→-1.2', wAvoid.parentEffect?.baseDelta === -1.2, `${wAvoid.parentEffect?.baseDelta}`);

  const freedom = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_freedom')!;
  const fAvoid = freedom.choices![1];
  assert('F2 freedom 회피 baseDelta -0.6→-1.5', fAvoid.parentEffect?.baseDelta === -1.5, `${fAvoid.parentEffect?.baseDelta}`);

  const strict = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_strict')!;
  const sPos = strict.choices![0];
  assert('F3 strict 긍정 멘탈-1 제거(학업+1만)',
    sPos.effects?.stats?.mental === undefined && sPos.effects?.stats?.academic === 1,
    JSON.stringify(sPos.effects?.stats));

  // F2 적용 후에도 6종 ±트레이드오프 유지(상승/하락 공존)
  for (const ev of PARENT_MINI_EVENTS) {
    const ds = (ev.choices ?? []).map(c => c.parentEffect?.baseDelta ?? 0);
    assert(`F2 후 ${ev.id} ±공존 유지`, ds.some(d => d > 0) && ds.some(d => d < 0), ds.join(','));
  }

  // F5 — choiceIndex 전달
  {
    const st = freshState(['emotional', 'freedom']);
    applyMemorySlotFromMiniTalk(st, 'x_evt', { category: 'growth', importance: 3, recallText: '내 길은 내가 정하겠다고 처음 말했다.' }, 1);
    const slot = st.memorySlots.find(s => s.sourceEventId === 'x_evt');
    assert('F5 applyMemorySlotFromMiniTalk가 choiceIndex 기록', slot?.choiceIndex === 1, `${slot?.choiceIndex}`);
  }

  // F1 — 부정 회상의 톤 분기는 모달(런타임 UI)이라 소스 패턴으로 확인
  {
    const modal = readFileSync('./src/components/screens/main/MiniTalkModal.tsx', 'utf8');
    assert('F1 isHeavyMemory 분기 존재(부정 친밀도/회한 톤)', /isHeavyMemory/.test(modal) && /baseDelta\s*<\s*0/.test(modal));
    assert('F1 "관계가 한 걸음 더 깊어졌어요"는 isWarmMemory 한정',
      /isWarmMemory\s*&&[\s\S]{0,120}관계가 한 걸음 더 깊어졌어요/.test(modal));
  }

  // F4 — eventId 가용성 가드 (store 소스)
  {
    const store = readFileSync('./src/engine/store.ts', 'utf8');
    const implStart2 = store.indexOf('resolveParentTalkChoice: (eventId, choiceIdx)');
    const block = store.slice(implStart2, implStart2 + 900);
    assert('F4 resolveParentTalkChoice가 getAvailableHomeEvents 가드',
      /getAvailableHomeEvents\(s\)\.some\(e => e\.id === eventId\)/.test(block));
  }
}

// ============================================================================
console.log(`\n${failed === 0 ? '✅' : '❌'} Phase 2A: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
