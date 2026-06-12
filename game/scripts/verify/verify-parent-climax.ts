// Phase 4B 검증 — 강점별 "절정 순간" (트리거·1회 가드·구제 발동·스탯 절제·4A 연동)
//
// 범위:
//  C1. 트리거 — 친밀도 게이트(≥60) AND 긍정 태그 누적(≥2) AND year≥climaxYearMin 모두 충족 시만 발동
//  C2. 1회 가드 — parentClimaxFired에 있으면 재발동 안 됨
//  C3. 구제 발동창 — 고3(Y7) 수능 후(week≥36) 미발동분은 누적 무시, pi≥45면 발동 / pi<45(distant 근처)는 미발동
//  C4. 스탯 절제 — strict만 멘탈 +2, 나머지 5축 스탯 0. 6축 모두 친밀도 직접 가산 없음(effects.parentIntimacy 없음)
//  C5. 4A 연동 — 절정 본 강점은 warm 비트가 warmSeen 콜백으로 교체. 못 본 강점/normal/distant는 불변
//  C6. 태그 적립 — applyParentIntimacyDelta(baseDelta>0)만 parentPositiveTags 증가, 음수는 증가 안 함
//  C7. 화자 SSOT — 절정 description에 반대 화자 미등장
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-climax.ts

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
import { calculateEnding } from '../../src/engine/ending';
import { getEligibleParentClimax } from '../../src/engine/talkSystem';
import { applyParentIntimacyDelta } from '../../src/engine/parentIntimacy';
import { PARENT_CLIMAX_EVENTS } from '../../src/engine/talkData';
import type { GameState, ParentStrength } from '../../src/engine/types';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const TRIGGER: Record<ParentStrength, string> = {
  emotional: 'shareWorry', resilience: 'recoveryAction', info: 'careerTalk',
  freedom: 'autonomyChoice', strict: 'gradeImprove', wealth: 'familyTime',
};
const SPEAKER: Record<ParentStrength, '엄마' | '아빠'> = {
  emotional: '엄마', info: '엄마', resilience: '엄마', freedom: '엄마',
  wealth: '아빠', strict: '아빠',
};
const YEARMIN: Record<ParentStrength, number> = {
  emotional: 2, resilience: 3, info: 4, freedom: 4, strict: 4, wealth: 5,
};

// strength를 첫 부모로, 트리거 안 겹치는 파트너를 둘째로(파트너 yearMin 높아 조기 미발동).
function partnerFor(s: ParentStrength): ParentStrength {
  return s === 'wealth' ? 'emotional' : 'wealth';
}
function stateFor(s: ParentStrength, o: { pi: number; tag: number; year: number; week?: number; fired?: ParentStrength[] }): GameState {
  const base = createInitialState('male', [s, partnerFor(s)]);
  return {
    ...base,
    parentIntimacy: o.pi,
    parentPositiveTags: { [TRIGGER[s]]: o.tag },
    parentClimaxFired: o.fired ?? [],
    year: o.year,
    week: o.week ?? 10,
  } as GameState;
}
const STRENGTHS = Object.keys(TRIGGER) as ParentStrength[];

// ---- C1: 트리거 게이트 ----
console.log('C1. 트리거 — 친밀도≥60 AND 태그≥2 AND year≥yearMin');
for (const s of STRENGTHS) {
  const ym = YEARMIN[s];
  check(`${s}: 충족 → 발동`, getEligibleParentClimax(stateFor(s, { pi: 65, tag: 2, year: ym }))?.parentStrength === s);
  check(`${s}: 친밀도<60 → 미발동`, getEligibleParentClimax(stateFor(s, { pi: 59, tag: 5, year: ym })) === null);
  check(`${s}: 태그<2 → 미발동`, getEligibleParentClimax(stateFor(s, { pi: 80, tag: 1, year: ym })) === null);
  check(`${s}: year<yearMin → 미발동`, getEligibleParentClimax(stateFor(s, { pi: 80, tag: 5, year: ym - 1 })) === null);
}

// ---- C2: 1회 가드 ----
console.log('C2. 1회 가드 — 이미 발동한 강점은 재발동 안 됨');
for (const s of STRENGTHS) {
  check(`${s}: fired면 미발동`, getEligibleParentClimax(stateFor(s, { pi: 90, tag: 9, year: 7, fired: [s] })) === null);
}

