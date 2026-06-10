// Phase 3(부분) 검증 — 부모 잡담 학교급별 톤 분기
//
// 범위:
//  S1. PARENT_SMALLTALK 6강점 모두 elementary/middle/high/senior 풀이 비어있지 않음(콘텐츠 완비)
//  S2. getHomeSmalltalk(Y1) — common+elementary만 등장, middle/high/senior 미등장
//  S3. getHomeSmalltalk(Y3=중2) — common+middle만, elementary/high/senior 미등장
//  S4. getHomeSmalltalk(Y5=고1) — common+high만, senior 미등장(고1≠고3)
//  S5. getHomeSmalltalk(Y7=고3, week=1) — common+high+senior+seniorEarly 등장, elementary/middle 미등장
//  S6. 학교급 간 비중복 라인은 실제로 톤이 갈림(초6 strict "숙제" vs 고3 strict "닦달")
//  S7. 강점별 화자(엄마/아빠) SSOT 일관성 — 반대 화자 미등장
//  S8. 고3 입시 시점별 senior 풀 분기 (early≤27 / rush 28~35 / after≥36, 수능=35주차)
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-smalltalk-school.ts

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
import { getHomeSmalltalk } from '../../src/engine/talkSystem';
import { PARENT_SMALLTALK } from '../../src/engine/talkData';
import type { GameState, ParentStrength } from '../../src/engine/types';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const STRENGTHS: ParentStrength[] = ['emotional', 'wealth', 'info', 'strict', 'resilience', 'freedom'];
const LEVELS = ['elementary', 'middle', 'high', 'senior', 'seniorEarly', 'seniorRush', 'seniorAfter'] as const;

// ---- S1: 콘텐츠 완비 ----
console.log('S1. 6강점 × (elementary/middle/high/senior/seniorEarly/seniorRush/seniorAfter) 풀 완비');
for (const s of STRENGTHS) {
  const pool = PARENT_SMALLTALK[s];
  for (const lvl of LEVELS) {
    const cell = pool[lvl] ?? [];
    check(`${s}.${lvl} 비어있지 않음`, cell.length > 0, `len=${cell.length}`);
  }
}

// getHomeSmalltalk을 여러 번 호출해 등장 라인 수집(seededRandom이 rngSeed를 진행시키므로 풀 커버).
function collectLines(parents: [ParentStrength, ParentStrength], year: number, week = 1, iters = 4000): Set<string> {
  const base = createInitialState('male', parents);
  const state: GameState = { ...base, year, week };
  const seen = new Set<string>();
  for (let i = 0; i < iters; i++) {
    seen.add(getHomeSmalltalk(state));
  }
  return seen;
}

// 단일 강점 풀 검증을 위해 두 부모를 같은 강점으로 두면(엔진상 부모는 서로 다른 2개지만,
// 풀 합집합 로직 검증엔 동일 강점 중복이 허용됨 — getHomeSmalltalk은 parents 배열을 그대로 flatMap)
function poolOf(s: ParentStrength, lvl: typeof LEVELS[number]): string[] {
  return PARENT_SMALLTALK[s][lvl] ?? [];
}
function commonOf(s: ParentStrength): string[] {
  return PARENT_SMALLTALK[s].common ?? [];
}

// strict 단일 강점으로 학년별 분기 검증 (parents에 strict 2번 — flatMap은 중복 풀이지만 라인 집합은 동일)
const S = 'strict' as const;

console.log('S2. Y1(초6) — common+elementary만');
{
  const lines = collectLines([S, S], 1);
  const elem = new Set(poolOf(S, 'elementary'));
  const common = new Set(commonOf(S));
  const mid = poolOf(S, 'middle');
  const high = poolOf(S, 'high');
  const senior = poolOf(S, 'senior');
  for (const l of lines) check('Y1 라인은 common∪elementary 소속', common.has(l) || elem.has(l), l);
  check('Y1에 middle 미등장', mid.every(l => !lines.has(l)));
  check('Y1에 high 미등장', high.every(l => !lines.has(l)));
  check('Y1에 senior 미등장', senior.every(l => !lines.has(l)));
}

console.log('S3. Y3(중2) — common+middle만');
{
  const lines = collectLines([S, S], 3);
  const mid = new Set(poolOf(S, 'middle'));
  const common = new Set(commonOf(S));
  for (const l of lines) check('Y3 라인은 common∪middle 소속', common.has(l) || mid.has(l), l);
  check('Y3에 elementary 미등장', poolOf(S, 'elementary').every(l => !lines.has(l)));
  check('Y3에 high 미등장', poolOf(S, 'high').every(l => !lines.has(l)));
  check('Y3에 senior 미등장', poolOf(S, 'senior').every(l => !lines.has(l)));
}

console.log('S4. Y5(고1) — common+high만, senior 미등장');
{
  const lines = collectLines([S, S], 5);
  const high = new Set(poolOf(S, 'high'));
  const common = new Set(commonOf(S));
  for (const l of lines) check('Y5 라인은 common∪high 소속', common.has(l) || high.has(l), l);
  check('Y5에 senior 미등장(고1≠고3)', poolOf(S, 'senior').every(l => !lines.has(l)));
  check('Y5에 elementary 미등장', poolOf(S, 'elementary').every(l => !lines.has(l)));
}

