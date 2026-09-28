// **기존 판정 불변 락 (T58).**
//
// T58은 엔딩에 "성장 모양" 한 줄을 **새 층으로** 얹는다. 얹는 과정에서 등급·타이틀·진로가
// 한 글자라도 달라지면 그건 밸런스 변경이고, 이 리포에서는 폐기 사유다. 그런데 새 층을
// 더하는 커밋은 `calculateEnding` 본문을 건드리므로(축 계산 추출·반환 필드 추가),
// "안 달라졌다"를 **말로 주장하지 않고 값으로 증명**해야 한다.
//
// 증명 방식: 아래 시나리오 표를 T58 **이전 코드**에서 한 번 돌려 인라인 스냅샷으로 굳혔다.
// 변경 후 같은 스냅샷이 그대로 통과하면 그게 before/after 동일성의 증거다.
// (스냅샷을 `-u`로 다시 뜨면 이 증명이 사라진다 — 갱신이 필요하다고 느껴지면
//  그건 기존 판정이 달라졌다는 뜻이므로, 스냅샷이 아니라 변경을 되돌려야 한다.)
//
// 스냅샷만 두면 표가 통째로 퇴화해도(전 케이스가 같은 값이 되어도) 초록이 되므로,
// 아래에 **커버리지 하한**을 함께 단언한다 — 성취 5등급·행복 5등급·특수 타이틀 5종이
// 이 표 안에 실제로 등장해야 한다.
import { describe, expect, it } from 'vitest';
import { BOND_MIN_FRIENDS, BOND_TITLE, calculateEnding } from '../ending';
import { BEST_TIER, DEPARTED_NPC_ID } from '../endingNpc';
import { createInitialState } from '../gameEngine';
import type { ExamResult, GameState, ParentStrength, Stats, Track } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const RNG_SEED = 42;

function suneungResult(mockGrade: number): ExamResult {
  const blank = { score: 0, grade: 'C' as const, delta: 0 };
  return {
    subjects: { korean: blank, english: blank, math: blank, socialScience: blank, artsPhysical: blank },
    average: 0, rank: null, prevRank: null, comment: '', parentReaction: '', teacherReaction: '',
    examType: 'suneung', schoolLevel: 'high', year: 7, semester: 2, mockGrade,
  };
}

interface Scenario {
  label: string;
  stats: Stats;
  track?: Track | null;
  mockGrade?: number | null;
  burnoutCount?: number;
  /** 행복 궤적(7년 합). 생략하면 0 — 스냅샷 판정이 스냅샷 축만 보게 된다. */
  lowMental?: number;
  veryLowMental?: number;
  /** 절친 수 — 관계 타이틀 게이트의 재료. */
  friends?: number;
}

function build(sc: Scenario): GameState {
  const st = createInitialState('female', PARENTS, { rngSeed: RNG_SEED });
  st.stats = { ...sc.stats };
  st.track = sc.track ?? null;
  st.examResults = sc.mockGrade == null ? [] : [suneungResult(sc.mockGrade)];
  st.burnoutCount = sc.burnoutCount ?? 0;
  st.burnoutCountByYear = [sc.burnoutCount ?? 0, 0, 0, 0, 0, 0, 0];
  st.lowMentalWeeksByYear = [sc.lowMental ?? 0, 0, 0, 0, 0, 0, 0];
  st.veryLowMentalWeeksByYear = [sc.veryLowMental ?? 0, 0, 0, 0, 0, 0, 0];
  const friends = sc.friends ?? 0;
  const targets = st.npcs.filter(n => n.id !== DEPARTED_NPC_ID).slice(0, friends).map(n => n.id);
  st.npcs = st.npcs.map(n => (targets.includes(n.id)
    ? { ...n, met: true, intimacy: BEST_TIER }
    : { ...n, met: true, intimacy: 0 }));
  return st;
}

