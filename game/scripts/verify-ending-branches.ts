// 엔딩 분기 커버리지 리그레션
// 목적: determineCareer (calculateEnding 내부)의 모든 분기가 실제로 도달 가능한지
// 그리고 각 분기 조건에서 의도한 진로 문자열이 반환되는지 어설션으로 고정한다.
// 덤: 도달 불가능(dead) 분기도 식별.
//
// 실행: cd game && npx tsx scripts/verify-ending-branches.ts

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

import { createInitialState, calculateEnding } from '../src/engine/gameEngine';
import type { GameState, ExamResult, Track } from '../src/engine/types';

interface Scenario {
  label: string;
  stats?: Partial<GameState['stats']>;
  burnoutCount?: number;
  track?: Track | null;
  mockGrade?: number | null;
  expectCareer: string; // determineCareer 반환 path
}

// 기본 stats 구성
function baseState(): GameState {
  const s = createInitialState('male', ['wealth', 'emotional']);
  s.stats = { academic: 50, social: 50, talent: 50, mental: 50, health: 50 };
  s.burnoutCount = 0;
  s.track = null;
  s.examResults = [];
  return s;
}

function withScenario(sc: Scenario): GameState {
  const s = baseState();
  if (sc.stats) Object.assign(s.stats, sc.stats);
  if (sc.burnoutCount !== undefined) s.burnoutCount = sc.burnoutCount;
  if (sc.track !== undefined) s.track = sc.track;
  if (sc.mockGrade !== null && sc.mockGrade !== undefined) {
    // suneung ExamResult 조립 — mockGrade만 필요
    const suneung: ExamResult = {
      subjects: {
        korean: { score: 0, grade: 'C', delta: 0 },
        english: { score: 0, grade: 'C', delta: 0 },
        math: { score: 0, grade: 'C', delta: 0 },
        socialScience: { score: 0, grade: 'C', delta: 0 },
        artsPhysical: { score: 0, grade: 'C', delta: 0 },
      },
      average: 0,
      rank: null,
      prevRank: null,
      comment: '',
      parentReaction: '',
      teacherReaction: '',
      examType: 'suneung',
      schoolLevel: 'high',
      year: 7,
      semester: 2,
      mockGrade: sc.mockGrade,
    };
    s.examResults = [suneung];
  }
  return s;
}

