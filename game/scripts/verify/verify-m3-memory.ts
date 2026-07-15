// M3 기억 슬롯 시스템 엔드투엔드 검증
// - applyMemorySlotFromChoice 동작
// - selectMemorialHighlights 선정 알고리즘 (edge cases 포함)
// - recordMilestoneForYear 자동 기록
// - calculateEnding 확장 반환 필드
// - 하드위기 연간 1회 가드

import { createInitialState, processWeek, applyYearTransition } from '../../src/engine/gameEngine';
import { calculateEnding } from '../../src/engine/ending';
import {
  applyMemorySlotFromChoice, selectMemorialHighlights, selectRegretHighlights,
  recordMilestoneForYear, yearToPhaseTag, lintRecallText,
} from '../../src/engine/memorySystem';
import { GAME_EVENTS } from '../../src/engine/events';
import { NPC_MINI_EVENTS } from '../../src/engine/talkData/miniEvents';
import type { GameState, EventChoice, GameEvent, MemorySlot } from '../../src/engine/types';

let passed = 0, failed = 0;
const assert = (label: string, cond: boolean, detail?: string) => {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
};

function setupState(): GameState {
  return createInitialState('male', ['wealth', 'emotional']);
}

function makeTestEvent(id: string): GameEvent {
  return { id, title: 't', description: 'd', choices: [] };
}

function makeChoice(draft: EventChoice['memorySlotDraft']): EventChoice {
  return { text: 't', effects: {}, message: 'm', memorySlotDraft: draft };
}

console.log('\n=== 1. yearToPhaseTag ===');
assert('Y1 → early', yearToPhaseTag(1) === 'early');
assert('Y2 → early', yearToPhaseTag(2) === 'early');
assert('Y3 → mid', yearToPhaseTag(3) === 'mid');
assert('Y4 → mid', yearToPhaseTag(4) === 'mid');
assert('Y5 → late', yearToPhaseTag(5) === 'late');
assert('Y7 → late', yearToPhaseTag(7) === 'late');

console.log('\n=== 2. lintRecallText 금지어 ===');
assert('"academic 8 올렸다" 금지', lintRecallText('academic을 8 올렸다').length > 0);
assert('"멘탈 +3" 금지', lintRecallText('멘탈 +3').length > 0);
assert('"A등급" 금지', lintRecallText('A등급 획득').length > 0);
assert('"커피 얼룩" 통과', lintRecallText('책상 위 커피 얼룩만 늘어가던, 중2의 긴 겨울.').length === 0);

console.log('\n=== 2b. 전 콘텐츠 recallText 금지어 전수 검사 ===');
// 런타임 lint는 console.warn뿐이고 CI는 부모 미니 풀만 검사해서(verify-parent-phase2a)
// NPC 미니·이벤트 선택지 draft가 사각지대였다 (PR #312 검수에서 실위반 발견).
// 길이(20~35자) 규약은 기존 27건이 벗어나 있어 여기선 금지 패턴만 게이트한다.
{
  const bad: string[] = [];
  for (const e of GAME_EVENTS) {
    for (const c of [...(e.choices ?? []), ...(e.femaleChoices ?? [])]) {
      if (c.memorySlotDraft && lintRecallText(c.memorySlotDraft.recallText).length > 0) {
        bad.push(`${e.id}: "${c.memorySlotDraft.recallText}"`);
      }
    }
  }
  for (const m of NPC_MINI_EVENTS) {
    const drafts = [m.memorySlotDraft, ...(m.choices ?? []).map(c => c.memorySlotDraft)];
    for (const d of drafts) {
      if (d && lintRecallText(d.recallText).length > 0) bad.push(`${m.id}: "${d.recallText}"`);
    }
  }
  assert('GAME_EVENTS + NPC 미니 draft 금지 패턴 0건', bad.length === 0, bad.join(' / '));
}

console.log('\n=== 3. applyMemorySlotFromChoice 기본 동작 ===');
{
  const s = setupState();
  s.year = 3; s.week = 15;
  const choice = makeChoice({
    category: 'growth', importance: 8, toneTag: 'breakthrough',
    recallText: '아무것도 안 한 날. 죄책감보다 숨이 먼저 돌아왔다.',
  });
  applyMemorySlotFromChoice(s, makeTestEvent('test-event'), 1, choice);
  assert('슬롯 1개 생성', s.memorySlots.length === 1);
  assert('phaseTag 자동 산출 (Y3=mid)', s.memorySlots[0].phaseTag === 'mid');
  assert('category 저장', s.memorySlots[0].category === 'growth');
  assert('importance 저장', s.memorySlots[0].importance === 8);
}

