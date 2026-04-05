import { GameState, ExamResult, SubjectResult, SubjectKey, ExamGrade } from './types';

// 랜덤 보정 (-범위 ~ +범위)
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

// 시험 대비 선택에 따른 보정
// 'cram' = 벼락치기, 'normal' = 평소대로, 'friends' = 친구와 함께
export type ExamPrep = 'cram' | 'normal' | 'friends';

export function generateExamResult(
  state: GameState,
  examType: 'midterm' | 'final',
  prep: ExamPrep = 'normal',
): ExamResult {
  const { academic, social, talent, mental, health } = state.stats;

  // 컨디션 보정: 멘탈/피로 영향
  const mentalBonus = mental >= 70 ? 5 : mental >= 50 ? 2 : mental >= 30 ? 0 : mental >= 15 ? -5 : -10;
  const fatigueBonus = state.fatigue < 20 ? 3 : state.fatigue < 40 ? 0 : state.fatigue < 60 ? -3 : state.fatigue < 80 ? -7 : -12;

  // tired/burnout 패널티
  const mentalStatePenalty = state.mentalState === 'burnout' ? -15 : state.mentalState === 'tired' ? -8 : 0;

  // 시험 대비 보정
  const prepBonus = prep === 'cram' ? 8 : prep === 'friends' ? 4 : 0;

  // 학년 난이도 보정 (고등학교 시험이 더 어려움)
  const yearPenalty = state.year <= 1 ? 5 : state.year <= 4 ? 0 : state.year <= 6 ? -5 : -8;

  // 공통 보정 합산
  const commonMod = mentalBonus + fatigueBonus + mentalStatePenalty + prepBonus + yearPenalty;

  // 과목별 점수 산출
  const subjects: Record<SubjectKey, SubjectResult> = {
    korean: { score: 0, grade: 'C', delta: 0 },
    english: { score: 0, grade: 'C', delta: 0 },
    math: { score: 0, grade: 'C', delta: 0 },
    socialScience: { score: 0, grade: 'C', delta: 0 },
    artsPhysical: { score: 0, grade: 'C', delta: 0 },
  };

  // 국어: 학업 90% + 특기 10%
  subjects.korean.score = clamp(academic * 0.9 + talent * 0.1 + commonMod + rand(5));
  // 영어: 학업 100%
  subjects.english.score = clamp(academic * 1.0 + commonMod + rand(5));
  // 수학: 학업 100% (변동성 높음)
  subjects.math.score = clamp(academic * 1.0 + commonMod + rand(8));
  // 사회/과학: 학업 80% + 인기 20% (토론/발표 반영)
  subjects.socialScience.score = clamp(academic * 0.8 + social * 0.2 + commonMod + rand(5));
  // 예체능: 특기 70% + 체력 25% + 멘탈 5%
  subjects.artsPhysical.score = clamp(talent * 0.7 + health * 0.25 + mental * 0.05 + commonMod + rand(5));

  // 등급 부여
  for (const key of Object.keys(subjects) as SubjectKey[]) {
    subjects[key].grade = toGrade(subjects[key].score);
  }

  // 전 시험 대비 변화
  const prevExam = state.examResults.length > 0 ? state.examResults[state.examResults.length - 1] : null;
  if (prevExam) {
    for (const key of Object.keys(subjects) as SubjectKey[]) {
      subjects[key].delta = subjects[key].score - prevExam.subjects[key].score;
    }
  }

  // 평균 계산 (주요과목 70%, 예체능 30%)
  const mainAvg = (subjects.korean.score + subjects.english.score + subjects.math.score + subjects.socialScience.score) / 4;
  const average = Math.round(mainAvg * 0.7 + subjects.artsPhysical.score * 0.3);

  // 반 석차 산출 (30명 기준, 평균으로 환산)
  // 평균 100 → 1등, 50 → 15등, 0 → 30등
  const rank = clamp(Math.round(30 - (average / 100) * 29), 1, 30);
  const prevRank = prevExam ? prevExam.rank : null;

  // 한 줄 총평 생성
  const comment = generateComment(subjects, average, state);

  // 부모 반응
  const parentReaction = generateParentReaction(rank, prevRank, state);

  // 선생님 반응
  const teacherReaction = generateTeacherReaction(subjects, rank, state);

  return {
    subjects,
    average,
    rank,
    prevRank,
    comment,
    parentReaction,
    teacherReaction,
    examType,
    year: state.year,
    semester: state.semester,
  };
}

