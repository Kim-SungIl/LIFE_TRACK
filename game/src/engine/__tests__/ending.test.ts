import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_NOTE, achievementGradeOf, calculateEnding, calculateHappinessGrade, HAPPINESS_LABELS } from '../ending';
import type { HappinessTrajectory } from '../ending';
import { createInitialState } from '../gameEngine';
import type { ExamResult, GameState, ParentStrength, Stats } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

// calculateHappinessGrade 임계 — ending.ts 분기와 동일한 계약 상수.
// (소스 주석 문자열을 파싱하지 않음 — 값 변경 시 이 상수·케이스를 함께 갱신)
const S_MENTAL = 80;
const S_SOCIAL = 60;
const S_HEALTH = 20;
const A_MENTAL = 60;
const A_SOCIAL = 40;
const B_MENTAL = 40;
const C_MENTAL = 25;

// calculateEnding achievement: bestAxis = max(academic, talent, (mental+health+social)/3)
const ACH_S = 85;
const ACH_A = 70;
const ACH_B = 50;
const ACH_C = 30;

function endingState(stats: Stats, overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState('male', PARENTS, { rngSeed: RNG_SEED });
  state.stats = { ...stats };
  return Object.assign(state, overrides);
}

/** academic을 bestAxis로 두고, 약점/붕괴 강등을 피하려고 나머지 축을 floor로 고정 */
function achievementFixture(academic: number, floor = 20): GameState {
  return endingState({
    academic,
    talent: floor,
    mental: floor,
    health: floor,
    social: floor,
  });
}

describe('calculateHappinessGrade', () => {
  it('locks S/A/B/C/D at mental·social·health boundaries', () => {
    // S: mental>=80 && social>=60 && health>=20
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH)).toBe('S');
    expect(calculateHappinessGrade(S_MENTAL - 1, S_SOCIAL, S_HEALTH)).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL - 1, S_HEALTH)).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH - 1)).toBe('A');

    // A: mental>=60 && social>=40
    expect(calculateHappinessGrade(A_MENTAL, A_SOCIAL, 100)).toBe('A');
    expect(calculateHappinessGrade(A_MENTAL - 1, A_SOCIAL, 100)).toBe('B');
    expect(calculateHappinessGrade(A_MENTAL, A_SOCIAL - 1, 100)).toBe('B');

    // B: mental>=40
    expect(calculateHappinessGrade(B_MENTAL, 0, 100)).toBe('B');
    expect(calculateHappinessGrade(B_MENTAL - 1, 0, 100)).toBe('C');

    // C: mental>=25 / else D
    expect(calculateHappinessGrade(C_MENTAL, 0, 100)).toBe('C');
    expect(calculateHappinessGrade(C_MENTAL - 1, 0, 100)).toBe('D');
  });

  it('defaults health to 100 when omitted', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL)).toBe('S');
  });
});

// 궤적 창 — 테스트는 제품 상수/함수를 재사용하지 않는다(공유 오라클 금지). 리터럴로 잠근다.
const YEAR_WEEKS = 48;
const LIFE_WEEKS = 336;

function traj(partial: Partial<HappinessTrajectory> & { weeks: number }): HappinessTrajectory {
  return {
    lowMentalWeeks: 0,
    veryLowMentalWeeks: 0,
    burnoutCount: 0,
    ...partial,
  };
}

