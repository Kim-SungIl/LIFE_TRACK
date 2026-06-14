// Phase 4C 검증 — 부모 진로 갈등 이벤트 (고1~2, info/strict)
//
// 범위:
//  K1. 발동 게이트 — Y5 W15 / Y6 W6(track), 강점별 올바른 이벤트 선택. 미보유·track 미정·비대상 강점은 미발동
//  K2. info/strict 동시 보유 → strict arc 우선(info는 !strict 게이트)
//  K3. 화자 SSOT — strict 이벤트에 '엄마' 미등장, info 이벤트에 '아빠' 미등장(description+choices)
//  K4. parentEffect 적용 — resolveEvent가 친밀도 이동 + actedWithParentThisWeek + 긍정 태그 적립(4B 시너지)
//  K5. 회상 슬롯 — 선택 시 importance 5 슬롯 1개 생성
//  K6. 태그 정합성 — 순응(keepPromise/careerTalk +) · 내 길(breakPromise/ignoreAdvice −) · 설득(autonomyChoice +)
//  K7. 스탯 퍼주기 금지 — 선택 effects는 작은 멘탈/학업만(|mental|≤2,|academic|≤1), parentIntimacy 직접 가산 없음
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-career.ts

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

import { createInitialState } from '../../src/engine/gameEngine';
import { getEventForWeek } from '../../src/engine/events';
import { CAREER_CONFLICT_EVENTS } from '../../src/engine/events/parent-career';
import { useGameStore } from '../../src/engine/store';
import type { GameState, ParentStrength, Track } from '../../src/engine/types';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function st(parents: [ParentStrength, ParentStrength], year: number, week: number, track: Track | null = null): GameState {
  return { ...createInitialState('male', parents), year, week, track } as GameState;
}
function pickedId(s: GameState): string | undefined {
  return getEventForWeek(s).event?.id;
}

// ---- K1: 발동 게이트 ----
console.log('K1. 발동 게이트 (Y5 W15 / Y6 W6+track)');
check('strict Y5W15 → strict-y5', pickedId(st(['strict', 'emotional'], 5, 15)) === 'career-conflict-strict-y5');
check('info-only Y5W15 → info-y5', pickedId(st(['info', 'emotional'], 5, 15)) === 'career-conflict-info-y5');
check('strict Y6W6 track=문 → strict-y6', pickedId(st(['strict', 'emotional'], 6, 6, 'humanities')) === 'career-conflict-strict-y6');
check('info Y6W6 track=이 → info-y6', pickedId(st(['info', 'emotional'], 6, 6, 'science')) === 'career-conflict-info-y6');
check('Y6W6 track 미정 → 미발동', pickedId(st(['strict', 'emotional'], 6, 6, null)) !== 'career-conflict-strict-y6');
check('비대상 강점(emotional/freedom) Y5W15 → 진로갈등 미발동',
  !(pickedId(st(['emotional', 'freedom'], 5, 15)) ?? '').startsWith('career-conflict'));
check('strict Y5W14(엉뚱 주차) → 미발동', pickedId(st(['strict', 'emotional'], 5, 14)) !== 'career-conflict-strict-y5');

// ---- K2: info+strict → strict 우선 ----
console.log('K2. info+strict 동시 보유 → strict arc 우선');
check('both Y5W15 → strict-y5', pickedId(st(['info', 'strict'], 5, 15)) === 'career-conflict-strict-y5');
check('both Y6W6 → strict-y6', pickedId(st(['info', 'strict'], 6, 6, 'science')) === 'career-conflict-strict-y6');

// ---- K3: 화자 SSOT ----
console.log('K3. 화자 SSOT (strict=아빠 / info=엄마)');
for (const e of CAREER_CONFLICT_EVENTS) {
  const isStrict = e.id.includes('strict');
  const wrong = isStrict ? '엄마' : '아빠';
  const text = e.description + ' ' + e.choices.map(c => c.text + ' ' + c.message).join(' ');
  check(`${e.id}에 '${wrong}' 미등장`, !text.includes(wrong));
}

