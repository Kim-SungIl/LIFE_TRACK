import { GameState, ExamResult, SubjectResult, SubjectKey, ExamGrade, ElementaryGrade, ExamType, SchoolLevel } from './types';
import { seededRandom } from './rng';

// ===== 시험 스케줄 SSOT =====
// 학교급별 시험 주차. UI(GameScreen 다가오는 이벤트), 로직(advanceWeek), 이벤트 가드(study-cafe 등)가 동일한 출처를 공유한다.
export function getExamSchedule(year: number): Record<number, ExamType> {
  if (year <= 1) {
    return { 17: 'unit-test', 38: 'unit-test' };
  } else if (year <= 4) {
    return { 8: 'midterm', 17: 'final', 30: 'midterm', 38: 'final' };
  } else if (year === 7) {
    return { 8: 'midterm', 12: 'mock', 17: 'final', 30: 'midterm', 33: 'mock', 35: 'suneung' };
  } else {
    return { 8: 'midterm', 12: 'mock', 17: 'final', 30: 'midterm', 33: 'mock', 38: 'final' };
  }
}

// 시험 주 또는 시험 직전 주(준비 기간) 여부 — "시험 기간" 컨텍스트 가드
export function isExamPeriod(year: number, week: number): boolean {
  const examWeeks = Object.keys(getExamSchedule(year)).map(Number);
  return examWeeks.some(w => week === w - 1 || week === w);
}

// ===== 유틸리티 =====

// 결정론적 ±range 노이즈 — state.rngSeed를 mutate하므로 같은 시드면 같은 결과
function rand(state: GameState, range: number): number {
  return (seededRandom(state) - 0.5) * 2 * range;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, v)));
}

function toGrade(score: number): ExamGrade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}

function toElementaryGrade(score: number): ElementaryGrade {
  if (score >= 75) return '잘함';
  if (score >= 45) return '보통';
  return '노력필요';
}

function toMockGrade(score: number): number {
  if (score >= 93) return 1;  // QA C2-A: 96→93. internalAvg 드래그 제거 후 최적 빌드가 닿는 현실선
  if (score >= 89) return 2;
  if (score >= 77) return 3;
  if (score >= 60) return 4;
  if (score >= 40) return 5;
  if (score >= 23) return 6;
  if (score >= 11) return 7;
  if (score >= 4) return 8;
  return 9;
}

function getSchoolLevel(year: number): SchoolLevel {
  if (year <= 1) return 'elementary';
  if (year <= 4) return 'middle';
  return 'high';
}

// 고등학교 학업 소프트캡: 80 이후 증가량 반감 (상위권 변별력 확보)
function effectiveAcademic(academic: number): number {
  if (academic <= 80) return academic;
  return 80 + (academic - 80) * 0.5;
}

export type ExamPrep = 'cram' | 'normal' | 'friends';

// ===== 공통보정 (학교급별) =====

function getCommonMod(state: GameState, schoolLevel: SchoolLevel, prep: ExamPrep): number {
  const { mental } = state.stats;

  let mentalBonus: number;
  let fatigueBonus: number;
  let mentalStatePenalty: number;
  const prepBonus = prep === 'cram' ? 8 : prep === 'friends' ? 4 : 0;

  if (schoolLevel === 'elementary') {
    mentalBonus = mental >= 70 ? 3 : mental >= 50 ? 1 : mental >= 30 ? 0 : -3;
    fatigueBonus = state.fatigue < 30 ? 2 : state.fatigue < 60 ? 0 : -2;
    mentalStatePenalty = state.mentalState === 'burnout' ? -8 : state.mentalState === 'tired' ? -3 : 0;
  } else if (schoolLevel === 'middle') {
    mentalBonus = mental >= 70 ? 5 : mental >= 50 ? 2 : mental >= 30 ? 0 : mental >= 15 ? -4 : -8;
    fatigueBonus = state.fatigue < 20 ? 3 : state.fatigue < 40 ? 0 : state.fatigue < 60 ? -3 : state.fatigue < 80 ? -6 : -10;
    mentalStatePenalty = state.mentalState === 'burnout' ? -15 : state.mentalState === 'tired' ? -8 : 0;
  } else {
    // high — 고등은 yearPenalty 대신 soft cap 사용
    mentalBonus = mental >= 70 ? 5 : mental >= 50 ? 2 : mental >= 30 ? 0 : mental >= 15 ? -4 : -8;
    fatigueBonus = state.fatigue < 20 ? 3 : state.fatigue < 40 ? 0 : state.fatigue < 60 ? -3 : state.fatigue < 80 ? -6 : -10;
    mentalStatePenalty = state.mentalState === 'burnout' ? -15 : state.mentalState === 'tired' ? -8 : 0;
  }

  return mentalBonus + fatigueBonus + mentalStatePenalty + prepBonus;
}

// ===== 과목 점수 산출 (학교급별) =====

