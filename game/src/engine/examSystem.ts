import { GameState, ExamResult, SubjectResult, SubjectKey, ExamGrade, ElementaryGrade, ExamType, SchoolLevel } from './types';

// ===== 유틸리티 =====

function rand(range: number): number {
  return (Math.random() - 0.5) * 2 * range;
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
  if (score >= 96) return 1;
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
    subjects.korean.score = clamp(academic * 0.88 + talent * 0.12 + commonMod + BASE + rand(4));
    subjects.english.score = clamp(academic * 0.90 + commonMod + BASE + rand(4));
    subjects.math.score = clamp(academic * 0.92 + commonMod + BASE + rand(5));
    subjects.socialScience.score = clamp(academic * 0.82 + social * 0.18 + commonMod + BASE + rand(4));
    subjects.artsPhysical.score = clamp(talent * 0.70 + health * 0.25 + mental * 0.05 + commonMod + BASE + rand(4));
  } else if (schoolLevel === 'middle') {
    // 중등: 계수 1.0 이하 유지 + 살짝 보너스 — academic 85+에서 S 등급 달성 가능
    const BASE = 4;
    subjects.korean.score = clamp(academic * 0.95 + talent * 0.10 + commonMod + BASE + rand(6));
    subjects.english.score = clamp(academic * 0.98 + commonMod + BASE + rand(6));
    subjects.math.score = clamp(academic * 1.00 + commonMod + BASE + rand(8));
    subjects.socialScience.score = clamp(academic * 0.88 + social * 0.18 + commonMod + BASE + rand(6));
    subjects.artsPhysical.score = clamp(talent * 0.70 + health * 0.25 + mental * 0.05 + commonMod + BASE + rand(6));
  } else {
    // high — soft cap 임계값 80 + 계수 1.0 이하
    const ea = effectiveAcademic(academic);
    subjects.korean.score = clamp(ea * 0.95 + talent * 0.08 + commonMod + rand(7));
    subjects.english.score = clamp(ea * 0.98 + commonMod + rand(7));
    subjects.math.score = clamp(ea * 1.00 + commonMod + rand(9));
    subjects.socialScience.score = clamp(ea * 0.90 + social * 0.15 + commonMod + rand(7));
    subjects.artsPhysical.score = clamp(talent * 0.72 + health * 0.22 + mental * 0.05 + commonMod + rand(6));
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

  // 전 시험 대비 변화
  const exams = state.examResults || [];
  const prevExam = exams.length > 0 ? exams[exams.length - 1] : null;
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
  const teacherReaction = generateTeacherReaction(subjects, rank, state, schoolLevel);

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

  const mockScore = clamp(ea * 0.98 + mental * 0.15 + prepBonus + fatiguePenalty + mentalStatePenalty + rand(12));
  const mockGrade = toMockGrade(mockScore);

  // 과목별 점수 생성 (표시용) — 모의고사는 예체능 제외 (실제 수능에 없음)
  const commonMod = getCommonMod(state, 'high', prep);
  const subjects = calculateSubjectScores(state, 'high', commonMod);
  // 예체능 점수는 모의/수능에서 의미 없음 — 0으로 설정 (UI에서 숨김)
  subjects.artsPhysical.score = 0;
  subjects.artsPhysical.grade = 'D';
  subjects.artsPhysical.delta = 0;

  const exams = state.examResults || [];
  // 직전 내신 시험(midterm/final)만 delta 비교 대상으로 사용
  const prevExam = exams.filter(e => e.examType === 'mock' || e.examType === 'midterm' || e.examType === 'final').slice(-1)[0] || null;
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

  const suneungBase = mock1 * 0.35 + mock2 * 0.45 + internalAvg * 0.20;
  const growthBonus = clamp(Math.round((mock2 - mock1) * 0.15), 0, 3);
  const suneungScore = clamp(Math.round(suneungBase + growthBonus + rand(3)));
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
    comment: generateSuneungComment(mockGrade),
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
  if (state.mentalState === 'burnout') return '컨디션이 최악이었다. 시험 중에 멍하니 앉아있었다...';
  if (state.mentalState === 'tired') return '피곤한 상태로 시험을 봤다. 실력 발휘가 안 됐다.';

  const best = (Object.keys(subjects) as SubjectKey[]).reduce((a, b) => subjects[a].score > subjects[b].score ? a : b);
  const worst = (Object.keys(subjects) as SubjectKey[]).reduce((a, b) => subjects[a].score < subjects[b].score ? a : b);

  if (schoolLevel === 'elementary') {
    if (average >= 75) return `이번 단원평가 잘 봤다! 특히 ${LABELS[best]}을 잘했어.`;
    if (average >= 45) return '무난하게 잘 했어. 꾸준히 하면 돼!';
    return '조금 어려웠지? 다음엔 더 잘할 수 있을 거야.';
  }

  if (average >= 85) return `전반적으로 훌륭한 성적. 특히 ${LABELS[best]}에서 두각을 드러냈다.`;
  if (average >= 70) return `안정적인 성적이지만, ${LABELS[worst]}은 좀 더 노력이 필요하다.`;
  if (average >= 50) return `중간 정도의 성적. ${LABELS[best]}은 강점이지만 전반적으로 아쉽다.`;
  if (average >= 30) return `공부에 시간을 더 쏟아야 할 것 같다. ${LABELS[best]}만 그나마 버텼다.`;
  return '전체적으로 많이 부족하다. 기초부터 다시 잡아야 할 것 같다.';
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
): string {
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

// ===== 모의고사 반응 =====

function generateMockComment(mockGrade: number, state: GameState): string {
  if (state.mentalState === 'burnout') return '컨디션이 최악이었다. 시험지를 보면서 머리가 하얘졌다...';
  if (mockGrade <= 2) return '전국 상위권. 이 페이스면 원하는 대학 갈 수 있다.';
  if (mockGrade <= 4) return '나쁘지 않은 성적이지만, 목표를 높이려면 더 필요하다.';
  if (mockGrade <= 6) return '중간 정도. 지금부터 올리면 아직 가능성은 있다.';
  if (mockGrade <= 8) return '갈 길이 멀다. 기본기부터 다시 잡아야 한다.';
  return '심각한 상황이다. 전략적으로 접근해야 한다.';
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

function generateMockTeacherReaction(mockGrade: number, state: GameState): string {
  if (mockGrade <= 2) return '"이 성적이면 충분해. 컨디션 관리에 집중하자."';
  if (mockGrade <= 4) return '"가능성은 있어. 약한 과목 집중 공략하자."';
  if (mockGrade <= 6) return '"지금부터 진짜 시작이야. 아직 늦지 않았어."';
  return '"기초부터 다시 잡자. 전략적으로 가야 해."';
}

// ===== 수능 반응 =====

function generateSuneungComment(mockGrade: number): string {
  if (mockGrade <= 2) return '12년의 노력이 빛을 발했다. 원하는 곳에 갈 수 있다.';
  if (mockGrade <= 4) return '나쁘지 않은 결과다. 선택지가 열려 있다.';
  if (mockGrade <= 6) return '아쉬운 결과지만, 인생은 수능이 전부가 아니다.';
  return '기대만큼은 아니었다. 하지만 다른 길도 있다.';
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
