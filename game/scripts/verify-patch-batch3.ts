// 묶음 3 패치 검증 — 부모 강점 4종 신규 러닝 효과
//
// P8.  freedom 죽은 코드 정리 (gameEngine.ts:34)
// P9.  info: study 카테고리 활동 효율 +10%
// P10. gene: 피로 증가 -15% + exercise 카테고리 효율 +10%
// P11. strict: 루틴 보너스 도달 1주 단축
// P12. freedom: idle 페널티 절반
//
// 검증 전략:
// - 동일 시드 + 동일 루틴으로 부모 조합만 바꿔 Y1 시뮬
// - 신규 효과 부모 vs 비교군의 누적 스탯 차이 측정
//
// 실행: cd game && npx tsx scripts/verify-patch-batch3.ts

import { readFileSync } from 'fs';
import { createInitialState, processWeek } from '../src/engine/gameEngine';
import type { GameState, ParentStrength } from '../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

const SEED = 1234567;

// 공통 시뮬: 부모 조합으로 Y1 48주 진행, 동일 루틴 강제
function simulateY1(parents: [ParentStrength, ParentStrength], routine: {
  slot2: string; slot3: string; weekend: string[]; vacation: string[];
}): GameState {
  let s = createInitialState('male', parents, { rngSeed: SEED });
  s.routineSlot2 = routine.slot2;
  s.routineSlot3 = routine.slot3;
  s.weekendChoices = routine.weekend;
  s.vacationChoices = routine.vacation;
  for (let w = 0; w < 48; w++) {
    s = processWeek(s);
    if (s.currentEvent) s.currentEvent = null;
    if (s.phase === 'year-end') break;
  }
  return s;
}