// ---- C3: 구제 발동창 ----
console.log('C3. 구제 발동 — 고3 수능 후 누적 무시, pi≥45만');
for (const s of STRENGTHS) {
  check(`${s}: Y7 W38 tag0 pi50 → 구제 발동`, getEligibleParentClimax(stateFor(s, { pi: 50, tag: 0, year: 7, week: 38 }))?.parentStrength === s);
  check(`${s}: Y7 W38 tag0 pi40 → 미발동(distant)`, getEligibleParentClimax(stateFor(s, { pi: 40, tag: 0, year: 7, week: 38 })) === null);
  check(`${s}: Y7 W30(수능 전) tag0 → 구제 아님 → 미발동`, getEligibleParentClimax(stateFor(s, { pi: 50, tag: 0, year: 7, week: 30 })) === null);
}

// ---- C4: 스탯 절제 + 친밀도 직접 가산 없음 ----
console.log('C4. 스탯 — strict만 멘탈 +2, 나머지 0 / 친밀도 직접 가산 없음');
for (const c of PARENT_CLIMAX_EVENTS) {
  const mental = c.effects.stats?.mental ?? 0;
  if (c.parentStrength === 'strict') check('strict 멘탈 +2', mental === 2, `mental=${mental}`);
  else check(`${c.parentStrength} 스탯 0`, mental === 0 && !c.effects.stats, `mental=${mental}`);
  check(`${c.parentStrength} 친밀도 직접 가산 없음`, c.effects.parentIntimacy == null);
  check(`${c.parentStrength} 선택지 없음(단일 컷)`, !c.choices);
  check(`${c.parentStrength} 회상 슬롯 importance 5`, c.memorySlotDraft?.importance === 5);
}

// ---- C5: 4A 연동 (warmSeen 콜백) ----
console.log('C5. 4A 연동 — 절정 본 강점은 warm→warmSeen, 못 본 강점/normal/distant 불변');
for (const s of STRENGTHS) {
  const base = createInitialState('male', [s, partnerFor(s)]);
  const warmNotSeen = calculateEnding({ ...base, parentIntimacy: 90, parentClimaxFired: [] } as GameState)
    .parentEpilogue.beats.find(b => b.strength === s)?.text ?? '';
  const warmSeen = calculateEnding({ ...base, parentIntimacy: 90, parentClimaxFired: [s] } as GameState)
    .parentEpilogue.beats.find(b => b.strength === s)?.text ?? '';
  check(`${s}: warm — 절정 보면 비트가 바뀜`, warmNotSeen !== warmSeen, `same: ${warmSeen}`);
  // normal tier는 절정 발동 여부와 무관하게 동일
  const normalNotSeen = calculateEnding({ ...base, parentIntimacy: 50, parentClimaxFired: [] } as GameState)
    .parentEpilogue.beats.find(b => b.strength === s)?.text ?? '';
  const normalSeen = calculateEnding({ ...base, parentIntimacy: 50, parentClimaxFired: [s] } as GameState)
    .parentEpilogue.beats.find(b => b.strength === s)?.text ?? '';
  check(`${s}: normal — 절정 여부 무관 동일`, normalNotSeen === normalSeen);
}

// ---- C6: 태그 적립 ----
console.log('C6. 태그 적립 — 긍정(baseDelta>0)만 누적');
{
  const st = createInitialState('male', ['emotional', 'wealth']);
  applyParentIntimacyDelta(st, 1.5, 'shareWorry');
  applyParentIntimacyDelta(st, 1.5, 'shareWorry');
  applyParentIntimacyDelta(st, -1.0, 'hideProblem');
  check('shareWorry 2회 누적', (st.parentPositiveTags?.shareWorry ?? 0) === 2, `${st.parentPositiveTags?.shareWorry}`);
  check('hideProblem(음수) 미누적', (st.parentPositiveTags?.hideProblem ?? 0) === 0);
}

// ---- C7: 화자 SSOT ----
console.log('C7. 화자 SSOT — 절정 description에 반대 화자 미등장');
for (const c of PARENT_CLIMAX_EVENTS) {
  const wrong = SPEAKER[c.parentStrength] === '엄마' ? '아빠' : '엄마';
  check(`${c.parentStrength} description에 '${wrong}' 미등장`, !c.description.includes(wrong), c.description.slice(0, 30));
}

console.log(`\n강점별 절정 검증: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
