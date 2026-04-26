// 묶음 4 패치 검증 — 부모 강점 SSOT drift / 데드 bias / 표시 노이즈
//
// P13. wealth memory bias가 데드 카테고리(bypass/unspoken_debt) 대신
//      현존 카테고리(betrayal/failure)에 매핑되어 실효 효과 발생
// P14. GameScreen maxSlots가 parentModifiers.vacationSlotBonus SSOT를 따름
// P15. migrateLoadedState rngSeed가 마이그레이션된 parents(gene→resilience)로 hash
// P16. emotional 보너스 표시 — 피로가 이미 0/낮을 때 노이즈 없음
// P17. strict 보너스 표시 — 임계값(3/6/8주)을 부스트로 막 통과한 주만 표시
//
// 실행: cd game && npx tsx scripts/verify-patch-batch4.ts

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
import {
  createInitialState, processWeek, migrateLoadedState, hashInitialState,
} from '../src/engine/gameEngine';
import { selectMemorialHighlights } from '../src/engine/memorySystem';
import { getParentMods } from '../src/engine/parentModifiers';
import type { GameState, MemorySlot, ParentStrength } from '../src/engine/types';

let passed = 0, failed = 0;
function assert(label: string, cond: boolean, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

// ============================================================================
console.log('\n=== P13. wealth memory bias 매핑 (dead → live 카테고리) ===');
// ============================================================================
{
  const src = readFileSync('./src/engine/memorySystem.ts', 'utf8');

  // wealth 줄 추출
  const m = src.match(/wealth:\s*\{([^}]+)\}/);
  assert('memorySystem.ts에서 wealth bias 정의 찾음', !!m);

  if (m) {
    const body = m[1];
    assert('wealth bias에 betrayal 포함', /betrayal/.test(body), body.trim());
    assert('wealth bias에 failure 포함', /failure/.test(body), body.trim());
    assert('wealth bias에 reconciliation: -0.1 유지', /reconciliation:\s*-0\.1/.test(body));
    assert('wealth bias에 데드 카테고리(bypass) 제거', !/\bbypass\b/.test(body));
    assert('wealth bias에 데드 카테고리(unspoken_debt) 제거', !/unspoken_debt/.test(body));
  }

  // 실효 검증: wealth 부모일 때 betrayal 슬롯이 reconciliation 슬롯보다 우선 회상되는지
  // (importance 동률 시 bias로 우열 결정)
  const state = createInitialState('male', ['wealth', 'info'], { rngSeed: 1234567 });
  const slot = (
    id: string, category: MemorySlot['category'], importance: number,
  ): MemorySlot => ({
    id, category, week: 1, year: 1, sourceEventId: id, choiceIndex: 0,
    recallText: `테스트 ${id}`, importance, phaseTag: 'early',
  });
  // 같은 importance — wealth bias로 betrayal/failure가 reconciliation보다 앞서야
  state.memorySlots = [
    slot('rec1', 'reconciliation', 3),
    slot('bet1', 'betrayal', 3),
    slot('fail1', 'failure', 3),
  ];
  const highlights = selectMemorialHighlights(state);
  // 우선 카테고리(growth/discovery/failure) 슬롯이 1순위로 잡히는데, failure는 그중 하나라 ok
  // 그 다음 importance 정렬: bet1(3+0.2=3.2) vs rec1(3-0.1=2.9) → bet1 먼저
  const recalls = highlights.map(h => h.recallText).join(' / ');
  assert(
    `wealth + 동률 importance에서 betrayal이 reconciliation보다 회상 우선 (실제: ${recalls})`,
    highlights.findIndex(h => h.recallText.includes('bet1')) <
    (highlights.findIndex(h => h.recallText.includes('rec1')) === -1 ? 999 :
     highlights.findIndex(h => h.recallText.includes('rec1'))),
  );
}