function calculateSubjectScores(
  state: GameState,
  schoolLevel: SchoolLevel,
  commonMod: number,
): Record<SubjectKey, SubjectResult> {
  const { academic, social, talent, mental, health } = state.stats;
  const subjects: Record<SubjectKey, SubjectResult> = {
    korean: { score: 0, grade: 'C', delta: 0 },
    english: { score: 0, grade: 'C', delta: 0 },
    math: { score: 0, grade: 'C', delta: 0 },
    socialScience: { score: 0, grade: 'C', delta: 0 },
    artsPhysical: { score: 0, grade: 'C', delta: 0 },
  };

  if (schoolLevel === 'elementary') {
    // 초등: 베이스 보너스(+8) + 계수 상향 — academic 70+에서 '잘함' 진입 가능
    const BASE = 8;
    subjects.korean.score = clamp(academic * 0.88 + talent * 0.12 + commonMod + BASE + rand(state, 4));
    subjects.english.score = clamp(academic * 0.90 + commonMod + BASE + rand(state, 4));
    subjects.math.score = clamp(academic * 0.92 + commonMod + BASE + rand(state, 5));
    subjects.socialScience.score = clamp(academic * 0.82 + social * 0.18 + commonMod + BASE + rand(state, 4));
    subjects.artsPhysical.score = clamp(talent * 0.70 + health * 0.25 + mental * 0.05 + commonMod + BASE + rand(state, 4));
  } else if (schoolLevel === 'middle') {
    // 중등: 계수 1.0 이하 유지 + 살짝 보너스 — academic 85+에서 S 등급 달성 가능
    const BASE = 4;
    subjects.korean.score = clamp(academic * 0.95 + talent * 0.10 + commonMod + BASE + rand(state, 6));
    subjects.english.score = clamp(academic * 0.98 + commonMod + BASE + rand(state, 6));
    subjects.math.score = clamp(academic * 1.00 + commonMod + BASE + rand(state, 8));
    subjects.socialScience.score = clamp(academic * 0.88 + social * 0.18 + commonMod + BASE + rand(state, 6));
    subjects.artsPhysical.score = clamp(talent * 0.70 + health * 0.25 + mental * 0.05 + commonMod + BASE + rand(state, 6));
  } else {
    // high — soft cap 임계값 80 + 계수 1.0 이하
    const ea = effectiveAcademic(academic);
    subjects.korean.score = clamp(ea * 0.95 + talent * 0.08 + commonMod + rand(state, 7));
    subjects.english.score = clamp(ea * 0.98 + commonMod + rand(state, 7));

    // 수학: 이과(가형)는 변동성 더 큼 — 난이도 UP
    const isScience = state.track === 'science';
    const mathRand = isScience ? 11 : 9;
    subjects.math.score = clamp(ea * 1.00 + commonMod + rand(state, mathRand));

    // 사회탐구(문과) vs 과학탐구(이과) 차등
    if (state.track === 'humanities') {
      // 문과 사회탐구: 글쓰기·토론·암기 → social 영향
      subjects.socialScience.score = clamp(ea * 0.92 + social * 0.15 + commonMod + rand(state, 7));
    } else if (state.track === 'science') {
      // 이과 과학탐구: 실험·논리·계산 → talent 영향, rand 큼
      subjects.socialScience.score = clamp(ea * 0.94 + talent * 0.10 + commonMod + rand(state, 9));
    } else {
      // track 미선택 (Y5 고1): 기존 공식 유지
      subjects.socialScience.score = clamp(ea * 0.90 + social * 0.15 + commonMod + rand(state, 7));
    }

    subjects.artsPhysical.score = clamp(talent * 0.72 + health * 0.22 + mental * 0.05 + commonMod + rand(state, 6));
  }

  // 등급 부여
  for (const key of Object.keys(subjects) as SubjectKey[]) {
    subjects[key].grade = toGrade(subjects[key].score);
    if (schoolLevel === 'elementary') {
      subjects[key].elementaryGrade = toElementaryGrade(subjects[key].score);
    }
  }

  return subjects;
}

// ===== 시험 결과 멘탈 후처리 =====

function getExamMentalDelta(average: number, schoolLevel: SchoolLevel): number {
  if (schoolLevel === 'elementary') return 0; // 초등은 페널티 없음
  const grade = toGrade(average);
  if (grade === 'S') return 2;
  if (grade === 'A') return 1;
  if (grade === 'B') return 0;
  if (grade === 'C') return -2;
  return -5; // D
}

function getMockMentalDelta(mockGrade: number): number {
  if (mockGrade <= 2) return 2;
  if (mockGrade <= 4) return 1;
  if (mockGrade <= 6) return 0;
  if (mockGrade === 7) return -2;
  return -4; // 8~9등급
}

// ===== 메인 시험 결과 생성 =====