describe('calculateHappinessGrade — trajectory caps (bidirectional)', () => {
  it('snapshot S stays S when trajectory is omitted or empty', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH)).toBe('S');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: 0 }))).toBe('S');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS }))).toBe('S');
  });

  it('D: lowMental ratio 40% — year 19/48 is not D, 20/48 is D', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, lowMentalWeeks: 19 }))).toBe('C');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, lowMentalWeeks: 20 }))).toBe('D');
  });

  it('D: lowMental ratio 40% — life 134/336 is not D, 135/336 is D', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, lowMentalWeeks: 134 }))).toBe('C');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, lowMentalWeeks: 135 }))).toBe('D');
  });

  it('D: veryLow ratio 8% — year 3/48 is not D, 4/48 is D', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, veryLowMentalWeeks: 3 }))).toBe('C');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, veryLowMentalWeeks: 4 }))).toBe('D');
  });

  it('D: burnoutCount 5 is not D, 6 is D (career 재수 선과 동일)', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, burnoutCount: 5 }))).toBe('C');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, burnoutCount: 6 }))).toBe('D');
  });

  it('C: lowMental 20% — year 9/48 is not C, 10/48 is C', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, lowMentalWeeks: 9 }))).toBe('B');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, lowMentalWeeks: 10 }))).toBe('C');
  });

  it('C: veryLow 3% — year 1/48 is not C, 2/48 is C', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, veryLowMentalWeeks: 1 }))).toBe('B');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, veryLowMentalWeeks: 2 }))).toBe('C');
  });

  it('C: burnoutCount 2 is not C, 3 is C', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, burnoutCount: 2 }))).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, burnoutCount: 3 }))).toBe('C');
  });

  it('B: lowMental 8% — year 3/48 is not B, 4/48 is B', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, lowMentalWeeks: 3 }))).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, lowMentalWeeks: 4 }))).toBe('B');
  });

  it('B: one burnout in a year caps that year at B; one burnout over 7 years does not', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, burnoutCount: 1 }))).toBe('B');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: YEAR_WEEKS, burnoutCount: 0 }))).toBe('S');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, burnoutCount: 1 }))).toBe('A');
  });

  it('A: any low-mental week over 7 years blocks S but is not B below 8%', () => {
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, lowMentalWeeks: 1 }))).toBe('A');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, traj({ weeks: LIFE_WEEKS, lowMentalWeeks: 0 }))).toBe('S');
  });

  it('trajectory only downgrades — snapshot D stays D even with a clean window', () => {
    expect(calculateHappinessGrade(24, 0, 100, traj({ weeks: YEAR_WEEKS }))).toBe('D');
  });

  // 검수 실측 LEAKED: weeks<=0 가드를 지워도 전 스위트가 통과했다. 악성/깨진 궤적
  // (weeks 0인데 카운트가 있는 상태)이 0으로 나눠 비율이 Infinity가 되면 무조건 D가 된다.
  it('weeks<=0이면 궤적을 무시하고 스냅샷을 쓴다 (0 분모 가드)', () => {
    const broken = { weeks: 0, lowMentalWeeks: 99, veryLowMentalWeeks: 99, burnoutCount: 99 };
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, broken),
      'weeks 0이면 카운트가 아무리 커도 스냅샷 그대로').toBe('S');
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, { ...broken, weeks: -5 })).toBe('S');
    // 음성 짝 — weeks가 1이라도 있으면 같은 카운트가 실제로 강등한다(가드가 과잉이 아님을 보임).
    expect(calculateHappinessGrade(S_MENTAL, S_SOCIAL, S_HEALTH, { ...broken, weeks: 1 })).toBe('D');
  });

  // 양성 바닥 — 라벨이 실제로 존재하고 C 제목이 고립이 아님을 잠근다.
  it('C/D labels exist and C is not "외로운"', () => {
    expect(HAPPINESS_LABELS.C.title).toBe('😐 그늘진 한 해');
    expect(HAPPINESS_LABELS.C.desc).toBe('마음이 자주 비어 있던 한 해.');
    expect(HAPPINESS_LABELS.D.title).toBe('😔 힘들었던 한 해');
    expect(HAPPINESS_LABELS.D.desc).toBe('돌아보면 버티는 것만으로 벅찼다.');
    expect(Object.keys(HAPPINESS_LABELS)).toEqual(['S', 'A', 'B', 'C', 'D']);
  });
});