console.log('\n=== 4. importance <3 스킵 ===');
{
  const s = setupState();
  const choice = makeChoice({
    category: 'courage', importance: 2, recallText: '무시할 기억',
  });
  applyMemorySlotFromChoice(s, makeTestEvent('weak-event'), 0, choice);
  assert('importance 2 → 슬롯 생성 안 됨', s.memorySlots.length === 0);
}

console.log('\n=== 5. ANNUAL 이벤트 슬롯 금지 (부록 B.4) ===');
{
  const s = setupState();
  const choice = makeChoice({
    category: 'warm' as never, importance: 7,
    recallText: '생일 축하',
  });
  applyMemorySlotFromChoice(s, makeTestEvent('minjae-birthday'), 0, choice);
  assert('ANNUAL(minjae-birthday) → 슬롯 생성 안 됨', s.memorySlots.length === 0);
  applyMemorySlotFromChoice(s, makeTestEvent('elementary-graduation'), 0, choice);
  assert('ANNUAL(elementary-graduation) → 슬롯 생성 안 됨', s.memorySlots.length === 0);
}

console.log('\n=== 6. 같은 sourceEventId 중복 방지 (B.2) ===');
{
  const s = setupState();
  const choice = makeChoice({
    category: 'courage', importance: 5, recallText: '처음 손을 든 날.',
  });
  applyMemorySlotFromChoice(s, makeTestEvent('single-event'), 0, choice);
  applyMemorySlotFromChoice(s, makeTestEvent('single-event'), 1, choice);
  assert('같은 이벤트 2회 호출 → 1개만 생성', s.memorySlots.length === 1);
}

console.log('\n=== 7. 카테고리 상한 2 + importance 교체 ===');
{
  const s = setupState();
  function addSlot(eventId: string, importance: number, year: number) {
    s.year = year;
    applyMemorySlotFromChoice(s, makeTestEvent(eventId), 0, makeChoice({
      category: 'growth', importance, recallText: `${eventId} text`,
    }));
  }
  addSlot('ev1', 5, 2);
  addSlot('ev2', 7, 3);
  assert('카테고리 2개 채움', s.memorySlots.filter(m => m.category === 'growth').length === 2);
  addSlot('ev3', 6, 4);
  // ev1 (importance 5)이 ev3 (6)에 의해 교체되어야 함
  const remaining = s.memorySlots.map(m => m.sourceEventId);
  assert(`낮은 importance(ev1) 교체 (남은: ${remaining.join(',')})`, !remaining.includes('ev1'));
  assert('새 슬롯(ev3) 추가됨', remaining.includes('ev3'));
  addSlot('ev4', 4, 5);  // importance 낮아 교체 안 됨
  assert('더 낮은 importance 거절', s.memorySlots.map(m => m.sourceEventId).includes('ev4') === false);
}

console.log('\n=== 8. selectMemorialHighlights — 정상 케이스 (5개 슬롯) ===');
{
  const s = setupState();
  const slots: Array<[string, MemorySlot['category'], number, number]> = [
    ['ev1', 'growth', 8, 3],
    ['ev2', 'failure', 7, 3],
    ['ev3', 'discovery', 9, 7],
    ['ev4', 'reconciliation', 6, 2],
    ['ev5', 'courage', 5, 1],
  ];
  for (const [id, cat, imp, yr] of slots) {
    s.year = yr;
    applyMemorySlotFromChoice(s, makeTestEvent(id), 0, makeChoice({
      category: cat, importance: imp, recallText: `${id} recall`,
    }));
  }
  const highlights = selectMemorialHighlights(s);
  assert(`5개 슬롯 → 3~5개 반환 (${highlights.length})`, highlights.length >= 3 && highlights.length <= 5);
  // 필수 카테고리(growth/discovery/failure) 최소 1개씩 포함 확인
  const recallTexts = highlights.map(h => h.recallText);
  assert('필수 카테고리 커버', recallTexts.some(t => t.includes('ev1')) || recallTexts.some(t => t.includes('ev2')) || recallTexts.some(t => t.includes('ev3')));
}

console.log('\n=== 9. selectMemorialHighlights — 슬롯 0개 폴백 ===');
{
  const s = setupState();
  s.year = 4;
  const highlights = selectMemorialHighlights(s);
  assert(`슬롯 0개 → 폴백 3+ 반환 (${highlights.length})`, highlights.length >= 3);
  assert('모두 isFallback=true', highlights.every(h => h.isFallback === true));
}