// ============================================================================
console.log('\n=== P14. GameScreen maxSlots SSOT (parentModifiers.vacationSlotBonus) ===');
// ============================================================================
{
  const src = readFileSync('./src/components/GameScreen.tsx', 'utf8');

  assert('GameScreen이 parentModifiers를 import',
    /from\s+['"]\.\.\/engine\/parentModifiers['"]/.test(src));
  assert('GameScreen이 maxSlots에 getParentMods 사용',
    /maxSlots[^=]*=[^;]*getParentMods/.test(src));
  assert('GameScreen에서 maxSlots 직접 includes(\'freedom\') 호출 제거',
    !/parents\.includes\(['"]freedom['"]\)\s*\?\s*6/.test(src));

  // 실효 검증: parentModifiers가 freedom일 때 vacationSlotBonus +1
  const freedomMods = getParentMods(['freedom', 'wealth']);
  const otherMods = getParentMods(['emotional', 'strict']);
  assert('freedom 부모: vacationSlotBonus = 1', freedomMods.vacationSlotBonus === 1);
  assert('비-freedom 부모: vacationSlotBonus = 0', otherMods.vacationSlotBonus === 0);
  assert('5 + bonus → freedom 6, 그 외 5',
    5 + freedomMods.vacationSlotBonus === 6 && 5 + otherMods.vacationSlotBonus === 5);
}

// ============================================================================
console.log('\n=== P15. migrateLoadedState rngSeed가 마이그레이션된 parents 사용 ===');
// ============================================================================
{
  // 구세이브 시뮬: parents=['gene', 'wealth'], rngSeed 누락
  // 마이그레이션 결과: parents=['resilience', 'wealth']
  // rngSeed는 resilience 기준 hash여야 (gene 기준이 아니라)
  const expectedSeed = hashInitialState({
    gender: 'male', parents: ['resilience', 'wealth'] as [ParentStrength, ParentStrength],
  });
  const oldSeedIfWrong = hashInitialState({
    gender: 'male', parents: ['gene', 'wealth'] as unknown as [ParentStrength, ParentStrength],
  });

  // 두 해시가 실제로 달라야 의미 있는 검증
  assert('hashInitialState({gene}) ≠ hashInitialState({resilience})',
    expectedSeed !== oldSeedIfWrong);

  // 구세이브 가짜 객체 — gene parent 보존, rngSeed 0 (= 누락 취급)
  const fakeOldSave = {
    gender: 'male' as const,
    parents: ['gene', 'wealth'] as unknown as [ParentStrength, ParentStrength],
    rngSeed: 0,
    week: 1, year: 1, phase: 'weekday', track: null,
    stats: { academic: 30, social: 25, talent: 15, mental: 50, health: 40 },
    fatigue: 0, money: 0, mentalState: 'normal',
    routineSlot2: null, routineSlot3: null, routineWeeks: 0,
    weekendChoices: [], vacationChoices: [], semester: 1, isVacation: false,
    weekLog: null, npcs: [], events: [], currentEvent: null,
    milestones: [], burnoutCount: 0, totalWeeksPlayed: 0,
    examResults: [], currentExamResult: null, activeBuffs: [], weekPurchases: {},
    idleWeeks: 0, consecutiveTiredWeeks: 0, burnoutCooldown: 0,
    eventTimeCost: 0, unlockedEvents: [], memorySlots: [],
    socialRipples: [], milestoneScenes: [], hardCrisisYears: [],
  } as unknown as GameState;

  const migrated = migrateLoadedState(fakeOldSave);
  assert(`gene → resilience 마이그레이션 (실제: ${migrated.parents.join(',')})`,
    migrated.parents.includes('resilience' as ParentStrength) &&
    !migrated.parents.includes('gene' as unknown as ParentStrength));
  assert(`rngSeed = hash(resilience 기준) (expected ${expectedSeed}, actual ${migrated.rngSeed})`,
    migrated.rngSeed === expectedSeed);
  assert(`rngSeed ≠ hash(gene 기준) — 옛 parents로 hash하지 않음`,
    migrated.rngSeed !== oldSeedIfWrong);
}

// ============================================================================
console.log('\n=== P16. emotional 표시 노이즈 — 피로 0/낮을 때 표시 안 함 ===');
// ============================================================================
{
  // emotional 부모 + 피로 0에서 processWeek 시 parentBonusesApplied에 emotional 없어야
  let s = createInitialState('male', ['emotional', 'info'], { rngSeed: 1234567 });
  s.fatigue = 0;
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'self-study';
  s = processWeek(s);
  const emoBonusFat0 = s.weekLog?.parentBonusesApplied?.some(b => b.parent === 'emotional');
  assert('피로 0 시작 → emotional 표시 안 뜸 (노이즈 없음)', !emoBonusFat0);

  // 피로 충분(>= 2) — 정상적으로 emotional 표시
  s = createInitialState('male', ['emotional', 'info'], { rngSeed: 1234567 });
  s.fatigue = 50;
  s.routineSlot2 = 'self-study';
  s.routineSlot3 = 'self-study';
  s = processWeek(s);
  const emoBonusFat50 = s.weekLog?.parentBonusesApplied?.some(b => b.parent === 'emotional');
  assert('피로 50 시작 → emotional 표시 정상 표출', !!emoBonusFat50);
}

// ============================================================================
console.log('\n=== P17. strict 표시 노이즈 — 임계값 통과 주만 표시 ===');
// ============================================================================
{
  // strict 부스트(routineWeeksBoost=1)는 routineWeeks 2/5/7 → +1로 3/6/8 도달 시 rBonus 변화
  // 그 외 주에는 표시 노이즈 없어야

  function runOneWeek(routineWeeksStart: number): boolean | undefined {
    let s = createInitialState('male', ['strict', 'wealth'], { rngSeed: 1234567 });
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'self-study';
    s.routineWeeks = routineWeeksStart;
    s.fatigue = 30; // 회복/적용에 영향 없도록 중간값
    s = processWeek(s);
    return s.weekLog?.parentBonusesApplied?.some(b => b.parent === 'strict');
  }

  // routineWeeks 0 → 1 (부스트 후 1) → baseBonus 0, rBonus 0 (1주는 임계값 미만) → 표시 안 됨
  assert('routineWeeks 0 → 1: 임계값 미통과, strict 표시 없음', !runOneWeek(0));
  // routineWeeks 1 → 2 (부스트 후 2) → 둘 다 0 → 표시 없음
  assert('routineWeeks 1 → 2: 임계값 미통과, strict 표시 없음', !runOneWeek(1));
  // routineWeeks 2 → 3 (부스트 후 3) → baseBonus 0(2주), rBonus 0.1(3주) → 표시
  assert('routineWeeks 2 → 3: 임계값 통과(0→0.1), strict 표시 있음', runOneWeek(2));
  // routineWeeks 3 → 4 (부스트 후 4) → baseBonus 0.1(3주), rBonus 0.1(4주) → 변화 없음 → 표시 없음
  assert('routineWeeks 3 → 4: 변화 없음(0.1→0.1), strict 표시 없음', !runOneWeek(3));
  // routineWeeks 5 → 6 (부스트 후 6) → baseBonus 0.1(5주), rBonus 0.2(6주) → 표시
  assert('routineWeeks 5 → 6: 임계값 통과(0.1→0.2), strict 표시 있음', runOneWeek(5));
  // routineWeeks 7 → 8 (부스트 후 8) → baseBonus 0.2(7주), rBonus 0.3(8주) → 표시
  assert('routineWeeks 7 → 8: 임계값 통과(0.2→0.3), strict 표시 있음', runOneWeek(7));
}

// ============================================================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
if (failed > 0) process.exit(1);