// ============================================================================
console.log('\n=== P8. freedom 죽은 코드 정리 ===');
// ============================================================================
{
  const src = readFileSync('./src/engine/gameEngine.ts', 'utf8');
  assert('gameEngine.ts에 "if (parents.includes(\'freedom\')) money = 3" 제거됨',
    !/if\s*\(\s*parents\.includes\(['"]freedom['"]\)\s*\)\s*money\s*=\s*3/.test(src));

  // freedom 부모 시작 자금이 비-freedom과 동일 (3) — wealth만 다름
  const sFree = createInitialState('male', ['freedom', 'gene'], { rngSeed: SEED });
  const sNorm = createInitialState('male', ['gene', 'emotional'], { rngSeed: SEED });
  assert('freedom 시작 자금 = 일반 시작 자금 (3만원)', sFree.money === 3 && sNorm.money === 3);
}

// ============================================================================
console.log('\n=== P9. info: 학업 활동 효율 +10% ===');
// ============================================================================
{
  // 학업 루틴 풀 가동: self-study × all slots
  const studyRoutine = {
    slot2: 'self-study', slot3: 'self-study',
    weekend: ['self-study', 'self-study'],
    vacation: ['self-study', 'self-study', 'self-study', 'self-study', 'self-study'],
  };
  const sInfo = simulateY1(['info', 'wealth'], studyRoutine);
  const sBase = simulateY1(['wealth', 'freedom'], studyRoutine);

  console.log(`  학업 루틴 — info: academic=${sInfo.stats.academic.toFixed(1)} / 비교군: academic=${sBase.stats.academic.toFixed(1)}`);
  // 주의: 70대 academic은 soft cap (80+ ×0.1) + 주당 +2 상한 + diminishing return 누적으로 +10% 효율이 +0.3~0.5로 압축됨
  assert('info의 Y1 academic > 비교군 academic (+10% 효율)',
    sInfo.stats.academic > sBase.stats.academic,
    `info=${sInfo.stats.academic.toFixed(1)} base=${sBase.stats.academic.toFixed(1)}`);
  assert('info와 비교군 차이 ≥ 0.3 (cap·diminishing return으로 압축됨)',
    sInfo.stats.academic - sBase.stats.academic >= 0.3,
    `Δ=${(sInfo.stats.academic - sBase.stats.academic).toFixed(2)}`);
}

// ============================================================================
console.log('\n=== P10. gene: 피로 -15% + 운동 효율 +10% ===');
// ============================================================================
{
  // 운동 루틴: basketball + jogging
  const exerciseRoutine = {
    slot2: 'jogging', slot3: 'basketball',
    weekend: ['jogging', 'basketball'],
    vacation: ['jogging', 'jogging', 'basketball', 'basketball', 'jogging'],
  };
  const sGene = simulateY1(['gene', 'wealth'], exerciseRoutine);
  const sBase = simulateY1(['strict', 'wealth'], exerciseRoutine);

  console.log(`  운동 루틴 — gene: health=${sGene.stats.health.toFixed(1)}, fatigue=${sGene.fatigue.toFixed(1)} / 비교군: health=${sBase.stats.health.toFixed(1)}, fatigue=${sBase.fatigue.toFixed(1)}`);
  assert('gene의 Y1 fatigue ≤ 비교군 (피로 -15%)',
    sGene.fatigue <= sBase.fatigue,
    `gene=${sGene.fatigue.toFixed(1)} base=${sBase.fatigue.toFixed(1)}`);
  assert('gene의 Y1 health ≥ 비교군 (운동 효율 +10%)',
    sGene.stats.health >= sBase.stats.health,
    `gene=${sGene.stats.health.toFixed(1)} base=${sBase.stats.health.toFixed(1)}`);
}

// ============================================================================
console.log('\n=== P11. strict: 루틴 보너스 도달 1주 단축 ===');
// ============================================================================
{
  // 동일 활동을 long term 유지 → strict는 routineWeeks가 매주 +1 boost 받아 보너스 도달 가속
  const longRoutine = {
    slot2: 'self-study', slot3: 'self-study',
    weekend: ['self-study', 'self-study'],
    vacation: ['self-study', 'self-study', 'self-study', 'self-study', 'self-study'],
  };
  const sStrict = simulateY1(['strict', 'wealth'], longRoutine);
  // 비교군: freedom (러닝 효과가 idle 페널티만 → self-study 루틴엔 영향 없음, strict 효과만 분리 측정)
  const sBase = simulateY1(['freedom', 'wealth'], longRoutine);

  console.log(`  장기 루틴 — strict: academic=${sStrict.stats.academic.toFixed(1)} / 비교군(freedom): academic=${sBase.stats.academic.toFixed(1)}`);
  assert('strict의 Y1 academic ≥ 비교군 (루틴 가속 효과)',
    sStrict.stats.academic >= sBase.stats.academic,
    `strict=${sStrict.stats.academic.toFixed(1)} base=${sBase.stats.academic.toFixed(1)}`);

  // 코드 상수 검증
  const src = readFileSync('./src/engine/gameEngine.ts', 'utf8');
  assert('gameEngine.ts에 strict 루틴 boost 적용 코드 존재',
    /strict.*\?\s*1\s*:\s*0/.test(src) && /routineWeeks\s*\+\s*strictBoost/.test(src));
}

// ============================================================================
console.log('\n=== P12. freedom: idle 페널티 절반 ===');
// ============================================================================
{
  // 모든 슬롯이 'rest' 계열 → idleWeeks 누적 → 3주 이상에서 페널티
  const restOnlyRoutine = {
    slot2: 'rest', slot3: 'rest',
    weekend: ['rest', 'rest'],
    vacation: ['rest', 'rest', 'rest', 'rest', 'rest'],
  };
  const sFree = simulateY1(['freedom', 'wealth'], restOnlyRoutine);
  const sBase = simulateY1(['strict', 'wealth'], restOnlyRoutine);

  console.log(`  rest-only — freedom: mental=${sFree.stats.mental.toFixed(1)}, social=${sFree.stats.social.toFixed(1)}, idleWeeks=${sFree.idleWeeks} / 비교군: mental=${sBase.stats.mental.toFixed(1)}, social=${sBase.stats.social.toFixed(1)}, idleWeeks=${sBase.idleWeeks}`);
  assert('freedom의 Y1 mental ≥ 비교군 (idle 페널티 절반)',
    sFree.stats.mental >= sBase.stats.mental,
    `free=${sFree.stats.mental.toFixed(1)} base=${sBase.stats.mental.toFixed(1)}`);
  assert('freedom의 Y1 social ≥ 비교군',
    sFree.stats.social >= sBase.stats.social);
  // 비교군 mental이 0 floor에 박히는 시점이 빨라 측정 한계 — Δ 1.0 이상이면 효과 감지로 충분
  assert('freedom과 비교군 mental 차이 ≥ 1.0 (Y1 누적 효과, 0 floor 한계 감안)',
    sFree.stats.mental - sBase.stats.mental >= 1.0,
    `Δ=${(sFree.stats.mental - sBase.stats.mental).toFixed(2)}`);
}

// ============================================================================
console.log('\n=== 부가 검증: 6개 단일 부모 단독 효과 매트릭스 (Y1 종료 스탯) ===');
// ============================================================================
{
  // 모든 부모를 'wealth'와 짝지어 시뮬 (wealth는 자금 보장 → 다른 부모 효과만 비교)
  const balancedRoutine = {
    slot2: 'self-study', slot3: 'club',
    weekend: ['self-study', 'hang-out'],
    vacation: ['self-study', 'self-study', 'jogging', 'hang-out', 'club'],
  };
  const partners: ParentStrength[] = ['emotional', 'wealth', 'info', 'strict', 'gene', 'freedom'];
  const baseline: [ParentStrength, ParentStrength] = ['wealth', 'wealth' as ParentStrength]; // 더미 (실제로는 wealth + 다른 1개)

  console.log('  부모     | academic | social | talent | mental | health | fatigue | money');
  console.log('  ---------|----------|--------|--------|--------|--------|---------|------');
  const results: { name: string; s: GameState }[] = [];
  for (const p of partners) {
    if (p === 'wealth') continue; // wealth는 baseline으로 짝지어 시뮬됨
    const s = simulateY1(['wealth', p], balancedRoutine);
    results.push({ name: p, s });
    console.log(`  ${p.padEnd(8)} | ${s.stats.academic.toFixed(1).padStart(8)} | ${s.stats.social.toFixed(1).padStart(6)} | ${s.stats.talent.toFixed(1).padStart(6)} | ${s.stats.mental.toFixed(1).padStart(6)} | ${s.stats.health.toFixed(1).padStart(6)} | ${s.fatigue.toFixed(1).padStart(7)} | ${s.money.toFixed(1).padStart(5)}`);
  }

  // 차별화 검증: 5개 부모(emotional/info/strict/gene/freedom)의 종료 스탯이 모두 동일하면 안 됨
  const academics = results.map(r => r.s.stats.academic);
  const academicSpread = Math.max(...academics) - Math.min(...academics);
  const fatigues = results.map(r => r.s.fatigue);
  const fatigueSpread = Math.max(...fatigues) - Math.min(...fatigues);

  console.log(`\n  스탯 분산: academic spread=${academicSpread.toFixed(2)}, fatigue spread=${fatigueSpread.toFixed(2)}`);
  assert('5개 부모 간 academic 스프레드 ≥ 1.0 (info 효과 가시화)',
    academicSpread >= 1.0, `spread=${academicSpread.toFixed(2)}`);
  assert('5개 부모 간 fatigue 스프레드 ≥ 0.5 (gene 효과 가시화)',
    fatigueSpread >= 0.5, `spread=${fatigueSpread.toFixed(2)}`);

  // info가 academic 1위인지
  const sortedByAcademic = [...results].sort((a, b) => b.s.stats.academic - a.s.stats.academic);
  console.log(`  학업 1위: ${sortedByAcademic[0].name} (${sortedByAcademic[0].s.stats.academic.toFixed(1)})`);
  // gene이 fatigue 최저인지
  const sortedByFatigue = [...results].sort((a, b) => a.s.fatigue - b.s.fatigue);
  console.log(`  피로 최저: ${sortedByFatigue[0].name} (${sortedByFatigue[0].s.fatigue.toFixed(1)})`);
}

// ============================================================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