export function generateExamResult(
  state: GameState,
  examType: ExamType,
  prep: ExamPrep = 'normal',
): ExamResult {
  const schoolLevel = getSchoolLevel(state.year);
  const commonMod = getCommonMod(state, schoolLevel, prep);
  const subjects = calculateSubjectScores(state, schoolLevel, commonMod);

  // 전 시험 대비 변화 — 직전 내신(midterm/final)만 비교 대상
  // (모의고사는 artsPhysical=0이라 내신과 비교 시 거짓 양수 delta 발생)
  const exams = state.examResults || [];
  const prevExam = exams.filter(e => e.examType === 'midterm' || e.examType === 'final').slice(-1)[0] || null;
  if (prevExam) {
    for (const key of Object.keys(subjects) as SubjectKey[]) {
      subjects[key].delta = subjects[key].score - prevExam.subjects[key].score;
    }
  }

  // 평균 계산 (주요과목 70%, 예체능 30%)
  const mainAvg = (subjects.korean.score + subjects.english.score + subjects.math.score + subjects.socialScience.score) / 4;
  const average = Math.round(mainAvg * 0.7 + subjects.artsPhysical.score * 0.3);

  // 석차: 초등은 없음
  const rank = schoolLevel === 'elementary'
    ? null
    : clamp(Math.round(30 - (average / 100) * 29), 1, 30);
  const prevRank = prevExam ? prevExam.rank : null;

  // 총평/반응 생성
  const comment = generateComment(subjects, average, state, schoolLevel);
  const parentReaction = generateParentReaction(rank, prevRank, average, state, schoolLevel);
  const teacherReaction = generateTeacherReaction(subjects, rank, state, schoolLevel, average);

  // 멘탈 후처리
  const mentalDelta = getExamMentalDelta(average, schoolLevel);

  return {
    subjects,
    average,
    rank,
    prevRank,
    comment,
    parentReaction,
    teacherReaction,
    examType,
    schoolLevel,
    year: state.year,
    semester: state.semester,
    mentalDelta,
  };
}

// ===== 모의고사 결과 생성 (고등 전용) =====

export function generateMockExamResult(
  state: GameState,
  prep: ExamPrep = 'normal',
): ExamResult {
  const ea = effectiveAcademic(state.stats.academic);
  const { mental } = state.stats;

  const prepBonus = prep === 'cram' ? 3 : prep === 'friends' ? 2 : 0;
  const fatiguePenalty = state.fatigue < 40 ? 0 : state.fatigue < 60 ? -3 : state.fatigue < 80 ? -6 : -9;
  const mentalStatePenalty = state.mentalState === 'burnout' ? -15 : state.mentalState === 'tired' ? -8 : 0;

  const mockScore = clamp(ea * 0.98 + mental * 0.15 + prepBonus + fatiguePenalty + mentalStatePenalty + rand(state, 12));
  const mockGrade = toMockGrade(mockScore);

  // 과목별 점수 생성 (표시용) — 모의고사는 예체능 제외 (실제 수능에 없음)
  const commonMod = getCommonMod(state, 'high', prep);
  const subjects = calculateSubjectScores(state, 'high', commonMod);
  // 예체능 점수는 모의/수능에서 의미 없음 — 0으로 설정 (UI에서 숨김)
  subjects.artsPhysical.score = 0;
  subjects.artsPhysical.grade = 'D';
  subjects.artsPhysical.delta = 0;

  const exams = state.examResults || [];
  // 직전 모의고사만 delta 비교 대상으로 사용 — 내신과는 점수 분포가 달라 섞이면 부정확
  // (커밋 4448f848 의도: "delta 계산: 모의→모의, 수능→모의 비교 — 내신-모의 섞임 방지")
  const prevExam = exams.filter(e => e.examType === 'mock').slice(-1)[0] || null;
  if (prevExam) {
    for (const key of Object.keys(subjects) as SubjectKey[]) {
      if (key === 'artsPhysical') continue;
      subjects[key].delta = subjects[key].score - prevExam.subjects[key].score;
    }
  }

  // 모의/수능 평균: 주요 4과목만 (예체능 제외)
  const average = Math.round((subjects.korean.score + subjects.english.score + subjects.math.score + subjects.socialScience.score) / 4);

  const mentalDelta = getMockMentalDelta(mockGrade);

  const comment = generateMockComment(mockGrade, state);
  const parentReaction = generateMockParentReaction(mockGrade, state);
  const teacherReaction = generateMockTeacherReaction(mockGrade, state);

  return {
    subjects,
    average,
    rank: null,
    prevRank: prevExam?.rank ?? null,
    comment,
    parentReaction,
    teacherReaction,
    examType: 'mock',
    schoolLevel: 'high',
    year: state.year,
    semester: state.semester,
    mockGrade,
    mentalDelta,
  };
}

// ===== 수능 결과 생성 (Y7 전용) =====

