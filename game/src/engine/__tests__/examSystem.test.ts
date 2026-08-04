import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import {
  generateExamResult,
  generateMockExamResult,
  generateSuneungResult,
  getExamSchedule,
  isExamPeriod,
} from '../examSystem';
import type { ExamResult, GameState, ParentStrength, SubjectKey } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const SUBJECT_KEYS: SubjectKey[] = [
  'korean',
  'english',
  'math',
  'socialScience',
  'artsPhysical',
];

/** examSystem clamp 기본 범위(score 0~100)와 rank 상한을 소스에서 읽어 하드코딩을 피한다.
 *  mockGradeMax는 9등급제 고정 상한(toMockGrade 최하 분기 = 9)이라 소스 파싱 없이 상수로 둔다. */
const MOCK_GRADE_MAX = 9;
function readExamBounds(): { scoreMin: number; scoreMax: number; mockGradeMax: number; rankMax: number } {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../examSystem.ts'),
    'utf8',
  );
  const clamp = src.match(/function clamp\(v: number, min\s*=\s*(\d+),\s*max\s*=\s*(\d+)\)/);
  const rank = src.match(/clamp\([^,]+,\s*1,\s*(\d+)\)/);
  if (!clamp || !rank) {
    throw new Error('exam bounds not found in examSystem.ts');
  }
  return {
    scoreMin: Number(clamp[1]),
    scoreMax: Number(clamp[2]),
    mockGradeMax: MOCK_GRADE_MAX,
    rankMax: Number(rank[1]),
  };
}

function examState(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: 12345 });
  state.year = 3;
  state.week = 8;
  state.semester = 1;
  state.stats = { academic: 60, social: 50, talent: 40, mental: 55, health: 50 };
  state.fatigue = 30;
  return Object.assign(state, overrides);
}

function cloneForExam(state: GameState): GameState {
  return structuredClone(state);
}

function expectSubjectScoresInRange(
  result: ExamResult,
  scoreMin: number,
  scoreMax: number,
  opts?: { artsPhysicalFixed?: number },
): void {
  for (const key of SUBJECT_KEYS) {
    const score = result.subjects[key].score;
    if (opts?.artsPhysicalFixed !== undefined && key === 'artsPhysical') {
      expect(score).toBe(opts.artsPhysicalFixed);
      continue;
    }
    expect(score).toBeGreaterThanOrEqual(scoreMin);
    expect(score).toBeLessThanOrEqual(scoreMax);
  }
  expect(result.average).toBeGreaterThanOrEqual(scoreMin);
  expect(result.average).toBeLessThanOrEqual(scoreMax);
}

describe('getExamSchedule', () => {
  it('snapshots schedule shape for representative years (elem/mid/high/y7)', () => {
    // 숫자 키 Record는 스냅샷 직렬화 순서가 불안정 → [week, type] 엔트리로 고정
    const entries = (year: number) =>
      Object.keys(getExamSchedule(year))
        .map(Number)
        .sort((a, b) => a - b)
        .map(week => [week, getExamSchedule(year)[week]] as const);

    expect(entries(1)).toEqual([
      [17, 'unit-test'],
      [38, 'unit-test'],
    ]);
    expect(entries(3)).toEqual([
      [8, 'midterm'],
      [17, 'final'],
      [30, 'midterm'],
      [38, 'final'],
    ]);
    expect(entries(6)).toEqual([
      [8, 'midterm'],
      [12, 'mock'],
      [17, 'final'],
      [30, 'midterm'],
      [33, 'mock'],
      [38, 'final'],
    ]);
    expect(entries(7)).toEqual([
      [8, 'midterm'],
      [12, 'mock'],
      [17, 'final'],
      [30, 'midterm'],
      [33, 'mock'],
      [35, 'suneung'],
    ]);
  });
});

describe('isExamPeriod', () => {
  it('is consistent with getExamSchedule (exam weeks are in period)', () => {
    for (const year of [1, 3, 6, 7]) {
      const schedule = getExamSchedule(year);
      for (const week of Object.keys(schedule).map(Number)) {
        expect(isExamPeriod(year, week)).toBe(true);
        // 소스: 시험 직전 주(week - 1)도 시험 기간
        expect(isExamPeriod(year, week - 1)).toBe(true);
      }
    }
  });
});