console.log('\n=== 10. selectMemorialHighlights — 슬롯 1개 + milestoneScene 승격 ===');
{
  const s = setupState();
  s.year = 3;
  applyMemorySlotFromChoice(s, makeTestEvent('solo'), 0, makeChoice({
    category: 'growth', importance: 9, recallText: '단 하나의 기억.',
  }));
  // milestone 1개 추가
  s.milestoneScenes.push({
    year: 2, sceneId: 'ms-y2', summaryText: '중1 요약', recordedAt: 48,
  });
  const highlights = selectMemorialHighlights(s);
  assert(`3개 이상 반환 (${highlights.length})`, highlights.length >= 3);
  const texts = highlights.map(h => h.recallText);
  assert('실제 슬롯 포함', texts.includes('단 하나의 기억.'));
  assert('milestoneScene 승격', texts.includes('중1 요약'));
}

console.log('\n=== 11. recordMilestoneForYear Y3 패턴 매칭 ===');
{
  const s = setupState();
  s.year = 3;
  // 민재 화해 + growth 조합 → Y3_PATTERNS[0] 매칭
  applyMemorySlotFromChoice(s, makeTestEvent('minjae-jealousy'), 1, makeChoice({
    category: 'reconciliation', importance: 6,
    recallText: "사과했더니 민재가 '알아'라고만 했다. 그걸로 충분했다.",
    npcIds: ['minjae'],
  }));
  applyMemorySlotFromChoice(s, makeTestEvent('middle-burnout'), 1, makeChoice({
    category: 'growth', importance: 8,
    recallText: '아무것도 안 한 날. 죄책감보다 숨이 먼저 돌아왔다.',
  }));
  recordMilestoneForYear(s, 3);
  assert('milestoneScene 1개 생성', s.milestoneScenes.length === 1);
  const ms = s.milestoneScenes[0];
  assert(`dominantTheme 'growth' (${ms.dominantTheme})`, ms.dominantTheme === 'growth');
  assert('summaryText = 경쟁과 번아웃', ms.summaryText === '경쟁과 번아웃 사이, 나를 붙잡아준 건 사람이었다.');
}

console.log('\n=== 12. recordMilestoneForYear 중복 방지 ===');
{
  const s = setupState();
  recordMilestoneForYear(s, 1);
  recordMilestoneForYear(s, 1);
  assert('Y1 중복 호출 → 1개만', s.milestoneScenes.filter(m => m.year === 1).length === 1);
}

console.log('\n=== 13. 하드위기 연간 1회 가드 — minjae-jealousy / middle-burnout 발동 조건 정의 ===');
{
  // GAME_EVENTS에 등록되어 있고, condition이 의도대로 동작하는지
  const jealousy = GAME_EVENTS.find(e => e.id === 'minjae-jealousy');
  const burnout = GAME_EVENTS.find(e => e.id === 'middle-burnout');
  assert('minjae-jealousy 등록됨', !!jealousy);
  assert('middle-burnout 등록됨', !!burnout);

  // minjae-jealousy 조건: Y2~Y3 & minjae 60+ & academic 55+
  let s = setupState();
  s.year = 3; s.stats.academic = 60;
  const minjae = s.npcs.find(n => n.id === 'minjae')!;
  minjae.met = true; minjae.intimacy = 65;
  assert('minjae-jealousy Y3 조건 충족', jealousy!.condition!(s));

  s.year = 4;
  assert('minjae-jealousy Y4에서는 미발동 (year 범위 밖)', !jealousy!.condition!(s));

  // middle-burnout 조건: Y3 & idleWeeks 4+ & mental 40-
  s = setupState();
  s.year = 3; s.idleWeeks = 5; s.stats.mental = 30;
  assert('middle-burnout Y3 조건 충족', burnout!.condition!(s));
  s.year = 4;
  assert('middle-burnout Y4에서는 미발동', !burnout!.condition!(s));
}

