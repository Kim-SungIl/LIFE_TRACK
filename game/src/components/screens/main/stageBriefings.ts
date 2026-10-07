import type { ExamType } from '../../../engine/types';

// 진학 브리핑 문구 SSOT — 문장마다 "엔진의 어떤 규칙 변화를 주장하는가"를 같이 적는다.
// 수치는 비공개(존재와 방향만)라 문장엔 값이 없지만, 주장은 값으로 검증할 수 있어야 한다.
// 계약 테스트(__tests__/stageBriefingClaims.test.tsx)가
//   ① 각 claim을 엔진 값과 대조하고(예: payRises → 이 학년 수입이 직전 학년보다 큰가)
//   ② 문장 속 표현이 claim으로 뒷받침되는지 본다(예: "올랐"이 있으면 rises claim, "학원"이 있으면 academy).
// T64: "학원비도 한 단계 더 올랐다"는 academy yearlyCost가 중·고 3만 동일이라 거짓이었다.
//      문장에 근거를 붙이게 하면 같은 종류의 거짓은 claim을 적는 순간 테스트에서 걸린다 — 단 ②는 원문 어휘
//      기준의 tripwire다(극성 반전·한글 수사 같은 어휘 변형은 못 본다, 3자 검수 확인).
export type BriefingClaim =
  /** 이 학년 시험 수(getExamSchedule). byType은 종류별 수까지 주장할 때 */
  | { kind: 'examCount'; count: number; byType?: Partial<Record<ExamType, number>> }
  /** 이 종류의 시험이 이 학년에 처음 생긴다(직전 학년 스케줄엔 없다) */
  | { kind: 'examTypeNew'; type: ExamType }
  /** 성적표에 등급(S~D)과 등수가 나온다 — 직전 학교급엔 둘 다 없었다 */
  | { kind: 'gradeAndRankShown' }
  /** 컨디션이 나쁠 때 시험 점수가 깎이는 폭이 직전 학교급보다 크다 */
  | { kind: 'conditionPenaltyStronger' }
  /** 학업 자연감쇠가 직전 학교급보다 빠르다(학기·방학 모두) */
  | { kind: 'decayFaster' }
  /** 방학 감쇠가 학기보다 크고, 직전 학교급의 방학보다도 크다 */
  | { kind: 'vacationDecayHarsher' }
  /** 이 학년에 새로 열린 활동 — 직전 학년엔 게이트에 막혀 있었다 */
  | { kind: 'unlocked'; activityIds: string[] }
  /** 수입 활동의 벌이가 직전 학년보다 크다 */
  | { kind: 'payRises'; activityIds: string[] }
  /** 유료 활동의 비용이 직전 학년보다 크다 */
  | { kind: 'costRises'; activityIds: string[] }
  /** 수능 주차(절대 주차)와 그 주가 속한 학기 */
  | { kind: 'suneungWeek'; week: number; semester: 1 | 2 }
  /** 이 학년 모의고사 수 */
  | { kind: 'mockCount'; count: number }
  /** 이 학년 모의고사가 수능 점수를 정하고, 그 모의고사는 컨디션에 깎인다 */
  | { kind: 'mocksDecideSuneung' };

export interface BriefingLine { text: string; claims: BriefingClaim[] }
export interface Briefing { title: string; lines: BriefingLine[] }

export const BRIEFINGS: Record<number, Briefing> = {
  2: {
    title: '🏫 중학교에서 달라지는 것',
    lines: [
      { text: '시험이 1년에 4번 — 중간·기말 각 2번',
        claims: [{ kind: 'examCount', count: 4, byType: { midterm: 2, final: 2 } }] },
      { text: '성적표에 등급과 등수가 나온다', claims: [{ kind: 'gradeAndRankShown' }] },
      { text: '컨디션이 나쁜 채로 시험을 보면 실력이 안 나온다', claims: [{ kind: 'conditionPenaltyStronger' }] },
      { text: '손을 놓으면 배운 걸 더 빨리 잊는다', claims: [{ kind: 'decayFaster' }] },
    ],
  },
  5: {
    title: '🎓 고등학교에서 달라지는 것',
    lines: [
      { text: '전국 모의고사까지, 시험이 1년에 6번',
        claims: [{ kind: 'examTypeNew', type: 'mock' }, { kind: 'examCount', count: 6 }] },
      { text: '성적 유지가 훨씬 어렵다 — 특히 방학이 무섭다',
        claims: [{ kind: 'decayFaster' }, { kind: 'vacationDecayHarsher' }] },
      { text: '과외가 열렸고, 알바 시급이 올랐다',
        claims: [
          { kind: 'unlocked', activityIds: ['private-tutoring'] },
          { kind: 'payRises', activityIds: ['part-time', 'short-term-job'] },
        ] },
      // T64: 이 자리는 "학원비도 한 단계 더 올랐다"였다 — academy는 중·고 3만 동일(activities.ts 주석:
      // 고등 4만은 루틴 적자 때문에 일부러 깎았다)이라 거짓. 고1에 실제로 열리는 학교 활동으로 바꿨다.
      { text: '방과후 보충수업과 학교 자율학습도 새로 생겼다',
        claims: [{ kind: 'unlocked', activityIds: ['supplementary-class', 'night-study'] }] },
    ],
  },
  7: {
    title: '⏳ 고3 — 마지막 해',
    lines: [
      { text: '2학기 W35, 수능이 기다린다', claims: [{ kind: 'suneungWeek', week: 35, semester: 2 }] },
      { text: '모의고사 2번이 마지막 리허설', claims: [{ kind: 'mockCount', count: 2 }] },
      { text: '컨디션 관리가 그 어느 때보다 중요하다', claims: [{ kind: 'mocksDecideSuneung' }] },
    ],
  },
};