// 특수 타이틀 5종 + 성취/행복 전 등급 + 진로 갈래를 고르게 덮는 표.
// 스탯 값은 QA 하네스 실측(99판) 모양에서 가져왔다 — 손으로 지어낸 극단만 있으면
// "실제로 나오는 판"이 표에서 빠진다.
const SCENARIOS: Scenario[] = [
  { label: '완벽한 청춘', stats: { academic: 92, talent: 60, social: 70, mental: 85, health: 80 }, track: 'science', mockGrade: 1 },
  { label: '고독한 승리자', stats: { academic: 95, talent: 60, social: 30, mental: 25, health: 60 }, track: 'science', mockGrade: 1, burnoutCount: 6 },
  { label: '대가를 치른 승리자', stats: { academic: 95, talent: 60, social: 60, mental: 25, health: 60 }, track: 'humanities', mockGrade: 2, burnoutCount: 6 },
  { label: '불꽃', stats: { academic: 75, talent: 40, social: 50, mental: 50, health: 50 }, track: 'humanities', mockGrade: 3, burnoutCount: 3 },
  { label: '곁에 남은 이름들', stats: { academic: 70, talent: 86, social: 97, mental: 92, health: 80 }, track: 'humanities', mockGrade: 4, friends: BOND_MIN_FRIENDS },
  { label: '행복한 평범함', stats: { academic: 50, talent: 40, social: 70, mental: 85, health: 75 }, track: 'humanities', mockGrade: 3 },
  { label: '평범한 문과', stats: { academic: 70, talent: 50, social: 50, mental: 50, health: 50 }, track: 'humanities', mockGrade: 3 },
  { label: '의대', stats: { academic: 90, talent: 40, social: 55, mental: 60, health: 60 }, track: 'science', mockGrade: 1 },
  { label: '특기자', stats: { academic: 60, talent: 93, social: 55, mental: 60, health: 60 }, track: 'science', mockGrade: 3 },
  { label: '예체능 진학', stats: { academic: 55, talent: 87, social: 55, mental: 60, health: 60 }, track: 'humanities', mockGrade: 4 },
  { label: '재수(번아웃)', stats: { academic: 88, talent: 30, social: 40, mental: 25, health: 50 }, track: 'science', mockGrade: 2, burnoutCount: 5 },
  { label: '쉼표(멘탈 바닥)', stats: { academic: 80, talent: 30, social: 40, mental: 12, health: 50 }, track: 'science', mockGrade: 2 },
  { label: '수능 실패', stats: { academic: 45, talent: 40, social: 50, mental: 50, health: 50 }, track: 'humanities', mockGrade: 7 },
  { label: '지방 4년제(무track)', stats: { academic: 55, talent: 45, social: 50, mental: 50, health: 50 }, track: null, mockGrade: 5 },
  { label: '공부 몰빵(실측형)', stats: { academic: 90, talent: 7, social: 45, mental: 50, health: 55 }, track: 'science', mockGrade: 2, lowMental: 40 },
  { label: '유료루틴(실측형)', stats: { academic: 91, talent: 9, social: 80, mental: 90, health: 90 }, track: 'science', mockGrade: 1 },
  { label: '균형형(실측형)', stats: { academic: 82, talent: 81, social: 86, mental: 88, health: 85 }, track: 'science', mockGrade: 2 },
  { label: '최소투입(실측형)', stats: { academic: 35, talent: 5, social: 22, mental: 20, health: 20 }, track: null, mockGrade: 8 },
  { label: '성취 D', stats: { academic: 8, talent: 8, social: 8, mental: 8, health: 8 }, track: null, mockGrade: 9 },
  { label: '행복 B', stats: { academic: 65, talent: 40, social: 35, mental: 45, health: 60 }, track: 'humanities', mockGrade: 4 },
  { label: '행복 C(궤적)', stats: { academic: 70, talent: 40, social: 70, mental: 85, health: 70 }, track: 'humanities', mockGrade: 3, lowMental: 80 },
  { label: '행복 A', stats: { academic: 70, talent: 40, social: 50, mental: 65, health: 60 }, track: 'science', mockGrade: 3 },
  // ↓ **생활 축이 bestAxis인 판**. 이 두 줄이 없으면 `(mental+health+social)/3`을 `(mental+health)/2`로
  //   바꾸는 뮤테이션이 이 표를 통째로 통과한다(실측: 22행 전부 초록). 등급이 갈리는 자리에 둔다 —
  //   75(A)·86.7(S)은 훼손 산식에서 90·80이 되어 등급이 A→S, S→A로 양방향으로 움직인다.
  { label: '생활 축 최고(A 경계)', stats: { academic: 40, talent: 40, social: 45, mental: 90, health: 90 }, track: 'humanities', mockGrade: 4 },
  { label: '생활 축 최고(S 경계)', stats: { academic: 55, talent: 50, social: 100, mental: 80, health: 80 }, track: 'science', mockGrade: 3 },
];

/** 판정 결과만 뽑는다 — 회상/근황처럼 RNG·기억에 달린 층은 이 락의 대상이 아니다. */
function judgment(sc: Scenario): string {
  const e = calculateEnding(build(sc));
  return [
    sc.label,
    `성취=${e.achievement}`,
    `행복=${e.happiness}`,
    `노트=${e.achievementNote ?? '-'}`,
    `진로=${e.career}`,
    `수능=${e.suneungGrade ?? '-'}`,
    `총합=${e.total}`,
    `타이틀=${e.title}`,
    `설명=${e.description}`,
  ].join(' | ');
}