console.log('\n=== 14. calculateEnding 회상 레이어 반환 ===');
{
  const s = setupState();
  s.year = 7; s.week = 48;
  // 슬롯 2개 + milestone 2개
  s.memorySlots.push({
    id: 'growth_3_15_1', category: 'growth', week: 15, year: 3,
    sourceEventId: 'middle-burnout', choiceIndex: 1,
    recallText: '아무것도 안 한 날.', importance: 8, phaseTag: 'mid',
  });
  s.memorySlots.push({
    id: 'reconciliation_3_10_1', category: 'reconciliation', week: 10, year: 3,
    sourceEventId: 'minjae-jealousy', choiceIndex: 1,
    recallText: "민재가 '알아'라고만 했다.", importance: 6, phaseTag: 'mid',
    npcIds: ['minjae'],
  });
  s.milestoneScenes.push({
    year: 3, sceneId: 'milestone-y3',
    summaryText: '경쟁과 번아웃 사이, 나를 붙잡아준 건 사람이었다.',
    recordedAt: 48,
  });
  const ending = calculateEnding(s);
  assert('memorialHighlights 반환', Array.isArray(ending.memorialHighlights));
  assert(`memorialHighlights ≥3 (${ending.memorialHighlights.length})`, ending.memorialHighlights.length >= 3);
  assert('yearClosings 반환', Array.isArray(ending.yearClosings));
  assert(`yearClosings 1개 (Y3)`, ending.yearClosings.length === 1);
  assert('기존 필드 유지 (title)', typeof ending.title === 'string');
  assert('기존 필드 유지 (career)', typeof ending.career === 'string');
}

console.log('\n=== 15. 결정론적 엔딩 — 동일 seed 2회 계산 결과 동일 ===');
{
  function endingFromSeed(seed: number): string {
    let s = setupState();
    s.rngSeed = seed;
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'basketball';
    // 100주 플레이
    for (let i = 0; i < 100; i++) {
      s = processWeek(s);
      if (s.currentEvent) s.currentEvent = null;
      if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    }
    // 엔딩 강제 호출
    s.year = 7; s.week = 48;
    const e = calculateEnding(s);
    return JSON.stringify({
      highlights: e.memorialHighlights.map(h => h.recallText),
      years: e.yearClosings,
    });
  }
  const e1 = endingFromSeed(42);
  const e2 = endingFromSeed(42);
  assert('같은 시드 2회 → 엔딩 회상 동일', e1 === e2);
}

console.log('\n=== 16. year-end phase 전환 (M3.5) ===');
{
  // 48주 후 year-end phase로 전환되는지, Y7은 바로 ending인지
  let s = setupState();
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'basketball';
  // Y1 끝까지 주차 돌림. W48에 이벤트가 뜨면 엔진이 학년 전환을 resolve 시점까지 미루므로
  // (gameEngine.applyYearTransition 주석 참조), 실게임의 resolveEvent 대신 여기서 수동 전환한다.
  for (let i = 0; i < 48; i++) {
    s = processWeek(s);
    if (s.currentEvent) {
      s.currentEvent = null;
      if (s.week > 48) applyYearTransition(s);
    }
  }
  assert('Y1 끝: phase === year-end', s.phase === 'year-end');
  assert('Y1 끝: year === 1 유지 (아직 증가 안 됨)', s.year === 1);
  assert('Y1 끝: milestone 자동 기록됨', s.milestoneScenes.some(m => m.year === 1));
}

console.log('\n=== 17. Y7 끝 — year-end 스킵하고 바로 ending ===');
{
  let s = setupState();
  s.year = 7;
  s.week = 48;
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'basketball';
  s = processWeek(s);
  // W48 이벤트로 미뤄진 학년 전환을 수동 처리 (실게임은 resolveEvent가 담당)
  if (s.currentEvent) {
    s.currentEvent = null;
    if (s.week > 48) applyYearTransition(s);
  }
  assert(`Y7 W48 처리 후 phase === ending (실제: ${s.phase})`, s.phase === 'ending');
  assert('Y7 milestone 자동 기록됨', s.milestoneScenes.some(m => m.year === 7));
}

