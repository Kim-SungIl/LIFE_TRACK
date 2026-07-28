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
