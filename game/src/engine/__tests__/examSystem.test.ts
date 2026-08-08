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

/** 수능 점수는 직전 모의 2회에서 만들어진다(suneungBase). 상위권 수능을 만들려면 이력이 필요하다. */
function mockExamFixture(score: number): ExamResult {
  const subject = { score, grade: 'S' as const, delta: 0 };
  return {
    subjects: {
      korean: { ...subject }, english: { ...subject }, math: { ...subject },
      socialScience: { ...subject }, artsPhysical: { score: 0, grade: 'D', delta: 0 },
    },
    average: score, rank: null, prevRank: null,
    comment: '', parentReaction: '', teacherReaction: '',
    examType: 'mock', schoolLevel: 'high', year: 7, semester: 1,
    mockGrade: 1, mentalDelta: 0,
  };
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
//       ⑤ 컨디션이 나빠도 **결과가 좋으면** 성취를 지우지 않는다 — 원인은 덧붙이기만 한다
//       ⑥ 어떤 대사도 등급을 단정하지 않는다(같은 줄이 1등급·9등급 양쪽에 쓰인다)
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

  // 결과가 좋을 때의 동작(성취 보존)을 보려면 실제로 잘 보는 학생이 필요하다.
  const topState = (overrides: Partial<GameState> = {}): GameState =>
    examState({
      year: 7, week: 12,
      stats: { academic: 100, social: 60, talent: 60, mental: 100, health: 80 },
      ...overrides,
    });

  // hide-numbers 정체성 가드 — 막아야 하는 건 "메커니즘 수치"이지 서사 숫자가 아니다.
  // 허용: "7년을 달려와서", "새벽 세 시" (이야기의 숫자)
  // 금지: "피로 59", "-8점", "효율 45%", "멘탈 20 미만" (계산기 언어)
  const expectNoNumbers = (s: string) => {
    expect(s).not.toMatch(/[-+]?\d+\s*(점|%|퍼센트|포인트|배)/);
    expect(s).not.toMatch(/(피로|멘탈|학업|체력|인기|특기|효율|등급|점수)\s*[-+]?\d/);
    expect(s).not.toMatch(/피로도|패널티|배율|소프트캡|감쇠/);
  };

  // 컨디션이 원인으로 지목됐는가 — 대체 문장(dominant)과 덧붙임 문장(aside) 모두 "지목"으로 센다.
  const ATTRIBUTED = /손이 안 나갔다|잠이 모자란|머리가 하얘|집중이 끝까지 안 갔다|멍하니 앉아있었다|실력 발휘가 안 됐다|제대로 쉬지를 못했다|끝까지 붙잡고 있질 못했다|마냥 웃을 수만은|온전한 몸이었으면|마음에 걸렸다|더 나았을 것 같다|기울어 있었다|그대로 성적표가 됐다|성적표로 치렀다|몸이 가벼워지질 않았다|받아낸 결과였다|헛되지는 않았다|결과는 나왔다/;

  // 담임이 과목 처방 대신 휴식을 처방했는가 (CONDITION_TEACHER 4줄).
  const REST_PRESCRIPTION = /좀 쉬어야 해|잠 몇 시간|주말에 하루는 진짜로 쉬어|몸이 안 받쳐주면/;

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

    // 초판의 이 테스트는 fatigue를 HIGH_FATIGUE-1(=59)로 줬는데, 그건 MILD_FATIGUE(40) 이상이라
    // 실제로는 컨디션 분기가 발동하는 지점이었다. 강한 문장 3개의 부재만 검사해서 통과했을 뿐,
    // "컨디션 정상"도 "등급 코멘트 유지"도 검증하지 못했다(3자 리뷰에서 지적). 이제
    // 페널티가 아예 0인 구간을 쓰고, 등급 코멘트가 나왔는지를 긍정형으로 못박는다.
    it('페널티가 없는 피로 구간에서는 등급 기반 코멘트를 유지한다 (과발동 금지)', () => {
      const r = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue: 0 })), 'normal');
      expect(r.comment).not.toMatch(ATTRIBUTED);
      expect(r.comment).toMatch(/전국 상위권|나쁘지 않은 성적|중간 정도|갈 길이 멀다|심각한 상황/);
    });

    it('담임 처방이 과목 공략 대신 휴식으로 바뀐다', () => {
      const tired = generateMockExamResult(cloneForExam(highState({ mentalState: 'tired' })), 'normal');
      expect(tired.teacherReaction).toMatch(/잠 몇 시간/);
      expect(tired.teacherReaction).not.toMatch(/약한 과목|기초부터/);
      expectNoNumbers(tired.teacherReaction);

      const burnout = generateMockExamResult(cloneForExam(highState({ mentalState: 'burnout' })), 'normal');
      expect(burnout.teacherReaction).toMatch(/좀 쉬어야 해/);

      const fat = generateMockExamResult(
        cloneForExam(highState({ mentalState: 'normal', fatigue: HIGH_FATIGUE })), 'normal');
      expect(fat.teacherReaction).toMatch(/주말에 하루는 진짜로 쉬어/);
    });

    // 리뷰 재현: 피로 45로 1등급을 받은 학생의 총평이 "집중이 끝까지 안 갔다"로 덮이고,
    // 담임은 "한 등급은 더 나온다"고 했다(1등급 위는 없다). 성취가 화면에서 사라졌다.
    it('컨디션이 나빠도 결과가 좋으면 등급 코멘트를 남기고 원인만 덧붙인다', () => {
      const r = generateMockExamResult(
        cloneForExam(topState({ mentalState: 'normal', fatigue: 45 })), 'cram');
      expect(r.mockGrade!).toBeLessThanOrEqual(2);
      expect(r.comment).toMatch(/전국 상위권/);          // 성취가 남아 있다
      expect(r.comment).toMatch(ATTRIBUTED);              // 원인도 짚는다
      expect(r.teacherReaction).toMatch(/컨디션 관리에 집중하자/);
      expectNoNumbers(r.comment);
      expectNoNumbers(r.teacherReaction);
    });

    // 같은 담임 대사 한 줄이 1등급과 9등급 양쪽에 쓰인다. 어느 쪽에서도 거짓이면 안 된다.
    it('담임 대사가 실력·등급을 단정하지 않는다', () => {
      const causes: Partial<GameState>[] = [
        { mentalState: 'burnout' }, { mentalState: 'tired' },
        { mentalState: 'normal', fatigue: HIGH_FATIGUE }, { mentalState: 'normal', fatigue: 45 },
      ];
      for (const ov of causes) {
        const bottom = generateMockExamResult(
          cloneForExam(highState({ stats: { academic: 5, social: 30, talent: 20, mental: 40, health: 40 }, ...ov })),
          'normal');
        expect(bottom.mockGrade!).toBeGreaterThanOrEqual(5);
        // "실력은 붙었어"(바닥 성적에 거짓) / "한 등급은 더"(1등급에 거짓) 류의 단정 금지
        expect(bottom.teacherReaction, `${JSON.stringify(ov)} 담임이 실력을 단정한다`)
          .not.toMatch(/실력은 붙었어|한 등급은 더|공부량 문제가 아니야/);
      }
    });
  });

  describe('수능', () => {
    // 수능은 다시 못 보는 시험이라 "쉬어라"가 성립하지 않는다 → 조언이 아니라 회한으로.
    it('컨디션별 회한 문장을 남긴다', () => {
      const cases: [Partial<GameState>, RegExp][] = [
        [{ mentalState: 'burnout' }, /기울어 있었다/],
        [{ mentalState: 'tired' }, /그대로 성적표가 됐다/],
        [{ mentalState: 'normal', fatigue: HIGH_FATIGUE }, /성적표로 치렀다/],
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
      expect(r.comment).not.toMatch(ATTRIBUTED);
    });

    // 이 PR 최대의 버그였다. suneungScore = mock1*0.40 + mock2*0.50 + internalAvg*0.10 이라
    // 수능 주차의 fatigue·mentalState는 결과에 1점도 안 들어간다. 그런데 초판 문장은
    // "그날 몸이 멈춰 섰다"고 인과를 주장했다 — 실측하면 네 케이스가 전부 같은 점수였다.
    // 계약: 수능 귀인은 "그날"이 아니라 "그 몇 달"의 층위로만 말한다.
    it('수능 귀인은 당일이 아니라 그 몇 달을 지목한다', () => {
      const overrides: Partial<GameState>[] = [
        { mentalState: 'burnout' }, { mentalState: 'tired' },
        { mentalState: 'normal', fatigue: HIGH_FATIGUE }, { mentalState: 'normal', fatigue: 45 },
      ];
      for (const ov of overrides) {
        const r = generateSuneungResult(cloneForExam(highState({ week: 35, ...ov })));
        expect(r.comment, `${JSON.stringify(ov)}: 당일 인과를 주장한다`)
          .not.toMatch(/그날|가장 중요한 날|시험 중에|그날 아침/);
      }
    });

    // 수능 당일 컨디션이 점수에 안 들어간다는 사실 자체를 못박는다. 이게 깨지면(= 산식에
    // 컨디션이 들어가면) 위 "그 몇 달" 문장은 오히려 부정확해지므로 같이 재검토해야 한다.
    it('수능 점수는 당일 컨디션과 무관하다 (문장 층위의 근거)', () => {
      const scores = [
        { mentalState: 'normal', fatigue: 0 }, { mentalState: 'normal', fatigue: 95 },
        { mentalState: 'tired', fatigue: 95 }, { mentalState: 'burnout', fatigue: 95 },
      ].map(ov => generateSuneungResult(cloneForExam(highState({ week: 35, ...ov }))).average);
      expect(new Set(scores).size, `수능 점수가 당일 컨디션에 따라 달라졌다: ${scores.join('/')}`).toBe(1);
    });

    // 7년의 결말에서 잘 본 수능의 성취를 회한이 덮으면 안 된다
    // (초판 재현: 2등급인데 총평 "실력을 쓸 기회조차 없었다" + 담임 "축하한다").
    it('결과가 좋으면 회한이 성취를 덮지 않는다', () => {
      const r = generateSuneungResult(cloneForExam(topState({
        week: 35, mentalState: 'burnout',
        examResults: [mockExamFixture(97), mockExamFixture(98)],
      })));
      expect(r.mockGrade!).toBeLessThanOrEqual(2);
      expect(r.comment).toMatch(/12년의 노력이 빛을 발했다/);
      expect(r.comment).toMatch(/받아낸 결과였다/);
      expect(r.comment).not.toMatch(/기울어 있었다/);
      expectNoNumbers(r.comment);
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

    // 초등도 burnout(-8)·tired(-3)는 실제로 점수를 깎으므로 그건 지목한다 — 뺀 건 피로 단계뿐이다.
    it('초등에서도 burnout·tired는 지목한다', () => {
      for (const ms of ['burnout', 'tired'] as const) {
        const r = generateExamResult(
          cloneForExam(examState({ year: 1, week: 17, mentalState: ms })), 'unit-test', 'normal');
        expect(r.comment, `초등 ${ms}가 침묵한다`).toMatch(ATTRIBUTED);
      }
    });

    // 총평만 컨디션으로 바꾸고 담임은 과목 처방을 유지하면 같은 카드에서 두 줄이 어긋난다
    // (리뷰 재현: 총평 "아는 건 다 썼는데" 바로 밑에 담임 "기초가 부족한 과목이 있어").
    it('총평이 컨디션을 지목하면 담임 처방도 같이 바뀐다', () => {
      const r = generateExamResult(
        cloneForExam(examState({ year: 6, week: 8, mentalState: 'normal', fatigue: HIGH_FATIGUE })),
        'midterm', 'normal');
      expect(r.average).toBeLessThan(70);
      expect(r.comment).toMatch(ATTRIBUTED);
      // 긍정형으로 못박는다 — 부정형만 두면 담임 분기를 통째로 지워도 폴백 대사가 통과해버린다.
      expect(r.teacherReaction).toMatch(REST_PRESCRIPTION);
      expect(r.teacherReaction).not.toMatch(/기초가 부족한|약한 과목|보충 수업/);
      expectNoNumbers(r.teacherReaction);
    });

    // 모의·수능과 같은 계약 — 잘 본 내신에서 성취를 지우지 않는다.
    it('컨디션이 나빠도 결과가 좋으면 등급 코멘트를 남기고 원인만 덧붙인다', () => {
      const r = generateExamResult(
        cloneForExam(examState({
          year: 6, week: 8, mentalState: 'normal', fatigue: 45,
          stats: { academic: 100, social: 80, talent: 90, mental: 100, health: 90 },
        })), 'midterm', 'normal');
      expect(r.average).toBeGreaterThanOrEqual(70);
      expect(r.comment).toMatch(/훌륭한 성적|안정적인 성적/); // 성취가 남아 있다
      expect(r.comment).toMatch(ATTRIBUTED);                  // 원인도 짚는다
      expectNoNumbers(r.comment);
    });

    // 바닥 성적에 "아는 건 다 썼는데"를 붙이면 담임의 "기초가 부족하다"와 정면으로 충돌한다.
    it('컨디션 문장이 실력을 단정하지 않는다', () => {
      const r = generateExamResult(
        cloneForExam(examState({
          year: 6, week: 8, mentalState: 'normal', fatigue: 45,
          stats: { academic: 10, social: 30, talent: 20, mental: 45, health: 40 },
        })), 'midterm', 'normal');
      expect(r.comment).not.toMatch(/아는 건 다 썼|실력은 붙었/);
    });
  });

  // 임계값을 소스에서 읽는 위 테스트들은 "동작"만 잠그고 "임계 위치"는 못 잠근다.
  // 진짜 불변식은 피로 페널티 곡선과 귀인이 **같은 지점에서** 켜지고 꺼져야 한다는 것이고,
  // 그건 양방향이다. 초판은 한쪽(침묵 금지)만 잠가서 임계를 내리는 뮤테이션이 전부 통과했다 —
  // MILD_FATIGUE를 0으로 두면 게임의 모든 시험이 컨디션 문장이 되는데도 스위트가 green이었다.
  //
  // 스윕이 보는 값에 대하여: r.average는 표시용 과목 평균이라 getCommonMod 밴드
  // (<20:+3 / <40:0 / <60:-3 / <80:-6 / 이상:-10)를 따르고, 등급을 정하는 mockScore는
  // 별도 밴드(<40:0 / <60:-3 / <80:-6 / 이상:-9)를 쓴다. 두 곡선이 갈라지는 구간이 피로 20~39이고
  // 거기서 평균이 3점 내려간다(페널티가 아니라 +3 보너스 상실).
  // rand는 매 호출 같은 시드로 재생성돼 정확히 상쇄되므로 실측 낙폭은 0/3/6/9/13으로 결정론적이다 —
  // MATERIAL_DROP=5는 노이즈 마진이 아니라 "보너스 상실(3)"과 "실제 페널티(6+)"를 가르는 선이다.
  const MATERIAL_DROP = 5;

  const sweepBoth = (kind: 'mock' | 'internal') => {
    const at = (fatigue: number) => {
      const s = kind === 'mock'
        ? highState({ mentalState: 'normal', fatigue })
        : examState({ year: 3, mentalState: 'normal', fatigue });
      const r = kind === 'mock'
        ? generateMockExamResult(cloneForExam(s), 'normal')
        : generateExamResult(cloneForExam(s), 'midterm', 'normal');
      return { score: r.average, comment: r.comment };
    };
    const base = at(0).score;
    const rows: { f: number; drop: number; attributed: boolean }[] = [];
    for (let f = 0; f <= 100; f += 10) {
      const { score, comment } = at(f);
      rows.push({ f, drop: base - score, attributed: ATTRIBUTED.test(comment) });
    }
    return rows;
  };

  for (const kind of ['mock', 'internal'] as const) {
    // 초판은 모의만 스윕해서 내신 경로의 약한 단계는 어떤 테스트도 커버하지 않았다
    // (그 분기를 통째로 지워도 17/17 green이었다). 두 경로를 같은 불변식으로 잠근다.
    it(`[${kind}] 점수가 깎이는 피로 구간에 침묵 구간이 없다`, () => {
      const silent = sweepBoth(kind).filter(r => r.drop >= MATERIAL_DROP && !r.attributed).map(r => r.f);
      expect(silent, `피로 ${silent.join('/')}에서 점수는 깎였는데 원인을 지목하지 않는다`).toEqual([]);
    });

    // 반대 방향 — 임계를 내리는 뮤테이션(MILD 40→0/20, HIGH 60→20)을 잡는다.
    it(`[${kind}] 점수가 안 깎이는 피로 구간은 지목하지 않는다 (과발동 금지)`, () => {
      const noisy = sweepBoth(kind).filter(r => r.drop < MATERIAL_DROP && r.attributed).map(r => r.f);
      expect(noisy, `피로 ${noisy.join('/')}에서 점수는 그대로인데 컨디션을 탓한다`).toEqual([]);
    });
  }

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