console.log('\n=== 18. selectRegretHighlights (후회카드) ===');
{
  const mkSlot = (over: Partial<MemorySlot>): MemorySlot => ({
    id: over.id ?? 's',
    category: over.category ?? 'failure',
    week: 1, year: over.year ?? 3,
    sourceEventId: over.sourceEventId ?? 'ev',
    choiceIndex: 0,
    recallText: over.recallText ?? '후회 문장',
    npcIds: over.npcIds,
    importance: over.importance ?? 5,
    phaseTag: over.phaseTag ?? 'mid',
    toneTag: over.toneTag,
  });

  // 18.1 빈 슬롯 → 0장 (폴백 없음)
  {
    const s = setupState();
    s.memorySlots = [];
    assert('빈 슬롯 → 0장 (폴백 없음)', selectRegretHighlights(s).length === 0);
  }

  // 18.2 긍정 슬롯만 → 0장 (후회 풀 미포함)
  {
    const s = setupState();
    s.memorySlots = [
      mkSlot({ id: 'p1', category: 'growth', toneTag: 'warm', recallText: '좋은 기억' }),
      mkSlot({ id: 'p2', category: 'discovery', toneTag: 'breakthrough', recallText: '깨달음' }),
    ];
    assert('긍정 슬롯만 → 0장', selectRegretHighlights(s).length === 0);
  }

  // 18.3 regret 톤 1개 → 본문 1 + 화해 마감 = 2장, 마지막 isClosing
  {
    const s = setupState();
    s.memorySlots = [mkSlot({ id: 'r1', category: 'failure', toneTag: 'regret', recallText: '책상 위 얼룩' })];
    const r = selectRegretHighlights(s);
    assert('regret 1개 → 2장(본문1+화해)', r.length === 2);
    assert('마지막 장 isClosing', r[r.length - 1].isClosing === true);
    assert('본문은 슬롯 recallText', r[0].recallText === '책상 위 얼룩');
  }

  // 18.4 betrayal 카테고리(톤 없음)도 후회 풀
  {
    const s = setupState();
    s.memorySlots = [mkSlot({ id: 'b1', category: 'betrayal', toneTag: undefined, recallText: '먼저 돌아섰다' })];
    assert('betrayal 카테고리 → 후회 풀 포함',
      selectRegretHighlights(s).some(h => h.recallText === '먼저 돌아섰다'));
  }

  // 18.5 이중 노출 방지 — excludeTexts 제외
  {
    const s = setupState();
    s.memorySlots = [mkSlot({ id: 'd1', category: 'failure', toneTag: 'regret', recallText: '중복 문장' })];
    assert('회고가 인용한 문장 제외 → 0장',
      selectRegretHighlights(s, new Set(['중복 문장'])).length === 0);
  }

  // 18.6 본문 최대 2장 + 학년 분산
  {
    const s = setupState();
    s.memorySlots = [
      mkSlot({ id: 'm1', category: 'failure', toneTag: 'regret', phaseTag: 'early', importance: 8, recallText: 'a' }),
      mkSlot({ id: 'm2', category: 'betrayal', toneTag: 'regret', phaseTag: 'mid', importance: 7, recallText: 'b' }),
      mkSlot({ id: 'm3', category: 'failure', toneTag: 'melancholy', phaseTag: 'late', importance: 6, recallText: 'c' }),
    ];
    const r = selectRegretHighlights(s);
    assert('후회 본문 최대 2장 (+화해 = 3)', r.length === 3);
    assert('본문 2장 서로 다른 phaseTag', r[0].recallText !== r[1].recallText);
  }

  // 18.7 드리프트 가산 — 멀어진 NPC 슬롯 우선
  {
    const s = setupState();
    const drifted = s.npcs[0];
    drifted.met = true; drifted.intimacy = 10;
    s.memorySlots = [
      mkSlot({ id: 'plain', category: 'failure', toneTag: 'regret', importance: 7, recallText: '일반 후회' }),
      mkSlot({ id: 'drift', category: 'betrayal', toneTag: 'regret', importance: 6, npcIds: [drifted.id], recallText: '멀어진 관계' }),
    ];
    // 드리프트(+1.5) → 6+1.5=7.5 가 일반 7 을 앞섬
    assert('드리프트 관계 슬롯이 먼저 선발',
      selectRegretHighlights(s)[0].recallText === '멀어진 관계');
  }

  // 18.8 같은 recallText 슬롯 2개 → 본문 1장만(중복 노출 방지) + 화해
  {
    const s = setupState();
    s.memorySlots = [
      mkSlot({ id: 'dup1', category: 'failure', toneTag: 'regret', phaseTag: 'early', recallText: '같은 문장' }),
      mkSlot({ id: 'dup2', category: 'betrayal', toneTag: 'regret', phaseTag: 'late', recallText: '같은 문장' }),
    ];
    const r = selectRegretHighlights(s);
    const body = r.filter(h => !h.isClosing);
    assert('동일 recallText 중복 노출 방지 → 본문 1장', body.length === 1);
    assert('화해 마감은 그대로 1장', r.some(h => h.isClosing));
  }

  // 18.9 화해 마감 문구 — 또래 전제("그 애") 표현 없음(부모·자기 슬롯 호환)
  {
    const s = setupState();
    s.memorySlots = [mkSlot({ id: 'c1', category: 'failure', toneTag: 'regret', recallText: '혼자 앓던 밤' })];
    const closing = selectRegretHighlights(s).find(h => h.isClosing);
    assert('화해 마감에 "그 애" 또래 전제 표현 없음', !closing?.recallText.includes('그 애'));
  }
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