function generateComment(
  subjects: Record<SubjectKey, SubjectResult>,
  average: number,
  state: GameState,
): string {
  const best = (Object.keys(subjects) as SubjectKey[])
    .reduce((a, b) => subjects[a].score > subjects[b].score ? a : b);
  const worst = (Object.keys(subjects) as SubjectKey[])
    .reduce((a, b) => subjects[a].score < subjects[b].score ? a : b);

  const LABELS: Record<SubjectKey, string> = {
    korean: '국어', english: '영어', math: '수학',
    socialScience: '사회/과학', artsPhysical: '예체능',
  };

  if (state.mentalState === 'burnout') {
    return '컨디션이 최악이었다. 시험 중에 멍하니 앉아있었다...';
  }
  if (state.mentalState === 'tired') {
    return '피곤한 상태로 시험을 봤다. 실력 발휘가 안 됐다.';
  }
  if (average >= 85) {
    return `전반적으로 훌륭한 성적. 특히 ${LABELS[best]}에서 두각을 드러냈다.`;
  }
  if (average >= 70) {
    return `안정적인 성적이지만, ${LABELS[worst]}은 좀 더 노력이 필요하다.`;
  }
  if (average >= 50) {
    return `중간 정도의 성적. ${LABELS[best]}은 강점이지만 전반적으로 아쉽다.`;
  }
  if (average >= 30) {
    return `공부에 시간을 더 쏟아야 할 것 같다. ${LABELS[best]}만 그나마 버텼다.`;
  }
  return '전체적으로 많이 부족하다. 기초부터 다시 잡아야 할 것 같다.';
}

function generateParentReaction(rank: number, prevRank: number | null, state: GameState): string {
  const isStrict = state.parents.includes('strict');
  const isEmotional = state.parents.includes('emotional');

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
    if (isStrict) return '"이게 최선이니? 학원을 더 다녀야 하는 거 아니야?"';
    if (isEmotional) return '"괜찮아, 다음에 더 잘하면 되지."';
    return '"음... 조금 더 노력해보자."';
  }
  // 20등 이하
  if (prevRank && rank < prevRank) {
    return '"그래도 지난번보단 올랐네. 조금씩 가자."';
  }
  if (isStrict) return '"이러면 안 되지... 이번 주부터 학원 더 다녀."';
  if (isEmotional) return '"힘들었지? 천천히 하자. 엄마가 도와줄게."';
  return '"좀... 아쉽다. 다음엔 더 열심히 해보자."';
}

function generateTeacherReaction(
  subjects: Record<SubjectKey, SubjectResult>,
  rank: number,
  state: GameState,
): string {
  const artsGrade = subjects.artsPhysical.grade;
  const mainGrades = [subjects.korean.grade, subjects.english.grade, subjects.math.grade, subjects.socialScience.grade];
  const hasS = mainGrades.includes('S');
  const hasD = mainGrades.includes('D');

  if (rank <= 3) return '"이 성적이면 어디든 갈 수 있어. 계속 이렇게만 하자."';
  if (hasS && artsGrade === 'S') return '"주요 과목도 좋고, 예체능도 뛰어나. 다재다능하구나."';
  if (artsGrade === 'S' && !hasS) return '"예체능 쪽에 확실한 재능이 있어. 이쪽으로 길을 생각해봐도 좋겠다."';
  if (hasS) return '"잘하는 과목이 있으니까, 약한 과목도 끌어올려 보자."';
  if (hasD) return '"기초가 부족한 과목이 있어. 보충 수업을 고려해보렴."';
  return '"무난하게 잘 하고 있어. 꾸준히 하자."';
}
