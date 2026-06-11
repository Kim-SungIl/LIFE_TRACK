// Phase 4A 검증 — 엔딩 부모 에필로그 (parentIntimacy tier × 강점별 회고)
//
// 범위:
//  E1. tier 경계 — pi<30 distant / 30~69 normal / ≥70 warm (talkSystem.getParentIntimacyTone과 동일)
//  E2. beats — 두 부모 강점 각각에 tier별 회고가 매칭(strength 키 일치), 개수 = parents 수
//  E3. 화자 SSOT — 엄마(emotional/info/resilience/freedom) beat에 '아빠' 미등장, 아빠(wealth/strict)에 '엄마' 미등장
//  E4. intro — tier 3종이 서로 다른 문구
//  E5. 진로 불변 — parentIntimacy를 바꿔도 career(진로 결과)는 동일(스탯 퍼주기 금지 확인)
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-ending.ts

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
import type { GameState, ParentStrength } from '../../src/engine/types';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function endingFor(parents: [ParentStrength, ParentStrength], pi: number, extra: Partial<GameState> = {}) {
  const base = createInitialState('male', parents);
  return calculateEnding({ ...base, parentIntimacy: pi, ...extra } as GameState);
}

const STRENGTHS: ParentStrength[] = ['emotional', 'wealth', 'info', 'strict', 'resilience', 'freedom'];
const SPEAKER: Record<ParentStrength, '엄마' | '아빠'> = {
  emotional: '엄마', info: '엄마', resilience: '엄마', freedom: '엄마',
  wealth: '아빠', strict: '아빠',
};

// ---- E1: tier 경계 ----
console.log('E1. tier 경계 (distant<30 / normal 30~69 / warm≥70)');
check('pi=29 → distant', endingFor(['emotional', 'strict'], 29).parentEpilogue.tier === 'distant');
check('pi=30 → normal', endingFor(['emotional', 'strict'], 30).parentEpilogue.tier === 'normal');
check('pi=69 → normal', endingFor(['emotional', 'strict'], 69).parentEpilogue.tier === 'normal');
check('pi=70 → warm', endingFor(['emotional', 'strict'], 70).parentEpilogue.tier === 'warm');
check('pi=0 → distant', endingFor(['emotional', 'strict'], 0).parentEpilogue.tier === 'distant');
check('pi=100 → warm', endingFor(['emotional', 'strict'], 100).parentEpilogue.tier === 'warm');

// ---- E2: beats 강점 매칭 ----
console.log('E2. beats — 두 부모 강점에 tier별 회고 매칭');
{
  const epi = endingFor(['wealth', 'freedom'], 80).parentEpilogue;
  check('beats 개수 = 2', epi.beats.length === 2, `len=${epi.beats.length}`);
  check('beats에 wealth 포함', epi.beats.some(b => b.strength === 'wealth'));
  check('beats에 freedom 포함', epi.beats.some(b => b.strength === 'freedom'));
  check('각 beat 텍스트 비어있지 않음', epi.beats.every(b => b.text.length > 0));
}

// ---- E3: 화자 SSOT (모든 강점 × 모든 tier) ----
console.log('E3. 화자 SSOT — 강점별 beat에 반대 화자 미등장');
for (const s of STRENGTHS) {
  const wrong = SPEAKER[s] === '엄마' ? '아빠' : '엄마';
  for (const pi of [10, 50, 90]) {
    const epi = endingFor([s, s], pi).parentEpilogue;
    const beat = epi.beats.find(b => b.strength === s)?.text ?? '';
    check(`${s}(pi=${pi}) beat에 '${wrong}' 미등장`, !beat.includes(wrong), beat);
  }
}

// ---- E4: intro tier별 상이 ----
console.log('E4. intro — tier 3종 문구 상이');
{
  const d = endingFor(['info', 'resilience'], 10).parentEpilogue.intro;
  const n = endingFor(['info', 'resilience'], 50).parentEpilogue.intro;
  const w = endingFor(['info', 'resilience'], 90).parentEpilogue.intro;
  check('distant/normal/warm intro 모두 다름', d !== n && n !== w && d !== w, `${d} | ${n} | ${w}`);
  check('intro 비어있지 않음', d.length > 0 && n.length > 0 && w.length > 0);
}

// ---- E5: 진로 불변 (스탯 퍼주기 금지) ----
console.log('E5. parentIntimacy를 바꿔도 진로(career) 불변');
{
  const low = endingFor(['emotional', 'strict'], 10);
  const high = endingFor(['emotional', 'strict'], 95);
  check('career 동일', low.career === high.career, `${low.career} vs ${high.career}`);
  check('achievement 동일', low.achievement === high.achievement);
}

console.log(`\n엔딩 부모 에필로그 검증: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