export function generateSuneungResult(state: GameState): ExamResult {
  // 모의고사 결과 가져오기
  const mockResults = state.examResults.filter(e => e.examType === 'mock');
  const mock1 = mockResults.length >= 1 ? mockResults[mockResults.length >= 2 ? mockResults.length - 2 : 0].average : state.stats.academic * 0.8;
  const mock2 = mockResults.length >= 1 ? mockResults[mockResults.length - 1].average : state.stats.academic * 0.85;
  const internalExams = state.examResults.filter(e => e.examType === 'midterm' || e.examType === 'final');
  const internalAvg = internalExams.length > 0
    ? internalExams.reduce((sum, e) => sum + e.average, 0) / internalExams.length
    : state.stats.academic * 0.7;

  // QA C2-A: internalAvg(Y1~Y7 내신 평균 ~80)가 천장을 막아 mock 92~97 도 수능 88로 추락 → 1등급 불가.
  // 내신 가중 0.20→0.10, 자유분 0.10은 mock 으로 이전(0.35/0.45 → 0.40/0.50). mock 우위 최적화 빌드만 수혜.
  const suneungBase = mock1 * 0.40 + mock2 * 0.50 + internalAvg * 0.10;
  const growthBonus = clamp(Math.round((mock2 - mock1) * 0.15), 0, 3);
  const suneungScore = clamp(Math.round(suneungBase + growthBonus + rand(state, 3)));
  const mockGrade = toMockGrade(suneungScore);

  // 과목별 (표시용) — 수능도 예체능 제외
  const commonMod = getCommonMod(state, 'high', 'normal');
  const subjects = calculateSubjectScores(state, 'high', commonMod);
  subjects.artsPhysical.score = 0;
  subjects.artsPhysical.grade = 'D';
  subjects.artsPhysical.delta = 0;

  const prevExam = state.examResults.filter(e => e.examType === 'mock').slice(-1)[0] || null;
  if (prevExam) {
    for (const key of Object.keys(subjects) as SubjectKey[]) {
      if (key === 'artsPhysical') continue;
      subjects[key].delta = subjects[key].score - prevExam.subjects[key].score;
    }
  }

  const mentalDelta = getMockMentalDelta(mockGrade);

  return {
    subjects,
    average: suneungScore,
    rank: null,
    prevRank: null,
    comment: generateSuneungComment(mockGrade, state),
    parentReaction: generateSuneungParentReaction(mockGrade, state),
    teacherReaction: generateSuneungTeacherReaction(mockGrade),
    examType: 'suneung',
    schoolLevel: 'high',
    year: state.year,
    semester: state.semester,
    mockGrade,
    mentalDelta,
  };
}

// ===== 총평 생성 =====

const LABELS: Record<SubjectKey, string> = {
  korean: '국어', english: '영어', math: '수학',
  socialScience: '사회/과학', artsPhysical: '예체능',
};

function generateComment(
  subjects: Record<SubjectKey, SubjectResult>,
  average: number,
  state: GameState,
  schoolLevel: SchoolLevel,
): string {
  const best = (Object.keys(subjects) as SubjectKey[]).reduce((a, b) => subjects[a].score > subjects[b].score ? a : b);
  const worst = (Object.keys(subjects) as SubjectKey[]).reduce((a, b) => subjects[a].score < subjects[b].score ? a : b);

  const base = schoolLevel === 'elementary'
    ? (average >= 75 ? `이번 단원평가 잘 봤다! 특히 ${LABELS[best]}을 잘했어.`
      : average >= 45 ? '무난하게 잘 했어. 꾸준히 하면 돼!'
      : '조금 어려웠지? 다음엔 더 잘할 수 있을 거야.')
    : average >= 85 ? `전반적으로 훌륭한 성적. 특히 ${LABELS[best]}에서 두각을 드러냈다.`
    : average >= 70 ? `안정적인 성적이지만, ${LABELS[worst]}은 좀 더 노력이 필요하다.`
    : average >= 50 ? `중간 정도의 성적. ${LABELS[best]}은 강점이지만 전반적으로 아쉽다.`
    : average >= 30 ? `공부에 시간을 더 쏟아야 할 것 같다. ${LABELS[best]}만 그나마 버텼다.`
    : '전체적으로 많이 부족하다. 기초부터 다시 잡아야 할 것 같다.';

  // 컨디션 귀인은 아래 "컨디션 귀인" 섹션의 SSOT(internalConditionCause)를 쓴다.
  return withCondition(base, internalConditionCause(state, schoolLevel), average < POOR_INTERNAL_AVERAGE, INTERNAL_CONDITION_COMMENT);
}

// ===== 부모 반응 =====

