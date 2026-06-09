// Phase 2B 검증 — 시험 약연동(examParentEffect) + strict 성적향상 어드밴티지(연 1회 가드)
//
// 범위:
//  B1. examParentEffect 분류 — 향상(rank↑)/상위권(mentalDelta>0)→gradeImprove, 하위권·급락(<0)→gradeDrop, 무난(0)→null
//  B1. 강점 배율 적용 — strict 증폭(1.4), emotional gradeDrop 완충(0.6)
//  B2. parentPraiseYears 필드 — init/migration 백필
//  B2. gameEngine 가드 소스 — strict + gradeImprove + 상위권 + 연 1회
//
// 실행: cd game && npx tsx scripts/verify/verify-parent-phase2b.ts

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
import { migrateLoadedState } from '../../src/engine/stateMigration';
import { examParentEffect, applyParentIntimacyDelta } from '../../src/engine/parentIntimacy';
import { getAvailableHomeEvents } from '../../src/engine/talkSystem';
import { PARENT_MINI_EVENTS } from '../../src/engine/talkData';
import type { ExamResult, GameState, ParentStrength } from '../../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// 분류기는 rank/prevRank/mentalDelta만 읽으므로 부분 객체로 충분
function exam(partial: Partial<ExamResult>): ExamResult {
  return partial as ExamResult;
}
function freshState(parents: [ParentStrength, ParentStrength]): GameState {
  return createInitialState('male', parents);
}

// ============================================================================
console.log('\n=== B1. examParentEffect 분류 ===');
// ============================================================================
{
  const impByRank = examParentEffect(exam({ rank: 5, prevRank: 10, mentalDelta: 0 }));
  assert('석차 상승(5<10) → gradeImprove +0.8',
    impByRank?.tag === 'gradeImprove' && impByRank.baseDelta === 0.8, JSON.stringify(impByRank));

  const impByMental = examParentEffect(exam({ rank: null, prevRank: null, mentalDelta: 2 }));
  assert('상위권(mentalDelta>0) → gradeImprove +0.8',
    impByMental?.tag === 'gradeImprove' && impByMental.baseDelta === 0.8, JSON.stringify(impByMental));

  const drop = examParentEffect(exam({ rank: null, prevRank: null, mentalDelta: -2 }));
  assert('하위권·급락(mentalDelta<0) → gradeDrop -1.0',
    drop?.tag === 'gradeDrop' && drop.baseDelta === -1.0, JSON.stringify(drop));

  const neutral = examParentEffect(exam({ rank: 15, prevRank: 15, mentalDelta: 0 }));
  assert('무난(mentalDelta 0, 석차 동일) → null(변화 없음)', neutral === null, JSON.stringify(neutral));

  // 석차 상승은 mentalDelta가 0이어도 향상으로 우선 판정(strict 온도 경로)
  const rankUpZeroMental = examParentEffect(exam({ rank: 8, prevRank: 12, mentalDelta: 0 }));
  assert('석차 상승 우선 — mentalDelta 0이어도 gradeImprove',
    rankUpZeroMental?.tag === 'gradeImprove', JSON.stringify(rankUpZeroMental));

  // 석차 하락은 mentalDelta>0이면(상위권 유지) 페널티 아님 — 향상 분기에 안 걸리고 mentalDelta로 gradeImprove
  const rankDownButTop = examParentEffect(exam({ rank: 4, prevRank: 2, mentalDelta: 2 }));
  assert('석차 소폭 하락이나 상위권 유지 → gradeDrop 아님(gradeImprove)',
    rankDownButTop?.tag === 'gradeImprove', JSON.stringify(rankDownButTop));
}

// ============================================================================
console.log('\n=== B1. 강점 배율 적용 (pi=50, factor=1.0) ===');
// ============================================================================
{
  // strict gradeImprove +0.8 × 1.4 = +1.12 / 2번째 부모 info는 gradeImprove 미정의(1.0).
  // (emotional·freedom은 gradeImprove 0.6 둔감이라 2번째 부모로 쓰면 안 됨)
  const a = freshState(['strict', 'info']); a.parentIntimacy = 50;
  const dA = applyParentIntimacyDelta(a, 0.8, 'gradeImprove');
  assert('strict gradeImprove +0.8 → +1.12', approx(dA, 1.12), `${dA}`);

  // strict gradeDrop -1.0 × 1.4 = -1.4 (증폭)
  const b = freshState(['strict', 'wealth']); b.parentIntimacy = 50;
  const dB = applyParentIntimacyDelta(b, -1.0, 'gradeDrop');
  assert('strict gradeDrop -1.0 → -1.4 (증폭)', approx(dB, -1.4), `${dB}`);

  // emotional gradeDrop -1.0 × 0.6 = -0.6 (완충) / 2번째 부모 freedom은 gradeDrop 미정의(1.0)
  const c = freshState(['emotional', 'freedom']); c.parentIntimacy = 50;
  const dC = applyParentIntimacyDelta(c, -1.0, 'gradeDrop');
  assert('emotional gradeDrop -1.0 → -0.6 (완충)', approx(dC, -0.6), `${dC}`);
}