describe('calculateEnding', () => {
  it('locks achievement grades at bestAxis boundaries 29/30·49/50·69/70·84/85', () => {
    expect(calculateEnding(achievementFixture(ACH_S)).achievement).toBe('S');
    expect(calculateEnding(achievementFixture(ACH_S - 1)).achievement).toBe('A');

    expect(calculateEnding(achievementFixture(ACH_A)).achievement).toBe('A');
    expect(calculateEnding(achievementFixture(ACH_A - 1)).achievement).toBe('B');

    expect(calculateEnding(achievementFixture(ACH_B)).achievement).toBe('B');
    expect(calculateEnding(achievementFixture(ACH_B - 1)).achievement).toBe('C');

    expect(calculateEnding(achievementFixture(ACH_C)).achievement).toBe('C');
    expect(calculateEnding(achievementFixture(ACH_C - 1)).achievement).toBe('D');
  });

  // 위 D 케이스가 성립하는 유일한 이유는 floor가 lifeScore를 29 아래로 눌러준다는 것이다
  // (floor를 30으로 올리면 bestAxis = max(29, 30) = 30 이 되어 D가 조용히 C로 바뀐다).
  // 픽스처 주석엔 "강등을 피하려고"만 적혀 있어 이 의존이 안 보였다 — 전제를 단언으로 박는다.
  it('locks the achievementFixture floor that the D boundary depends on', () => {
    const f = achievementFixture(ACH_C - 1);
    expect(f.stats.mental).toBe(20);
    expect((f.stats.mental + f.stats.health + f.stats.social) / 3).toBe(20);
    expect(ACH_C - 1).toBeGreaterThan((f.stats.mental + f.stats.health + f.stats.social) / 3);
  });

  // **특기 축이 계약에 한 번도 안 들어와 있었다.** achievementFixture는 academic만 올리고
  // 나머지를 floor로 고정하므로 talent가 bestAxis가 되는 케이스가 0개였고, `Math.max`에서
  // talentScore를 통째로 지워도 전체 스위트가 그대로 통과했다(뮤테이션 실측).
  it('locks talent as a bestAxis source, not just academic', () => {
    const top = endingState({ academic: 20, talent: ACH_A, mental: 20, health: 20, social: 20 });
    expect(calculateEnding(top).achievement, '특기 70이 bestAxis').toBe('A');
    const below = endingState({ academic: 20, talent: ACH_A - 1, mental: 20, health: 20, social: 20 });
    expect(calculateEnding(below).achievement).toBe('B');
  });

  // 생활 축과 그 /3 제수. 예전엔 이 둘을 흔드는 뮤턴트를 「happiness S ⇒ achievement ≥ B」
  // 하나만 잡았다 — 성취를 의도적으로 잠근 단언이 아니라 부수 효과였으므로 직접 잠근다.
  it('locks lifeScore as a bestAxis source and its /3 divisor', () => {
    // mental+health+social = 150 → /3 = 50(B). 제수가 5라면 30이 되어 C로 떨어진다.
    const top = endingState({ academic: 20, talent: 20, mental: 50, health: 50, social: 50 });
    expect(calculateEnding(top).achievement).toBe('B');
    const below = endingState({ academic: 20, talent: 20, mental: 49, health: 50, social: 50 });
    expect(calculateEnding(below).achievement, '149/3 = 49.67').toBe('C');
  });

  // **등급은 bestAxis의 단조 함수다 — 부서진 축은 등급을 깎지 않고 문장이 된다.**
  // 예전엔 붕괴가 S를 B로 깎아서, 학업 90.9짜리가 학업 79짜리 A판보다 낮은 등급을 받았다
  // (QA 348판에서 B 102판 **전부**가 이 경로였다). 양성/음성 짝으로 잠근다.
  it('keeps the grade monotone in bestAxis — a broken axis is a note, not a demotion', () => {
    const intact = calculateEnding(endingState({ academic: 92, talent: 30, mental: 30, health: 30, social: 30 }));
    expect(intact.achievement, 'bestAxis 92').toBe('S');
    expect(intact.achievementNote, '부서진 축이 없으면 문장도 없다').toBeNull();

    const collapsed = calculateEnding(endingState({ academic: 92, talent: 5, mental: 30, health: 30, social: 30 }));
    expect(collapsed.achievement, '같은 bestAxis — 강등되지 않는다').toBe('S');
    expect(collapsed.achievementNote).toBe(ACHIEVEMENT_NOTE.collapse);

    const weak = calculateEnding(endingState({ academic: 92, talent: 15, mental: 30, health: 30, social: 30 }));
    expect(weak.achievement).toBe('S');
    expect(weak.achievementNote, '약점(<20)은 붕괴보다 약한 신호 — 다른 문장').toBe(ACHIEVEMENT_NOTE.weakness);
  });

  // 등급에서 강등을 뺐으므로 **최상위 타이틀 게이트(flawlessTop)가 유일하게 부서진 축을 막는 자리**다.
  // 거기서 !hasCollapse를 지우면 한 축이 무너진 판이 「완벽한 청춘」을 받는다.
  it('withholds the top title from a run with a broken axis', () => {
    const blank = { score: 0, grade: 'C' as const, delta: 0 };
    const suneung: ExamResult = {
      subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
      average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
      examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade: 1,
    };
    const over: Partial<GameState> = { examResults: [suneung] };

    const flawless = calculateEnding(endingState(
      { academic: 95, talent: 90, mental: 95, health: 95, social: 95 }, over));
    expect(flawless.achievement).toBe('S');
    expect(flawless.achievementNote).toBeNull();
    expect(flawless.title, '무결점 S + 행복 S + 수능 1등급').toContain('완벽한 청춘');

    // 같은 bestAxis·같은 행복·같은 수능인데 특기만 붕괴 — 등급은 S로 남지만 타이틀은 못 받는다.
    const broken = calculateEnding(endingState(
      { academic: 95, talent: 5, mental: 95, health: 95, social: 95 }, over));
    expect(broken.achievement, '등급은 단조라 그대로 S').toBe('S');
    expect(broken.achievementNote).toBe(ACHIEVEMENT_NOTE.collapse);
    expect(broken.title, '한 축이 부서진 판에 「완벽한 청춘」은 거짓말이다').not.toContain('완벽한 청춘');
  });

  // 등급 함수 자체의 경계 — 순수 함수라 호출부와 별개로 잠근다(값 집합도 타입으로 좁혀 뒀다).
  it('locks achievementGradeOf boundaries', () => {
    expect(achievementGradeOf(ACH_S)).toBe('S');
    expect(achievementGradeOf(ACH_S - 0.01)).toBe('A');
    expect(achievementGradeOf(ACH_A)).toBe('A');
    expect(achievementGradeOf(ACH_A - 0.01)).toBe('B');
    expect(achievementGradeOf(ACH_B)).toBe('B');
    expect(achievementGradeOf(ACH_B - 0.01)).toBe('C');
    expect(achievementGradeOf(ACH_C)).toBe('C');
    expect(achievementGradeOf(ACH_C - 0.01)).toBe('D');
    expect(achievementGradeOf(0)).toBe('D');
  });

  it('is deterministic for the same state (deep equality)', () => {
    const state = achievementFixture(ACH_A);
    const a = calculateEnding(state);
    const b = calculateEnding(state);
    expect(a).toEqual(b);
  });

  it('returns core fields with expected types (grade strings, finite total)', () => {
    const result = calculateEnding(achievementFixture(ACH_B));

    expect(result.achievement).toMatch(/^[SABCD]$/);
    expect(result.happiness).toMatch(/^[SABCD]$/);
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(typeof result.career).toBe('string');
    expect(typeof result.careerDetail).toBe('string');
    expect(Number.isFinite(result.total)).toBe(true);
    expect(Array.isArray(result.npcStories)).toBe(true);
    expect(Array.isArray(result.memorialHighlights)).toBe(true);
    expect(Array.isArray(result.regretHighlights)).toBe(true);
    expect(Array.isArray(result.yearClosings)).toBe(true);
    expect(result.parentEpilogue).toEqual(
      expect.objectContaining({
        tier: expect.stringMatching(/^(distant|normal|warm)$/),
        intro: expect.any(String),
        beats: expect.any(Array),
      }),
    );

    // 핵심 필드 존재·등급 스냅샷 (초기 fixture 기준 — 진로/타이틀은 수능 없음 경로)
    expect({
      achievement: result.achievement,
      happiness: result.happiness,
      career: result.career,
      suneungGrade: result.suneungGrade,
      total: result.total,
      parentTier: result.parentEpilogue.tier,
    }).toMatchInlineSnapshot(`
      {
        "achievement": "B",
        "career": "전문대 / 재수",
        "happiness": "D",
        "parentTier": "normal",
        "suneungGrade": null,
        "total": 130,
      }
    `);
  });

  it('uses 7-year trajectory, not the snapshot alone (consumption lock)', () => {
    // 아래 수치의 출처는 **T21 티켓의 6시드 갈아넣기 하네스**(주말·방학까지 공부, 대화 0)다.
    // QA 페르소나 `grind-burnout`(talk 있음, 번아웃 평균 3.67 → C)과는 다른 빌드다 — 혼동 금지.
    // 그 하네스의 최종 스냅샷(73/88/10)은 궤적 없이 A, 7년 궤적(저멘탈 151·바닥 34·번아웃 11)은 D.
    const grindSnap = endingState({ academic: 80, talent: 40, mental: 73, social: 88, health: 10 });
    expect(calculateEnding(grindSnap).happiness).toBe('A');

    const grindLife = endingState(
      { academic: 80, talent: 40, mental: 73, social: 88, health: 10 },
      {
        lowMentalWeeksByYear: [22, 22, 22, 21, 22, 21, 21],
        veryLowMentalWeeksByYear: [5, 5, 5, 5, 5, 5, 4],
        burnoutCountByYear: [2, 2, 2, 1, 2, 1, 1],
      },
    );
    expect(grindLife.lowMentalWeeksByYear.reduce((a, b) => a + b, 0)).toBe(151);
    expect(grindLife.veryLowMentalWeeksByYear.reduce((a, b) => a + b, 0)).toBe(34);
    expect(grindLife.burnoutCountByYear.reduce((a, b) => a + b, 0)).toBe(11);
    expect(calculateEnding(grindLife).happiness).toBe('D');

    // 균형 스냅샷(89/89/78) + 깨끗한 궤적 = S. 같은 스냅샷 + 갈아넣기 궤적 = D.
    const balanced = endingState({ academic: 70, talent: 40, mental: 89, social: 89, health: 78 });
    expect(calculateEnding(balanced).happiness).toBe('S');
    const balancedButGrindPast = endingState(
      { academic: 70, talent: 40, mental: 89, social: 89, health: 78 },
      {
        lowMentalWeeksByYear: [22, 22, 22, 21, 22, 21, 21],
        veryLowMentalWeeksByYear: [5, 5, 5, 5, 5, 5, 4],
        burnoutCountByYear: [2, 2, 2, 1, 2, 1, 1],
      },
    );
    expect(calculateEnding(balancedButGrindPast).happiness).toBe('D');
  });

  it('lifetime window ignores a single hard year (year-end is the other call site)', () => {
    // Y3만 갈아넣기(22/48 저멘탈). 7년 합 22/336 ≈ 6.5% → A (S 차단, B 미만).
    const oneHardYear = endingState(
      { academic: 70, talent: 40, mental: 89, social: 89, health: 78 },
      {
        lowMentalWeeksByYear: [0, 0, 22, 0, 0, 0, 0],
        veryLowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        burnoutCountByYear: [0, 0, 1, 0, 0, 0, 0],
      },
    );
    expect(calculateEnding(oneHardYear).happiness).toBe('A');
  });

  it('승리자 엔딩: 고립일 때만 「고독한」, 아니면 「대가를 치른」', () => {
    // T21로 D의 의미가 넓어졌다 — 예전 D는 사실상 고립뿐이었지만 이제 저멘탈·번아웃 궤적으로도
    // 열린다. social 88인 판에 "곁에 아무도 없었다"는 거짓이 된다(C 라벨을 「외로운」→「그늘진」으로
    // 고친 것과 같은 이유). 실제로 고립된 판에만 원래 문구를 남긴다.
    const blankSubject = { score: 0, grade: 'C' as const, delta: 0 };
    const suneung: ExamResult = {
      subjects: {
        korean: blankSubject, english: blankSubject, math: blankSubject,
        socialScience: blankSubject, artsPhysical: blankSubject,
      },
      average: 0, rank: null, prevRank: null,
      comment: '', parentReaction: '', teacherReaction: '',
      examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade: 1,
    };
    const grind: Partial<GameState> = {
      lowMentalWeeksByYear: [22, 22, 22, 21, 22, 21, 21],
      veryLowMentalWeeksByYear: [5, 5, 5, 5, 5, 5, 4],
      burnoutCountByYear: [2, 2, 2, 1, 2, 1, 1],
      examResults: [suneung],
    };

    // 관계는 살아 있는데 궤적만 어두운 판 — 고립이 아니다.
    const notAlone = calculateEnding(endingState(
      { academic: 95, talent: 90, mental: 85, social: 88, health: 85 }, grind));
    expect(notAlone.happiness, '궤적으로 D').toBe('D');
    expect(notAlone.achievement, '스탯이 전부 20 이상이라 S 유지').toBe('S');
    expect(notAlone.title, 'social 88인데 「고독한」이면 거짓말이다').toContain('대가를 치른 승리자');
    expect(notAlone.title).not.toContain('고독한');
    expect(notAlone.description).not.toContain('곁에 아무도 없었다');

    // 실제로 고립된 판 — 원래 문구가 살아 있어야 한다(양성 짝).
    const alone = calculateEnding(endingState(
      { academic: 95, talent: 90, mental: 85, social: 30, health: 85 }, grind));
    expect(alone.happiness).toBe('D');
    expect(alone.title, 'social 30이면 원래 문구').toContain('고독한 승리자');
    expect(alone.description).toContain('곁에 아무도 없었다');
  });

  it('구세이브 폴백: 학년 배열이 비었어도 누적 burnoutCount로 궤적을 세운다', () => {
    // T21 이전 세이브엔 학년별 배열이 없어 0으로 백필된다. 그런데 진로 축은 예나 지금이나
    // state.burnoutCount를 읽으므로, 폴백이 없으면 같은 판이 "진로=재수 + 행복=A"로 갈린다 —
    // 이 기능이 없애려던 바로 그 모순이 구세이브에서만 살아남는다(검수 실측 재현).
    const legacy = endingState(
      { academic: 80, talent: 40, mental: 73, social: 88, health: 10 },
      {
        lowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        veryLowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        burnoutCountByYear: [0, 0, 0, 0, 0, 0, 0],
        burnoutCount: 10,
      },
    );
    expect(calculateEnding(legacy).happiness, '누적 10 → D').toBe('D');

    // 음성 짝 — 누적도 0이면 폴백해도 궤적이 없으니 스냅샷 그대로다(폴백이 과잉 강등하지 않음).
    const cleanLegacy = endingState(
      { academic: 70, talent: 40, mental: 89, social: 89, health: 78 },
      {
        lowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        veryLowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        burnoutCountByYear: [0, 0, 0, 0, 0, 0, 0],
        burnoutCount: 0,
      },
    );
    expect(calculateEnding(cleanLegacy).happiness).toBe('S');

    // 배열이 이미 쌓인 판에서는 배열이 정답 — 누적이 더 커도 배열을 덮어쓰지 않는다.
    const arrayWins = endingState(
      { academic: 70, talent: 40, mental: 89, social: 89, health: 78 },
      {
        lowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        veryLowMentalWeeksByYear: [0, 0, 0, 0, 0, 0, 0],
        burnoutCountByYear: [1, 0, 0, 0, 0, 0, 0],
        burnoutCount: 99,
      },
    );
    expect(calculateEnding(arrayWins).happiness, '배열 1회 → A(S만 차단), 99가 아니다').toBe('A');
  });

  it('happiness S still implies achievement ≥ B (C1-B contract)', () => {
    // S는 여전히 health≥20·mental≥80·social≥60을 요구 → lifeScore≥53.33 → achievement 최소 B.
    // 궤적은 강등만 하므로 이 함의는 유지. 주석을 코드와 어긋나게 두지 않기 위한 잠금.
    const s = endingState({ academic: 20, talent: 20, mental: 80, social: 60, health: 20 });
    const result = calculateEnding(s);
    expect(result.happiness).toBe('S');
    expect(result.achievement).toBe('B');
    expect(['C', 'D']).not.toContain(result.achievement);
  });
});