function generateParentReaction(
  rank: number | null,
  prevRank: number | null,
  average: number,
  state: GameState,
  schoolLevel: SchoolLevel,
): string {
  const isStrict = state.parents.includes('strict');
  const isEmotional = state.parents.includes('emotional');

  if (schoolLevel === 'elementary') {
    if (average >= 75) {
      if (isEmotional) return '"우리 아이 잘했네~ 대단해!"';
      return '"오, 잘했구나! 수고했어."';
    }
    if (average >= 45) {
      return '"괜찮아, 잘하고 있어."';
    }
    if (isStrict) return '"음... 다음엔 좀 더 해보자."';
    if (isEmotional) return '"괜찮아~ 엄마가 같이 봐줄까?"';
    return '"조금 아쉽지만, 다음에 잘하면 돼."';
  }

  // 중등/고등: rank 기반
  if (rank === null) return '';

  if (rank <= 3) {
    if (isStrict) return '"잘했다. 다음엔 더 잘할 수 있겠지?"';
    if (isEmotional) return '"우리 아이 정말 대단해! 고생했어~"';
    return '"오, 이번에 잘 봤구나!"';
  }
  if (rank <= 10) {
    if (isStrict) return '"나쁘진 않은데... 좀 더 올릴 수 있지 않아?"';
    return '"꽤 잘한 거 같은데? 수고했어."';
  }
  if (rank <= 20) {
    if (schoolLevel === 'high') {
      if (isStrict) return '"지금 성적이면 원하는 대학 힘들다."';
      return '"좀 더 신경 써야 할 것 같은데..."';
    }
    if (isStrict) return '"이게 최선이니? 학원을 더 다녀야 하는 거 아니야?"';
    if (isEmotional) return '"괜찮아, 다음에 더 잘하면 되지."';
    return '"음... 조금 더 노력해보자."';
  }
  // 20등 이하
  if (prevRank !== null && rank < prevRank) {
    return '"그래도 지난번보단 올랐네. 조금씩 가자."';
  }
  if (schoolLevel === 'high') {
    if (isStrict) return '"이러면 안 돼. 진지하게 얘기 좀 하자."';
    if (isEmotional) return '"힘들지? 그래도 포기하면 안 돼..."';
    return '"걱정된다... 다음엔 좀 더 해보자."';
  }
  if (isStrict) return '"이러면 안 되지... 이번 주부터 학원 더 다녀."';
  if (isEmotional) return '"힘들었지? 천천히 하자. 엄마가 도와줄게."';
  return '"좀... 아쉽다. 다음엔 더 열심히 해보자."';
}

// ===== 선생님 반응 =====

function generateTeacherReaction(
  subjects: Record<SubjectKey, SubjectResult>,
  rank: number | null,
  state: GameState,
  schoolLevel: SchoolLevel,
  average: number,
): string {
  // 총평이 컨디션을 지목했는데 담임만 과목 처방을 주면 같은 카드에서 두 줄이 어긋난다
  // (총평 "마지막 몇 문제에서 힘이 빠졌다" 바로 밑에 담임 "기초가 부족한 과목이 있어").
  // 초등 담임은 격려체 톤이라 제외한다.
  if (schoolLevel !== 'elementary') {
    const cause = internalConditionCause(state, schoolLevel);
    if (cause && average < POOR_INTERNAL_AVERAGE) return CONDITION_TEACHER[cause];
  }

  const artsGrade = subjects.artsPhysical.grade;
  const mainGrades = [subjects.korean.grade, subjects.english.grade, subjects.math.grade, subjects.socialScience.grade];
  const hasS = mainGrades.includes('S');
  const hasD = mainGrades.includes('D');

  if (schoolLevel === 'elementary') {
    if (hasS) return '"잘하는 과목이 있네! 이 조자 그대로 쭉 가자."';
    if (hasD) return '"조금만 더 집중하면 충분히 좋아질 수 있어!"';
    return '"잘하고 있어. 꾸준히 하자!"';
  }

  if (rank !== null && rank <= 3) {
    if (schoolLevel === 'high') return '"이 성적이면 어디든 갈 수 있어. 계속 이렇게만 하자."';
    return '"이 성적이면 어디든 갈 수 있어. 계속 이렇게만 하자."';
  }
  if (hasS && artsGrade === 'S') return '"주요 과목도 좋고, 예체능도 뛰어나. 다재다능하구나."';
  if (artsGrade === 'S' && !hasS) return '"예체능 쪽에 확실한 재능이 있어. 이쪽으로 길을 생각해봐도 좋겠다."';
  if (hasS) return '"잘하는 과목이 있으니까, 약한 과목도 끌어올려 보자."';
  if (hasD) {
    if (schoolLevel === 'high') return '"기초가 부족한 과목이 있어. 지금부터라도 잡아야 해."';
    return '"기초가 부족한 과목이 있어. 보충 수업을 고려해보렴."';
  }
  return '"무난하게 잘 하고 있어. 꾸준히 하자."';
}