// ============================================================================
console.log('\n=== B2. parentPraiseYears 필드 (init / migration) ===');
// ============================================================================
{
  const fresh = freshState(['strict', 'emotional']);
  assert('createInitialState가 parentPraiseYears=[] 초기화', Array.isArray(fresh.parentPraiseYears) && fresh.parentPraiseYears.length === 0);

  // 구 세이브(필드 없음) 백필
  const legacy = freshState(['strict', 'info']) as Record<string, unknown>;
  delete legacy.parentPraiseYears;
  const migrated = migrateLoadedState(legacy as unknown as GameState);
  assert('migration이 parentPraiseYears 백필', Array.isArray(migrated.parentPraiseYears) && migrated.parentPraiseYears.length === 0);
}

// ============================================================================
console.log('\n=== B2. gameEngine strict 어드밴티지 가드 (소스) ===');
// ============================================================================
{
  const ge = readFileSync('./src/engine/gameEngine.ts', 'utf8');
  // 시험 정산 안의 가드 블록만 슬라이스
  const at = ge.indexOf('examParentEffect(examResult)');
  const block = at >= 0 ? ge.slice(at, at + 1400) : '';
  assert('examParentEffect 호출 + 단일 진입점 적용',
    /examParentEffect\(examResult\)/.test(block) && /applyParentIntimacyDelta\(newState, examEffect\.baseDelta, examEffect\.tag\)/.test(block));
  assert('strict + gradeImprove + 상위권 + 연1회 가드',
    /parents\.includes\('strict'\)/.test(block) && /examEffect\.tag === 'gradeImprove'/.test(block)
    && /topTier/.test(block) && /!praiseYears\.includes\(newState\.year\)/.test(block));
  assert('어드밴티지 = 멘탈 버프 + 연도 기록',
    /stats\.mental = Math\.min\(100, newState\.stats\.mental \+ 2\)/.test(block) && /praiseYears\.push\(newState\.year\)/.test(block));
  assert('시험 훅은 actedWithParentThisWeek를 세팅하지 않음(회귀 타이밍)',
    !/actedWithParentThisWeek\s*=\s*true/.test(block));
}

// ============================================================================
console.log('\n=== G8. 리뷰 반영 회귀 (G1 yearMin 게이팅 / G2 초등 분류) ===');
// ============================================================================
{
  // G1: talk_parent_info_2(yearMin:5)가 초등(Y1~Y4)엔 미가용, 고등(Y5+)엔 가용
  const sLow = freshState(['info', 'emotional']); sLow.year = 4; sLow.totalWeeksPlayed = 10; sLow.parentEventsFired = [];
  const availLow = getAvailableHomeEvents(sLow);
  assert('G1 info_2(yearMin5)는 Y4에 미가용', !availLow.some(e => e.id === 'talk_parent_info_2'), availLow.map(e => e.id).join(','));
  assert('G1 Y4엔 info 기본 이벤트만(진학 이벤트 누출 없음)', availLow.some(e => e.id === 'talk_parent_info'));

  const sHigh = freshState(['info', 'emotional']); sHigh.year = 5; sHigh.totalWeeksPlayed = 10; sHigh.parentEventsFired = [];
  const availHigh = getAvailableHomeEvents(sHigh);
  assert('G1 info_2는 Y5에 가용', availHigh.some(e => e.id === 'talk_parent_info_2'), availHigh.map(e => e.id).join(','));

  // G2: 초등 시험은 average로 분류(rank=null, mentalDelta=0 폴백 아님)
  const elemHigh = examParentEffect(exam({ schoolLevel: 'elementary', average: 88, rank: null, prevRank: null, mentalDelta: 0 }));
  assert('G2 초등 average≥75 → gradeImprove', elemHigh?.tag === 'gradeImprove', JSON.stringify(elemHigh));
  const elemLow = examParentEffect(exam({ schoolLevel: 'elementary', average: 40, rank: null, prevRank: null, mentalDelta: 0 }));
  assert('G2 초등 average<45 → gradeDrop', elemLow?.tag === 'gradeDrop', JSON.stringify(elemLow));
  const elemMid = examParentEffect(exam({ schoolLevel: 'elementary', average: 60, rank: null, prevRank: null, mentalDelta: 0 }));
  assert('G2 초등 중위(45~74) → null', elemMid === null, JSON.stringify(elemMid));

  // G3/G5/G6: 콘텐츠 밸런스 조정 값
  const wealth2 = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_wealth_2')!;
  assert('G3 wealth_2 회피 💰 4→3', wealth2.choices![1].effects?.money === 3, `${wealth2.choices![1].effects?.money}`);
  const freedom2 = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_freedom_2')!;
  assert('G5 freedom_2 부정 피로-1 트레이드오프', freedom2.choices![1].effects?.fatigue === -1, JSON.stringify(freedom2.choices![1].effects));
  const resil2 = PARENT_MINI_EVENTS.find(e => e.id === 'talk_parent_resilience_2')!;
  assert('G6 resilience_2 부정 baseDelta -1.0', resil2.choices![1].parentEffect?.baseDelta === -1.0, `${resil2.choices![1].parentEffect?.baseDelta}`);

  // G4: strict 어드밴티지 mock 게이트 ≤2
  const ge = readFileSync('./src/engine/gameEngine.ts', 'utf8');
  assert('G4 mock 게이트 mockGrade <= 2', /mockGrade != null && examResult\.mockGrade <= 2/.test(ge));
}

// PARENT_MINI_EVENTS는 G3/G5/G6 단정에서 필요 → import
// ============================================================================
console.log(`\n${failed === 0 ? '✅' : '❌'} Phase 2B: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