// ---- K6: 태그 정합성 + K7: 스탯 절제 ----
console.log('K6/K7. 태그 정합성 + 스탯 퍼주기 금지');
for (const e of CAREER_CONFLICT_EVENTS) {
  const [comply, ownWay, persuade] = e.choices;
  const isStrict = e.id.includes('strict');
  check(`${e.id} 순응 = ${isStrict ? 'keepPromise' : 'careerTalk'}(+)`,
    comply.parentEffect?.tag === (isStrict ? 'keepPromise' : 'careerTalk') && (comply.parentEffect?.baseDelta ?? 0) > 0);
  check(`${e.id} 내 길 = ${isStrict ? 'breakPromise' : 'ignoreAdvice'}(−)`,
    ownWay.parentEffect?.tag === (isStrict ? 'breakPromise' : 'ignoreAdvice') && (ownWay.parentEffect?.baseDelta ?? 0) < 0);
  check(`${e.id} 설득 = autonomyChoice(+)`,
    persuade.parentEffect?.tag === 'autonomyChoice' && (persuade.parentEffect?.baseDelta ?? 0) > 0);
  for (const c of e.choices) {
    const m = c.effects.mental ?? 0;
    const a = c.effects.academic ?? 0;
    check(`${e.id} "${c.text.slice(0, 8)}" 스탯 절제(|mental|≤2,|academic|≤1)`, Math.abs(m) <= 2 && Math.abs(a) <= 1);
    // parentIntimacy는 effects(가시 스탯)가 아니라 parentEffect로만 — effects에 parentIntimacy 키 없음
    check(`${e.id} "${c.text.slice(0, 8)}" 친밀도 직접 가산 없음`, !('parentIntimacy' in c.effects));
  }
}

// ---- K4/K5: resolveEvent 실경유 (parentEffect·회상·면제·태그 적립) ----
console.log('K4/K5. resolveEvent 실경유 (친밀도·회상·태그 적립)');
function resolve(parents: [ParentStrength, ParentStrength], eventId: string, choiceIdx: number, year = 5, week = 15, track: Track | null = null) {
  const base = st(parents, year, week, track);
  const ev = CAREER_CONFLICT_EVENTS.find(e => e.id === eventId)!;
  useGameStore.setState({ state: { ...base, parentIntimacy: 55, currentEvent: ev, phase: 'event' } as GameState });
  useGameStore.getState().resolveEvent(choiceIdx);
  return useGameStore.getState().state!;
}
{
  // strict-y5 순응(keepPromise +) → 친밀도 상승 + actedWithParent + keepPromise 적립
  const r = resolve(['strict', 'emotional'], 'career-conflict-strict-y5', 0);
  check('strict 순응 → 친밀도 상승', (r.parentIntimacy ?? 50) > 55, `pi=${r.parentIntimacy}`);
  check('strict 순응 → actedWithParentThisWeek', r.actedWithParentThisWeek === true);
  check('strict 순응 → keepPromise 적립', (r.parentPositiveTags?.keepPromise ?? 0) === 1);
  check('strict 순응 → 회상 슬롯 importance5 생성', r.memorySlots.some(m => m.sourceEventId === 'career-conflict-strict-y5' && m.importance === 5));
}
{
  // strict-y5 내 길(breakPromise −) → 친밀도 하락, 긍정 태그 미적립
  const r = resolve(['strict', 'emotional'], 'career-conflict-strict-y5', 1);
  check('strict 내 길 → 친밀도 하락', (r.parentIntimacy ?? 50) < 55, `pi=${r.parentIntimacy}`);
  check('strict 내 길 → breakPromise 긍정 미적립', (r.parentPositiveTags?.breakPromise ?? 0) === 0);
}
{
  // info-y5 설득(autonomyChoice +) → 친밀도 상승 + autonomyChoice 적립(4B freedom과 별개 카운터 공유 확인)
  const r = resolve(['info', 'emotional'], 'career-conflict-info-y5', 2);
  check('info 설득 → 친밀도 상승', (r.parentIntimacy ?? 50) > 55, `pi=${r.parentIntimacy}`);
  check('info 설득 → autonomyChoice 적립', (r.parentPositiveTags?.autonomyChoice ?? 0) === 1);
}

console.log(`\n부모 진로 갈등 검증: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