const SCENARIOS: Scenario[] = [
  // ===== 최상위 특기자 체크 (talent ≥ 90) =====
  {
    label: '예술/체육 특기자 — talent 90+',
    stats: { talent: 95, academic: 50 }, mockGrade: 3,
    expectCareer: '예술/체육 특기자',
  },
  // talent 85~89 + academic < 70 → 예체능 진학
  {
    label: '예체능 진학 — talent 85~89 + 학업 미흡',
    stats: { talent: 85, academic: 60 }, mockGrade: 3,
    expectCareer: '예체능 진학',
  },

  // ===== 번아웃 + 멘탈 바닥 =====
  {
    label: '재수 결심 — burnout 4 + mental <30',
    stats: { academic: 60, mental: 25 }, burnoutCount: 4, mockGrade: 3,
    expectCareer: '재수 결심',
  },
  {
    label: '잠시 쉼표 — mental <15 (다른 조건 무시)',
    stats: { academic: 70, mental: 10 }, mockGrade: 2, track: 'humanities',
    expectCareer: '잠시 쉼표',
  },

  // ===== 수능 7등급 이하 =====
  {
    label: '잠시 쉼표 — 수능 7등급 + burnout 2',
    stats: { mental: 40 }, burnoutCount: 2, mockGrade: 7,
    expectCareer: '잠시 쉼표',
  },
  {
    label: '전문대/재수 — 수능 8등급 + burnout 0',
    stats: { mental: 40 }, burnoutCount: 0, mockGrade: 8,
    expectCareer: '전문대 / 재수',
  },

  // ===== 지방 4년제 (5~6등급 + track 없음) =====
  {
    label: '지방 4년제 — mockGrade 5 + !track',
    stats: { academic: 50, mental: 50 }, mockGrade: 5, track: null,
    expectCareer: '지방 4년제',
  },
  {
    label: '지방 4년제 — mockGrade 6 + !track',
    stats: { academic: 50, mental: 50 }, mockGrade: 6, track: null,
    expectCareer: '지방 4년제',
  },

  // ===== 문과 진로 =====
  {
    label: 'SKY 경영대 — humanities g1 + academic ≥85 + mental ≥50',
    stats: { academic: 88, mental: 65 }, mockGrade: 1, track: 'humanities',
    expectCareer: 'SKY 경영대 합격',
  },
  {
    label: 'SKY 인문대 — humanities g1 + academic <85',
    stats: { academic: 70, mental: 60 }, mockGrade: 1, track: 'humanities',
    expectCareer: 'SKY 인문대 합격',
  },
  {
    label: '인서울 상위권 — humanities g2',
    stats: { academic: 75, mental: 55 }, mockGrade: 2, track: 'humanities',
    expectCareer: '인서울 상위권 대학',
  },
  {
    label: '인서울 문과 — humanities g3',
    stats: { academic: 70, mental: 55 }, mockGrade: 3, track: 'humanities',
    expectCareer: '인서울 문과',
  },
  {
    label: '수도권 대학 — humanities g4',
    stats: { academic: 60, mental: 50 }, mockGrade: 4, track: 'humanities',
    expectCareer: '수도권 대학',
  },
  {
    label: '지방 국립대 — humanities g5',
    stats: { academic: 55, mental: 50 }, mockGrade: 5, track: 'humanities',
    expectCareer: '지방 국립대',
  },
  {
    label: '지방 국립대 — humanities g6',
    stats: { academic: 50, mental: 50 }, mockGrade: 6, track: 'humanities',
    expectCareer: '지방 국립대',
  },

  // ===== 이과 진로 =====
  {
    label: '의대 — science g1 + academic ≥88',
    stats: { academic: 92, mental: 60 }, mockGrade: 1, track: 'science',
    expectCareer: '의대 합격',
  },
  {
    label: 'SKY 공대 — science g1 + academic <88',
    stats: { academic: 78, mental: 60 }, mockGrade: 1, track: 'science',
    expectCareer: 'SKY 공대 합격',
  },
  {
    label: '인서울 상위권 공대 — science g2',
    stats: { academic: 75, mental: 55 }, mockGrade: 2, track: 'science',
    expectCareer: '인서울 상위권 공대',
  },
  {
    label: '인서울 이과 — science g3',
    stats: { academic: 70, mental: 50 }, mockGrade: 3, track: 'science',
    expectCareer: '인서울 이과',
  },
  {
    label: '수도권 이공계 — science g4',
    stats: { academic: 60, mental: 50 }, mockGrade: 4, track: 'science',
    expectCareer: '수도권 이공계',
  },
  {
    label: '지방 국립대 이공계 — science g5',
    stats: { academic: 55, mental: 50 }, mockGrade: 5, track: 'science',
    expectCareer: '지방 국립대 이공계',
  },

  // ===== track 미선택 fallback =====
  {
    label: '상위권 대학 — !track + mockGrade ≤2',
    stats: { academic: 75, mental: 55 }, mockGrade: 2, track: null,
    expectCareer: '상위권 대학',
  },
  {
    label: '상위권 대학 — !track + mockGrade 1',
    stats: { academic: 80, mental: 60 }, mockGrade: 1, track: null,
    expectCareer: '상위권 대학',
  },
  {
    label: '인서울 대학 — !track + mockGrade 3',
    stats: { academic: 65, mental: 50 }, mockGrade: 3, track: null,
    expectCareer: '인서울 대학',
  },
  {
    label: '인서울 대학 — !track + mockGrade 4',
    stats: { academic: 60, mental: 50 }, mockGrade: 4, track: null,
    expectCareer: '인서울 대학',
  },

  // ===== 수능 미응시 fallback =====
  {
    label: '수능 미응시 — !track → 잠시 쉼표 or 전문대/재수',
    // mockGrade null → determineCareer 내부 "?? 9" 로 9등급 취급. burnout 0 → 전문대/재수
    stats: { mental: 30 }, burnoutCount: 0, mockGrade: null, track: null,
    expectCareer: '전문대 / 재수',
  },
];

let passed = 0;
let failed = 0;
const failures: { label: string; expected: string; got: string }[] = [];