describe('generateExamResult', () => {
  const { scoreMin, scoreMax, rankMax } = readExamBounds();

  it('is deterministic for the same seed/input', () => {
    const a = generateExamResult(cloneForExam(examState()), 'midterm', 'normal');
    const b = generateExamResult(cloneForExam(examState()), 'midterm', 'normal');
    expect(a).toEqual(b);
  });

  it('returns grades/scores within source-defined ranges', () => {
    const result = generateExamResult(cloneForExam(examState()), 'midterm', 'normal');

    expectSubjectScoresInRange(result, scoreMin, scoreMax);
    expect(result.examType).toBe('midterm');
    expect(result.schoolLevel).toBe('middle');
    expect(result.rank).not.toBeNull();
    expect(result.rank!).toBeGreaterThanOrEqual(1);
    expect(result.rank!).toBeLessThanOrEqual(rankMax);
    expect(result.comment.length).toBeGreaterThan(0);
    expect(result.parentReaction.length).toBeGreaterThan(0);
    expect(result.teacherReaction.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.mentalDelta)).toBe(true);
  });

  it('elementary unit-test has null rank and elementaryGrade on subjects', () => {
    const state = examState({ year: 1, week: 17 });
    const result = generateExamResult(cloneForExam(state), 'unit-test', 'normal');

    expect(result.rank).toBeNull();
    expect(result.schoolLevel).toBe('elementary');
    for (const key of SUBJECT_KEYS) {
      expect(result.subjects[key].elementaryGrade).toBeDefined();
    }
  });
});

describe('generateMockExamResult', () => {
  const { scoreMin, scoreMax, mockGradeMax } = readExamBounds();

  it('is deterministic for the same seed/input', () => {
    const state = examState({ year: 6, week: 12, track: 'science' });
    const a = generateMockExamResult(cloneForExam(state), 'normal');
    const b = generateMockExamResult(cloneForExam(state), 'normal');
    expect(a).toEqual(b);
  });

  it('returns grades/scores within source-defined ranges (artsPhysical forced 0)', () => {
    const state = examState({ year: 6, week: 12, track: 'humanities' });
    const result = generateMockExamResult(cloneForExam(state), 'cram');

    expect(result.examType).toBe('mock');
    expect(result.schoolLevel).toBe('high');
    expect(result.rank).toBeNull();
    expect(result.mockGrade).toBeDefined();
    expect(result.mockGrade!).toBeGreaterThanOrEqual(1);
    expect(result.mockGrade!).toBeLessThanOrEqual(mockGradeMax);
    expectSubjectScoresInRange(result, scoreMin, scoreMax, { artsPhysicalFixed: 0 });
    expect(Number.isFinite(result.mentalDelta)).toBe(true);
    expect(result.comment.length).toBeGreaterThan(0);
  });
});

describe('generateSuneungResult', () => {
  const { scoreMin, scoreMax, mockGradeMax } = readExamBounds();

  it('is deterministic and returns fields within source ranges', () => {
    const state = examState({
      year: 7,
      week: 35,
      semester: 2,
      track: 'science',
      examResults: [],
    });

    const a = generateSuneungResult(cloneForExam(state));
    const b = generateSuneungResult(cloneForExam(state));
    expect(a).toEqual(b);

    expect(a.examType).toBe('suneung');
    expect(a.schoolLevel).toBe('high');
    expect(a.rank).toBeNull();
    expect(a.prevRank).toBeNull();
    expect(a.mockGrade).toBeDefined();
    expect(a.mockGrade!).toBeGreaterThanOrEqual(1);
    expect(a.mockGrade!).toBeLessThanOrEqual(mockGradeMax);
    expect(a.average).toBeGreaterThanOrEqual(scoreMin);
    expect(a.average).toBeLessThanOrEqual(scoreMax);
    expectSubjectScoresInRange(a, scoreMin, scoreMax, { artsPhysicalFixed: 0 });
    expect(a.comment.length).toBeGreaterThan(0);
    expect(a.parentReaction.length).toBeGreaterThan(0);
    expect(a.teacherReaction.length).toBeGreaterThan(0);
    expect(Number.isFinite(a.mentalDelta)).toBe(true);
  });
});