const TABLE = SCENARIOS.map(judgment);

describe('calculateEnding — 기존 판정 불변 (T58 새 층이 아무것도 안 바꿨다)', () => {
  it('판정 표가 T58 이전과 한 글자도 다르지 않다', () => {
    expect(TABLE.join('\n')).toMatchInlineSnapshot(`
      "완벽한 청춘 | 성취=S | 행복=S | 노트=- | 진로=의대 합격 | 수능=1 | 총합=387 | 타이틀=완벽한 청춘 — 의대 합격 | 설명=성적도, 관계도, 모든 것이 빛나는 학창시절이었다. 최고의 성적. 의과대학 합격 통지서를 받았다.
      고독한 승리자 | 성취=S | 행복=D | 노트=- | 진로=재수 결심 | 수능=1 | 총합=270 | 타이틀=고독한 승리자 — 재수 결심 | 설명=성적은 최고였지만, 돌아보면 곁에 아무도 없었다. 올해는 결과가 좋지 않았다. 1년 더 해보기로 했다.
      대가를 치른 승리자 | 성취=S | 행복=D | 노트=- | 진로=재수 결심 | 수능=2 | 총합=300 | 타이틀=대가를 치른 승리자 — 재수 결심 | 설명=성적은 최고였다. 다만 그 몇 해가 통째로 어두웠다. 올해는 결과가 좋지 않았다. 1년 더 해보기로 했다.
      불꽃 | 성취=A | 행복=C | 노트=- | 진로=인서울 문과 | 수능=3 | 총합=265 | 타이틀=불꽃은 꺼지지 않는다 — 인서울 문과 | 설명=몇 번이고 쓰러졌지만, 그래도 일어났다. 인서울 문과 대학에 합격했다. 나쁘지 않은 결과다.
      곁에 남은 이름들 | 성취=S | 행복=S | 노트=- | 진로=수도권 대학 | 수능=4 | 총합=425 | 타이틀=곁에 남은 이름들 — 수도권 대학 | 설명=지훈, 그리고 7년을 함께 건너온 얼굴들. 무엇을 이뤘냐고 묻는다면, 그 이름들부터 꺼내게 된다. 수도권 4년제에 합격. 이제 본격적인 시작이다.
      행복한 평범함 | 성취=A | 행복=S | 노트=- | 진로=인서울 문과 | 수능=3 | 총합=320 | 타이틀=행복한 평범함 — 인서울 문과 | 설명=성적은 평범했지만, 웃음이 가득한 학창시절이었다. 인서울 문과 대학에 합격했다. 나쁘지 않은 결과다.
      평범한 문과 | 성취=A | 행복=B | 노트=- | 진로=인서울 문과 | 수능=3 | 총합=270 | 타이틀=인서울 문과 | 설명=인서울 문과 대학에 합격했다. 나쁘지 않은 결과다.
      의대 | 성취=S | 행복=A | 노트=- | 진로=의대 합격 | 수능=1 | 총합=305 | 타이틀=의대 합격 | 설명=최고의 성적. 의과대학 합격 통지서를 받았다.
      특기자 | 성취=S | 행복=A | 노트=- | 진로=예술/체육 특기자 | 수능=3 | 총합=328 | 타이틀=예술/체육 특기자 | 설명=특기로 명문 예술대학·체대에 진학했다.
      예체능 진학 | 성취=S | 행복=A | 노트=- | 진로=예체능 진학 | 수능=4 | 총합=317 | 타이틀=예체능 진학 | 설명=특기를 살려 예체능 계열 대학에 진학했다.
      재수(번아웃) | 성취=S | 행복=C | 노트=- | 진로=재수 결심 | 수능=2 | 총합=233 | 타이틀=불꽃은 꺼지지 않는다 — 재수 결심 | 설명=몇 번이고 쓰러졌지만, 그래도 일어났다. 올해는 결과가 좋지 않았다. 1년 더 해보기로 했다.
      쉼표(멘탈 바닥) | 성취=A | 행복=D | 노트=한 축은 거의 비워둔 채였다. | 진로=잠시 쉼표 | 수능=2 | 총합=212 | 타이틀=잠시 쉼표 | 설명=대학보다 자신을 돌보는 게 먼저였다.
      수능 실패 | 성취=B | 행복=B | 노트=- | 진로=전문대 / 재수 | 수능=7 | 총합=235 | 타이틀=전문대 / 재수 | 설명=원하는 곳은 못 갔다. 다른 길을 찾아야 한다.
      지방 4년제(무track) | 성취=B | 행복=B | 노트=- | 진로=지방 4년제 | 수능=5 | 총합=250 | 타이틀=지방 4년제 | 설명=지방 4년제에 합격했다. 여기서 다시 시작이다.
      공부 몰빵(실측형) | 성취=S | 행복=B | 노트=한 축이 부서진 채로 도착했다. | 진로=인서울 상위권 공대 | 수능=2 | 총합=247 | 타이틀=인서울 상위권 공대 | 설명=한양·성균관 수준 공대에 합격했다.
      유료루틴(실측형) | 성취=S | 행복=S | 노트=한 축이 부서진 채로 도착했다. | 진로=의대 합격 | 수능=1 | 총합=360 | 타이틀=의대 합격 | 설명=최고의 성적. 의과대학 합격 통지서를 받았다.
      균형형(실측형) | 성취=S | 행복=S | 노트=- | 진로=인서울 상위권 공대 | 수능=2 | 총합=422 | 타이틀=완벽한 청춘 — 인서울 상위권 공대 | 설명=성적도, 관계도, 모든 것이 빛나는 학창시절이었다. 한양·성균관 수준 공대에 합격했다.
      최소투입(실측형) | 성취=C | 행복=D | 노트=한 축이 부서진 채로 도착했다. | 진로=전문대 / 재수 | 수능=8 | 총합=102 | 타이틀=전문대 / 재수 | 설명=원하는 곳은 못 갔다. 다른 길을 찾아야 한다.
      성취 D | 성취=D | 행복=D | 노트=한 축이 부서진 채로 도착했다. | 진로=잠시 쉼표 | 수능=9 | 총합=40 | 타이틀=잠시 쉼표 | 설명=대학보다 자신을 돌보는 게 먼저였다.
      행복 B | 성취=B | 행복=B | 노트=- | 진로=수도권 대학 | 수능=4 | 총합=245 | 타이틀=수도권 대학 | 설명=수도권 4년제에 합격. 이제 본격적인 시작이다.
      행복 C(궤적) | 성취=A | 행복=C | 노트=- | 진로=인서울 문과 | 수능=3 | 총합=335 | 타이틀=인서울 문과 | 설명=인서울 문과 대학에 합격했다. 나쁘지 않은 결과다.
      행복 A | 성취=A | 행복=A | 노트=- | 진로=인서울 이과 | 수능=3 | 총합=285 | 타이틀=인서울 이과 | 설명=인서울 4년제 이공계에 합격했다.
      생활 축 최고(A 경계) | 성취=A | 행복=A | 노트=- | 진로=수도권 대학 | 수능=4 | 총합=305 | 타이틀=수도권 대학 | 설명=수도권 4년제에 합격. 이제 본격적인 시작이다.
      생활 축 최고(S 경계) | 성취=S | 행복=S | 노트=- | 진로=인서울 이과 | 수능=3 | 총합=365 | 타이틀=인서울 이과 | 설명=인서울 4년제 이공계에 합격했다."
    `);
  });

  // 표가 퇴화하면 스냅샷은 그 퇴화까지 함께 굳힌다 — 그래서 커버리지를 따로 단언한다.
  it('표가 성취 5등급을 전부 덮는다', () => {
    const grades = new Set(SCENARIOS.map(sc => calculateEnding(build(sc)).achievement));
    expect([...grades].sort()).toEqual(['A', 'B', 'C', 'D', 'S']);
  });

  it('표가 행복 5등급을 전부 덮는다', () => {
    const grades = new Set(SCENARIOS.map(sc => calculateEnding(build(sc)).happiness));
    expect([...grades].sort()).toEqual(['A', 'B', 'C', 'D', 'S']);
  });

  it('표가 특수 타이틀 5종을 전부 덮는다', () => {
    const titles = SCENARIOS.map(sc => calculateEnding(build(sc)).title);
    for (const marker of ['완벽한 청춘', '고독한 승리자', '대가를 치른 승리자', '불꽃은 꺼지지 않는다', BOND_TITLE]) {
      expect(titles.some(t => t.includes(marker)), `특수 타이틀 누락: ${marker}`).toBe(true);
    }
  });

  it('표가 진로를 여러 갈래로 덮는다', () => {
    const careers = new Set(SCENARIOS.map(sc => calculateEnding(build(sc)).career));
    expect(careers.size).toBeGreaterThanOrEqual(8);
  });
});