function assert(sc: Scenario) {
  const s = withScenario(sc);
  const ending = calculateEnding(s);
  const got = ending.career;
  if (got === sc.expectCareer) {
    console.log(`  ✓ ${sc.label}`);
    passed++;
  } else {
    console.log(`  ✗ ${sc.label}`);
    console.log(`      expected "${sc.expectCareer}", got "${got}"`);
    failed++;
    failures.push({ label: sc.label, expected: sc.expectCareer, got });
  }
}

console.log('엔딩 분기 커버리지 리그레션\n');
console.log(`=== ${SCENARIOS.length}개 시나리오 ===`);
for (const sc of SCENARIOS) assert(sc);

// ========================================
// Dead code / 도달 불가능 분기 탐지
// determineCareer 마지막 `return '대학 진학'`은 !track && mockGrade ≤4 조건에서만
// 도달해야 하는데 그건 이미 line 815-816 에서 처리됨. 즉 이 return은 dead.
// ========================================
console.log('\n=== Dead branch 탐지 ===');
{
  // '대학 진학'을 유도하려면 !track + mockGrade > 4 조건이어야 하지만
  // 그건 이미 line 786 (mockGrade ≥5 && !track → 지방 4년제)가 가로챈다.
  const s = withScenario({
    label: '',
    stats: { academic: 50, mental: 50 }, mockGrade: 6, track: null,
    expectCareer: '대학 진학',
  });
  const got = calculateEnding(s).career;
  if (got === '대학 진학') {
    console.log(`  ✗ "대학 진학" 분기가 도달됨 — 분기 순서에 버그가 있을 가능성`);
    failed++;
  } else {
    console.log(`  ✓ "대학 진학" 폴백은 도달 불가 (현재 "${got}") — determineCareer 마지막 return은 dead code`);
    passed++;
  }
}

// ========================================
// 엔딩 타이틀 수식 분기 — 특수 조합이 실제 적용되는지
// ========================================
console.log('\n=== 엔딩 타이틀 수식 ===');
{
  // 완벽한 청춘: achievement S (stat≥85) + happiness S (mental≥80 && social≥60) + suneung≤2
  const perfect = withScenario({
    label: '', stats: { academic: 88, mental: 85, social: 70, talent: 60, health: 70 },
    mockGrade: 1, track: 'humanities', expectCareer: '',
  });
  const e1 = calculateEnding(perfect);
  if (e1.title.startsWith('완벽한 청춘')) { console.log(`  ✓ 완벽한 청춘 수식 적용`); passed++; }
  else { console.log(`  ✗ 완벽한 청춘 미적용 (title="${e1.title}")`); failed++; }

  // 불꽃은 꺼지지 않는다: burnoutCount≥3 + suneung≤4
  const flame = withScenario({
    label: '', stats: { academic: 70, mental: 40, social: 40, talent: 50, health: 50 },
    burnoutCount: 3, mockGrade: 3, track: 'humanities', expectCareer: '',
  });
  const e2 = calculateEnding(flame);
  if (e2.title.startsWith('불꽃은 꺼지지 않는다')) { console.log(`  ✓ 불꽃은 꺼지지 않는다 수식 적용`); passed++; }
  else { console.log(`  ✗ 불꽃은 꺼지지 않는다 미적용 (title="${e2.title}")`); failed++; }

  // 행복한 평범함: happiness S (mental≥80 && social≥60) + achievement C (bestAxis<50)
  // lifeScore=(mental+health+social)/3 이라 achievement C를 얻으려면 health를 매우 낮춰
  // lifeScore<50 을 만들어야 함
  const happy = withScenario({
    label: '', stats: { academic: 45, mental: 80, social: 60, talent: 45, health: 5 },
    mockGrade: 5, track: 'humanities', expectCareer: '',
  });
  const e3 = calculateEnding(happy);
  if (e3.title.startsWith('행복한 평범함')) { console.log(`  ✓ 행복한 평범함 수식 적용`); passed++; }
  else { console.log(`  ✗ 행복한 평범함 미적용 (title="${e3.title}", achievement=${e3.achievement}, happiness=${e3.happiness})`); failed++; }
}

// ========================================
// 결과
// ========================================
console.log(`\n=== 결과: ${passed} passed / ${failed} failed ===`);
if (failed > 0) {
  console.log('\n실패 상세:');
  failures.forEach(f => console.log(`  - ${f.label}\n      expected "${f.expected}", got "${f.got}"`));
  process.exit(1);
}