// ===== 컨디션 귀인 (조건부 서사) =====
// 시험 점수를 실제로 깎은 게 실력이 아니라 컨디션일 때, 그 사실을 서사로 지목한다.
// 배경: mockScore = ea*0.98 + mental*0.15 + 피로패널티 + 상태패널티 인데
//   상태패널티(tired -8 / burnout -15)와 피로패널티(최대 -9)의 합이 최대 -17로,
//   학업 80 초과분이 0.5배로 눌리는 것(82→91 올려도 실효 +4.5)보다 3배 이상 크다.
//   즉 "공부량"보다 "컨디션"이 등급을 지배하는데, 기존 코멘트는 burnout 한 줄만 언급하고
//   tired·고피로는 침묵해서 플레이어가 성적이 왜 안 나오는지 알 방법이 없었다
//   (능력치는 학업 A로 잘 나와 있고, 담임은 "약한 과목 공략"이라는 엉뚱한 처방을 준다).
// 원칙: 수치·메커니즘은 노출하지 않는다("피로 59", "-8점" 금지). hide-numbers 정체성 유지 —
//   느낌과 원인만 말한다. 밸런스는 손대지 않는다.
//
// 반환 null = 컨디션이 성적을 깎지 않았음(정상 코멘트로 폴백).
type ConditionCause = 'burnout' | 'tired' | 'fatigue' | 'fatigueMild';

// 피로 임계는 페널티 곡선의 실제 변곡점에 맞춘다 —
//   mock:  <40:0 / <60:-3 / <80:-6 / 이상:-9   (generateMockExamResult)
//   내신:  <20:+3 / <40:0 / <60:-3 / <80:-6 / 이상:-10  (getCommonMod, 중등·고등)
// 두 단계로 나누는 이유: 잘 쉰 학생(+3) 대비 피로 40~59는 6점 스윙으로 등급컷 근처에선
// 한 등급이 왔다갔다 하지만, 그 구간에 "며칠째 잠이 모자란" 같은 강한 문장을 쓰면 과하다.
// 약한 단계를 따로 둬서 "점수가 깎이는데 아무 말도 안 하는 구간"을 없애면서 톤을 지킨다.
// (계약 테스트 '침묵 구간이 없다' / '깎이지 않은 구간은 지목하지 않는다'가 이 정합을 양방향으로 잠근다.)
const MILD_FATIGUE = 40;
const HIGH_FATIGUE = 60;

function conditionCause(state: GameState): ConditionCause | null {
  if (state.mentalState === 'burnout') return 'burnout';
  if (state.mentalState === 'tired') return 'tired';
  if (state.fatigue >= HIGH_FATIGUE) return 'fatigue';
  if (state.fatigue >= MILD_FATIGUE) return 'fatigueMild';
  return null;
}

// 초등은 피로 페널티가 피로 0→100 전 구간을 합쳐도 4점이라(getCommonMod: <30:+2 / <60:0 / 이상:-2)
// "점수는 깎이는데 침묵" 문제가 성립하지 않는다. 톤(격려체)을 지키려 피로 단계는 빼되,
// 실제로 -8/-3을 맞는 burnout·tired는 초등에서도 지목한다.
function internalConditionCause(state: GameState, schoolLevel: SchoolLevel): ConditionCause | null {
  const cause = conditionCause(state);
  if (!cause) return null;
  if (schoolLevel === 'elementary' && cause !== 'burnout' && cause !== 'tired') return null;
  return cause;
}

// 컨디션이 나빴다는 것과 그게 이 성적을 만들었다는 것은 다른 얘기다.
// 초판은 둘을 구분하지 않아 양방향으로 틀렸다 — 피로 45로 1등급을 받은 학생에게 담임이
// "한 등급은 더 나온다"고 했고(1등급 위는 없다), 학업 5로 9등급을 받은 학생에게는
// "실력은 붙었어"라고 했다. 게다가 등급 코멘트 14줄이 시험 카드의 80%에서 밀려났다.
// 그래서 결과가 실제로 나빴을 때만 총평을 대체하고, 잘 봤을 때는 성취를 남긴 채 원인만 덧붙인다.
const POOR_MOCK_GRADE = 3;        // 1~2등급 = "컨디션에도 불구하고 해냈다" — 성취를 지우지 않는다
const POOR_INTERNAL_AVERAGE = 70; // generateComment의 '안정적인 성적' 컷과 같은 선

const CONDITION_ASIDE: Record<ConditionCause, string> = {
  burnout: '몸이 무너진 채로 받아낸 성적이라, 마냥 웃을 수만은 없었다.',
  tired: '지친 채로 낸 성적이다. 온전한 몸이었으면 어땠을까.',
  fatigue: '잠을 줄여 만든 성적이라는 게 계속 마음에 걸렸다.',
  fatigueMild: '조금 더 쉬고 봤으면 더 나았을 것 같다.',
};

// 대체할지 덧붙일지의 단일 분기점. 세 시험(내신·모의·수능)이 전부 이걸 통과한다.
function withCondition(
  base: string,
  cause: ConditionCause | null,
  resultIsPoor: boolean,
  dominant: Record<ConditionCause, string>,
  aside: Record<ConditionCause, string> = CONDITION_ASIDE,
): string {
  if (!cause) return base;
  return resultIsPoor ? dominant[cause] : `${base} ${aside[cause]}`;
}