console.log('S5. Y7(고3, week=1=early) — common+high+senior+seniorEarly 등장, elementary/middle 미등장');
{
  const lines = collectLines([S, S], 7, 1);
  const senior = poolOf(S, 'senior');
  check('Y7에 senior(시점무관) 라인 실제 등장', senior.some(l => lines.has(l)));
  check('Y7 week1에 seniorEarly 등장', poolOf(S, 'seniorEarly').some(l => lines.has(l)));
  check('Y7 week1에 seniorRush 미등장', poolOf(S, 'seniorRush').every(l => !lines.has(l)));
  check('Y7 week1에 seniorAfter 미등장', poolOf(S, 'seniorAfter').every(l => !lines.has(l)));
  check('Y7에 high 라인 등장', poolOf(S, 'high').some(l => lines.has(l)));
  check('Y7에 elementary 미등장', poolOf(S, 'elementary').every(l => !lines.has(l)));
  check('Y7에 middle 미등장', poolOf(S, 'middle').every(l => !lines.has(l)));
}

console.log('S6. 초6 vs 고3 톤이 실제로 갈림');
{
  const y1 = collectLines([S, S], 1);
  const y7 = collectLines([S, S], 7);
  // 초6엔 "숙제" 닦달, 고3엔 "이제 와서 닦달 안 한다" — 교집합이 common 외엔 없어야
  const common = new Set(commonOf(S));
  const onlyY1 = [...y1].filter(l => !common.has(l) && !y7.has(l));
  const onlyY7 = [...y7].filter(l => !common.has(l) && !y1.has(l));
  check('초6 전용 라인 존재', onlyY1.length > 0, `n=${onlyY1.length}`);
  check('고3 전용 라인 존재', onlyY7.length > 0, `n=${onlyY7.length}`);
  check('초6 strict에 "숙제" 닦달 포함', [...y1].some(l => l.includes('숙제')));
  check('고3 strict에 "닦달 안 한다" 포함', [...y7].some(l => l.includes('닦달 안 한다')));
}

// ---- S7: 화자(엄마/아빠) 일관성 ----
// 미니이벤트(talk_parent_*) 기준 강점별 화자 SSOT: 한 강점 풀에 반대 화자가 섞이면
// getHomeSmalltalk이 통째로 섞어 뽑을 때 한 부모 목소리가 오락가락한다(단독 부모면 즉시 드러남).
console.log('S7. 강점별 화자 SSOT 일관성 (엄마: emotional/info/resilience/freedom, 아빠: wealth/strict)');
const SPEAKER: Record<ParentStrength, '엄마' | '아빠'> = {
  emotional: '엄마', info: '엄마', resilience: '엄마', freedom: '엄마',
  wealth: '아빠', strict: '아빠',
};
for (const s of STRENGTHS) {
  const pool = PARENT_SMALLTALK[s];
  const allLines = [
    ...(pool.common ?? []), ...(pool.elementary ?? []), ...(pool.middle ?? []),
    ...(pool.high ?? []), ...(pool.senior ?? []),
    ...(pool.seniorEarly ?? []), ...(pool.seniorRush ?? []), ...(pool.seniorAfter ?? []),
  ];
  const wrong = SPEAKER[s] === '엄마' ? '아빠' : '엄마';
  const violators = allLines.filter(l => l.includes(wrong));
  check(`${s} 풀에 반대 화자('${wrong}') 미등장`, violators.length === 0,
    violators.length ? violators.join(' / ') : '');
}

// ---- S8: 고3 입시 시점별 senior 풀 분기 ----
// senior(시점 무관)는 세 시점 모두 노출, seniorEarly/Rush/After는 해당 시점에만.
// "수능 끝나면"·"수시 카드" 같은 시점 의존 대사가 봄(early)에 새지 않아야 함.
console.log('S8. 고3 입시 시점별 senior 분기 (early week≤27 / rush 28~35 / after≥36)');
{
  const early = collectLines([S, S], 7, 10);
  const rush = collectLines([S, S], 7, 30);
  const after = collectLines([S, S], 7, 40);
  const sE = poolOf(S, 'seniorEarly');
  const sR = poolOf(S, 'seniorRush');
  const sA = poolOf(S, 'seniorAfter');
  const sCommon = poolOf(S, 'senior');
  // early(week 10)
  check('week10: seniorEarly 등장', sE.some(l => early.has(l)));
  check('week10: seniorRush 미등장', sR.every(l => !early.has(l)));
  check('week10: seniorAfter 미등장', sA.every(l => !early.has(l)));
  // rush(week 30)
  check('week30: seniorRush 등장', sR.some(l => rush.has(l)));
  check('week30: seniorEarly 미등장', sE.every(l => !rush.has(l)));
  check('week30: seniorAfter 미등장', sA.every(l => !rush.has(l)));
  // after(week 40)
  check('week40: seniorAfter 등장', sA.some(l => after.has(l)));
  check('week40: seniorEarly 미등장', sE.every(l => !after.has(l)));
  check('week40: seniorRush 미등장', sR.every(l => !after.has(l)));
  // senior(시점 무관)는 세 시점 모두 노출
  check('senior(시점무관) early/rush/after 모두 등장',
    sCommon.some(l => early.has(l)) && sCommon.some(l => rush.has(l)) && sCommon.some(l => after.has(l)));
}

console.log(`\n부모 잡담 학교급 분기 검증: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