// 컨디션 귀인 서사 — 성적을 깎은 게 실력이 아니라 컨디션일 때 그 원인을 지목하는지.
// 배경: 상태패널티(tired -8 / burnout -15) + 피로패널티(최대 -9)의 합이 학업 80 초과분 반감보다
//   3배 이상 크다. 그런데 기존엔 burnout 한 줄만 언급하고 tired·고피로는 침묵해서,
//   플레이어가 "학업 A인데 왜 4등급인지" 알 방법이 없었다(담임은 과목 공략이라는 오진까지 줬다).
// 계약: ① tired·고피로도 컨디션을 지목한다 ② 담임 처방이 "쉬어라"로 바뀐다
//       ③ 컨디션 정상이면 종전 등급 기반 코멘트를 유지한다(과발동 금지)
//       ④ 수치·메커니즘 노출 금지(hide-numbers)
describe('컨디션 귀인 (조건부 시험 코멘트)', () => {
  // HIGH_FATIGUE(60)는 소스 상수 — 하드코딩 대신 소스에서 읽어 임계 변경에 따라붙게 한다.
  function readHighFatigue(): number {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../examSystem.ts'),
      'utf8',
    );
    const m = src.match(/const HIGH_FATIGUE\s*=\s*(\d+)/);
    if (!m) throw new Error('HIGH_FATIGUE 상수를 examSystem.ts에서 찾지 못함');
    return Number(m[1]);
  }
  const HIGH_FATIGUE = readHighFatigue();

  const highState = (overrides: Partial<GameState> = {}): GameState =>
    examState({ year: 7, week: 12, ...overrides });

  // hide-numbers 정체성 가드 — 막아야 하는 건 "메커니즘 수치"이지 서사 숫자가 아니다.
  // 허용: "7년을 달려와서", "새벽 세 시" (이야기의 숫자)
  // 금지: "피로 59", "-8점", "효율 45%", "멘탈 20 미만" (계산기 언어)
  const expectNoNumbers = (s: string) => {
    expect(s).not.toMatch(/[-+]?\d+\s*(점|%|퍼센트|포인트|배)/);
    expect(s).not.toMatch(/(피로|멘탈|학업|체력|인기|특기|효율|등급|점수)\s*[-+]?\d/);
    expect(s).not.toMatch(/피로도|패널티|배율|소프트캡|감쇠/);
  };

  describe('모의고사', () => {
    it('tired면 실력이 아니라 몸을 지목한다', () => {
      const r = generateMockExamResult(cloneForExam(highState({ mentalState: 'tired' })), 'normal');
      expect(r.comment).toMatch(/손이 안 나갔다/);
      expectNoNumbers(r.comment);
    });

    it('mentalState normal이어도 고피로면 컨디션을 지목한다', () => {
      const r = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue: HIGH_FATIGUE })), 'normal');
      expect(r.comment).toMatch(/잠이 모자란/);
      expectNoNumbers(r.comment);
    });

    it('컨디션이 정상이면 등급 기반 코멘트를 유지한다 (과발동 금지)', () => {
      const r = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue: HIGH_FATIGUE - 1 })), 'normal');
      expect(r.comment).not.toMatch(/손이 안 나갔다|잠이 모자란|머리가 하얘/);
    });

    it('담임 처방이 과목 공략 대신 휴식으로 바뀐다', () => {
      const tired = generateMockExamResult(cloneForExam(highState({ mentalState: 'tired' })), 'normal');
      expect(tired.teacherReaction).toMatch(/잠 몇 시간/);
      expect(tired.teacherReaction).not.toMatch(/약한 과목|기초부터/);

      const burnout = generateMockExamResult(cloneForExam(highState({ mentalState: 'burnout' })), 'normal');
      expect(burnout.teacherReaction).toMatch(/좀 쉬어야 해/);

      const fat = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue: HIGH_FATIGUE })), 'normal');
      expect(fat.teacherReaction).toMatch(/주말에 하루는 진짜로 쉬어/);
    });
  });

  describe('수능', () => {
    // 수능은 다시 못 보는 시험이라 "쉬어라"가 성립하지 않는다 → 조언이 아니라 회한으로.
    it('컨디션별 회한 문장을 남긴다', () => {
      const cases: [Partial<GameState>, RegExp][] = [
        [{ mentalState: 'burnout' }, /몸이 멈춰 섰다/],
        [{ mentalState: 'tired' }, /꺼낼 힘이 없었다/],
        [{ mentalState: 'normal', fatigue: HIGH_FATIGUE }, /덜 하고 더 잤어야/],
      ];
      for (const [ov, re] of cases) {
        const r = generateSuneungResult(cloneForExam(highState({ week: 35, ...ov })));
        expect(r.comment).toMatch(re);
        expectNoNumbers(r.comment);
      }
    });

    it('컨디션이 정상이면 종전 결과 코멘트를 유지한다', () => {
      const r = generateSuneungResult(
        cloneForExam(highState({ week: 35, mentalState: 'normal', fatigue: 0 })));
      expect(r.comment).not.toMatch(/몸이 멈춰|꺼낼 힘|덜 하고 더 잤/);
    });
  });

  describe('내신', () => {
    it('중등 이상은 고피로를 지목하고, 초등은 톤 보호를 위해 제외한다', () => {
      const mid = generateExamResult(
        cloneForExam(examState({ year: 3, mentalState: 'normal', fatigue: HIGH_FATIGUE })),
        'midterm', 'normal');
      expect(mid.comment).toMatch(/시험지 앞에서 자꾸 멍해졌다/);

      const elem = generateExamResult(
        cloneForExam(examState({ year: 1, week: 17, mentalState: 'normal', fatigue: HIGH_FATIGUE })),
        'unit-test', 'normal');
      expect(elem.comment).not.toMatch(/시험지 앞에서 자꾸 멍해졌다/);
    });
  });

  // 뮤테이션 검수에서 드러난 구멍 보강 (HIGH_FATIGUE를 60→95로 옮겨도 위 테스트는 전부 통과했다).
  // 위 테스트들은 임계값을 소스에서 읽으므로 "동작"은 잠그지만 "임계 위치"는 안 잠근다.
  // 진짜 불변식은 **침묵 구간이 없어야 한다**는 것 — 점수가 실질적으로 깎이는 피로 구간이라면
  // 반드시 그 원인을 지목해야 한다. HIGH_FATIGUE가 페널티 구간보다 높게 밀리면 이 테스트가 잡는다.
  it('점수가 깎이는 피로 구간에 침묵 구간이 없다', () => {
    const scoreAt = (fatigue: number) => {
      const r = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue })), 'normal');
      return { score: r.average, comment: r.comment };
    };
    const base = scoreAt(0).score;
    // 결정론적 rand(±12)가 섞이므로, 노이즈를 넘는 하락(≥5점)만 "실질 하락"으로 본다.
    const MATERIAL_DROP = 5;
    const silent: number[] = [];
    for (let f = 10; f <= 100; f += 10) {
      const { score, comment } = scoreAt(f);
      const dropped = base - score >= MATERIAL_DROP;
      // 강한 단계 + 약한 단계 모두 "원인을 지목함"으로 인정 (톤은 달라도 귀인은 귀인)
      const attributed = /손이 안 나갔다|잠이 모자란|머리가 하얘|집중이 끝까지 안 갔다/.test(comment);
      if (dropped && !attributed) silent.push(f);
    }
    expect(silent, `피로 ${silent.join('/')}에서 점수는 깎였는데 원인을 지목하지 않는다`).toEqual([]);
  });

  // 위 테스트는 "지목했는지"만 본다 — HIGH_FATIGUE를 위로 밀면 약한 단계가 전 구간을 덮어
  // 침묵은 없지만 가장 심한 피로에도 가벼운 문장이 붙는다(뮤테이션 M6로 확인). 톤↔심각도를 잠근다.
  it('가장 점수가 깎이는 피로 구간에는 강한 문장이 붙는다', () => {
    const sweep = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(fatigue => {
      const r = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue })), 'normal');
      return { fatigue, score: r.average, comment: r.comment };
    });
    const worst = sweep.reduce((a, b) => (b.score < a.score ? b : a));
    expect(worst.comment, `최악 구간(피로 ${worst.fatigue})에 약한 문장이 붙었다`)
      .toMatch(/잠이 모자란/);
    expect(worst.comment).not.toMatch(/집중이 끝까지 안 갔다/);
  });
  // 뮤테이션 검수 결과(8종): 7종 CAUGHT. 유일한 미검출은 HIGH_FATIGUE 60→75인데,
  // 이는 동일 페널티 밴드(-6은 60~79) 안에서의 톤 조정이라 회귀가 아니라 튜닝이다 —
  // 잠그려면 60을 하드코딩해야 하고 그건 [[project_contract_test_mutation_check]]가 피하려는
  // false lock 쪽에 가깝다. 밴드를 넘는 이동(60→95)은 위 테스트가 잡는다.
});