// 내신 총평 — 컨디션이 결과를 지배했을 때 쓰는 문장.
// 문장이 실력을 단정하지 않게 쓴다: "아는 건 다 썼는데"를 바닥 성적(avg 25)에 붙이면
// 바로 아래 담임의 "기초가 부족한 과목이 있어"와 두 줄 간격으로 모순된다.
const INTERNAL_CONDITION_COMMENT: Record<ConditionCause, string> = {
  burnout: '컨디션이 최악이었다. 시험 중에 멍하니 앉아있었다...',
  tired: '피곤한 상태로 시험을 봤다. 실력 발휘가 안 됐다.',
  fatigue: '시험지 앞에서 자꾸 멍해졌다. 며칠째 제대로 쉬지를 못했다.',
  fatigueMild: '마지막 몇 문제에서 힘이 빠졌다. 끝까지 붙잡고 있질 못했다.',
};

// ===== 모의고사 반응 =====

const MOCK_CONDITION_COMMENT: Record<ConditionCause, string> = {
  burnout: '컨디션이 최악이었다. 시험지를 보면서 머리가 하얘졌다...',
  // tired: 기존엔 등급 코멘트로 흘러가 "더 공부하라"는 잘못된 신호를 줬다.
  tired: '아는 문제였는데 손이 안 나갔다. 실력이 아니라 몸이 문제였다.',
  fatigue: '풀 수 있는 문제를 놓쳤다. 며칠째 잠이 모자란 게 답안지에 그대로 남았다.',
  // 약한 단계 — 원인은 짚되 톤은 가볍게(피로 40~59는 흔한 구간이라 과한 문장은 잔소리가 된다)
  fatigueMild: '집중이 끝까지 안 갔다. 조금 더 쉬고 봤으면 달랐을 것 같다.',
};

function generateMockComment(mockGrade: number, state: GameState): string {
  const base = mockGrade <= 2 ? '전국 상위권. 이 페이스면 원하는 대학 갈 수 있다.'
    : mockGrade <= 4 ? '나쁘지 않은 성적이지만, 목표를 높이려면 더 필요하다.'
    : mockGrade <= 6 ? '중간 정도. 지금부터 올리면 아직 가능성은 있다.'
    : mockGrade <= 8 ? '갈 길이 멀다. 기본기부터 다시 잡아야 한다.'
    : '심각한 상황이다. 전략적으로 접근해야 한다.';
  return withCondition(base, conditionCause(state), mockGrade >= POOR_MOCK_GRADE, MOCK_CONDITION_COMMENT);
}

function generateMockParentReaction(mockGrade: number, state: GameState): string {
  const isStrict = state.parents.includes('strict');
  const isEmotional = state.parents.includes('emotional');
  if (mockGrade <= 2) {
    if (isEmotional) return '"정말 대단해! 이대로만 하면 돼!"';
    return '"좋은 성적이네. 방심하지 말고 유지하자."';
  }
  if (mockGrade <= 4) {
    if (isStrict) return '"나쁘진 않은데... 1등급까지 올릴 수 있지 않아?"';
    return '"괜찮은 편이야. 조금만 더 하면 될 거야."';
  }
  if (isStrict) return '"지금 성적이면 갈 수 있는 데가 많지 않아."';
  if (isEmotional) return '"힘들지? 그래도 조금만 더 해보자..."';
  return '"음... 좀 더 노력이 필요할 것 같아."';
}

// 담임은 "처방"을 주는 화자다. 컨디션이 병목일 때 과목 공략을 처방하면 오진이 되므로,
// 그때는 처방 자체를 바꾼다 — 이 게임에서 담임은 유일하게 "덜 하라"고 말할 수 있는 어른이다.
// 대사가 등급을 단정하지 않게 쓴다 — 이 담임은 1등급 학생에게도 9등급 학생에게도 같은 줄을 말한다.
// 초판의 "실력은 붙었어 / 한 등급은 더 나온다"는 1등급(위가 없다)과 9등급(실력이 안 붙었다)
// 양쪽에서 거짓이었고, "공부량 문제가 아니야"도 바닥 성적에서는 오진이었다.
const CONDITION_TEACHER: Record<ConditionCause, string> = {
  burnout: '"성적 얘기는 나중에 하자. 지금은 좀 쉬어야 해. 이건 노력으로 되는 게 아니야."',
  tired: '"공부 얘기는 그다음에 하자. 너 요즘 잠 몇 시간 자니? 거기서부터 손 봐야 해."',
  fatigue: '"문제집을 더 늘리는 걸론 안 올라가. 주말에 하루는 진짜로 쉬어. 그게 공부야."',
  fatigueMild: '"시험날 몸이 안 받쳐주면 준비한 게 그대로 새 나가. 거기부터 맞추자."',
};

function generateMockTeacherReaction(mockGrade: number, state: GameState): string {
  const cause = conditionCause(state);
  // 잘 본 시험에서 담임까지 처방을 바꾸면 "잘했다"는 말이 카드에서 통째로 사라진다.
  // 1~2등급 대사는 이미 "컨디션 관리에 집중하자"라 귀인과 어긋나지도 않는다.
  if (cause && mockGrade >= POOR_MOCK_GRADE) return CONDITION_TEACHER[cause];
  if (mockGrade <= 2) return '"이 성적이면 충분해. 컨디션 관리에 집중하자."';
  if (mockGrade <= 4) return '"가능성은 있어. 약한 과목 집중 공략하자."';
  if (mockGrade <= 6) return '"지금부터 진짜 시작이야. 아직 늦지 않았어."';
  return '"기초부터 다시 잡자. 전략적으로 가야 해."';
}

// ===== 수능 반응 =====

// 7년의 결말인데 기존엔 state를 아예 안 받아, 번아웃 상태로 수능을 봐도 컨디션 언급이 0이었다.
// 수능은 다시 못 보는 시험이라 "쉬어라"는 처방이 성립하지 않는다 —
// 조언이 아니라 회한으로 남긴다(엔딩 후회 레이어와 같은 톤).
//
// 단 수능은 산식이 다르다. suneungScore는 직전 모의 2회와 내신 평균으로만 만들어지고
// (suneungBase = mock1*0.40 + mock2*0.50 + internalAvg*0.10), 수능 주차의 fatigue·mentalState는
// 결과에 1점도 들어가지 않는다. 초판은 그걸 모르고 "그날 몸이 멈춰 섰다"고 썼는데,
// 실측하면 정상/고피로/tired/burnout 네 케이스가 전부 같은 점수·같은 등급이 나왔다.
// 즉 "그날"의 인과는 거짓이다. 참인 인과는 계절 단위다 — 그 몇 달의 컨디션이 모의고사를
// 깎았고, 그 모의고사가 수능 점수가 됐다. 그래서 문장을 전부 그 층위로 다시 썼다.
const SUNEUNG_CONDITION_COMMENT: Record<ConditionCause, string> = {
  burnout: '마지막 해를 무너진 채로 보냈다. 시험장에 앉기 전에 이미 기울어 있었다.',
  tired: '지친 채로 통과한 몇 달이 그대로 성적표가 됐다. 실력이 아니라 몸이 문제였다.',
  fatigue: '마지막 몇 달을 갈아넣은 대가를 성적표로 치렀다. 조금 덜 하고 더 잤어야 했다.',
  fatigueMild: '끝까지 몸이 가벼워지질 않았다. 그 몇 달이 조금만 달랐다면 어땠을까.',
};

// 잘 본 수능에 회한만 남기면 7년의 결말에서 성취가 통째로 지워진다.
// (초판 재현: 2등급인데 총평은 "실력을 쓸 기회조차 없었다", 담임은 "축하한다"였다.)
const SUNEUNG_ASIDE: Record<ConditionCause, string> = {
  burnout: '무너진 몸으로 끝까지 버텨서 받아낸 결과였다.',
  tired: '지친 몇 달을 통과하고도 받아낸 결과였다.',
  fatigue: '잠을 줄여가며 버틴 몇 달이 헛되지는 않았다.',
  fatigueMild: '끝까지 개운하진 않았지만, 결과는 나왔다.',
};

function generateSuneungComment(mockGrade: number, state: GameState): string {
  const base = mockGrade <= 2 ? '12년의 노력이 빛을 발했다. 원하는 곳에 갈 수 있다.'
    : mockGrade <= 4 ? '나쁘지 않은 결과다. 선택지가 열려 있다.'
    : mockGrade <= 6 ? '아쉬운 결과지만, 인생은 수능이 전부가 아니다.'
    : '기대만큼은 아니었다. 하지만 다른 길도 있다.';
  return withCondition(base, conditionCause(state), mockGrade >= POOR_MOCK_GRADE, SUNEUNG_CONDITION_COMMENT, SUNEUNG_ASIDE);
}

function generateSuneungParentReaction(mockGrade: number, state: GameState): string {
  const isStrict = state.parents.includes('strict');
  const isEmotional = state.parents.includes('emotional');
  if (mockGrade <= 2) {
    if (isEmotional) return '"정말 고생했어... 자랑스럽다."';
    return '"잘했다. 수고했어."';
  }
  if (mockGrade <= 4) {
    return '"나쁘지 않아. 잘 선택하면 돼."';
  }
  if (isStrict) return '"...일단 결과가 나왔으니, 이제 앞으로를 생각하자."';
  if (isEmotional) return '"괜찮아. 네가 열심히 한 거 알아."';
  return '"수고했어. 이제 다른 길을 찾아보자."';
}

function generateSuneungTeacherReaction(mockGrade: number): string {
  if (mockGrade <= 2) return '"축하한다. 네가 노력한 결과야."';
  if (mockGrade <= 4) return '"괜찮은 결과야. 잘 선택하면 좋은 길이 열려."';
  return '"수능이 인생의 전부는 아니야. 다른 길도 많다."';
}
