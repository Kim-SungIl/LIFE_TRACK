/**
 * T67 — 결산의 두 화자가 반대로 말하지 않는다.
 *
 * 결산 독백(getResultDialogue)과 성장 둔화 줄은 같은 화면에 선다. 둔화 줄이 보이는 주에는 "좋았다"
 * 계열(잘 본 시험·마일스톤·잘 는 축·마음이 가벼워진 주) 독백이 **전부** 물러선다. 판정은 결산 화면과
 * 같은 함수(slowdownShown → visibleGrowthReason)다.
 *
 * 처음 판본은 풀마다 가드를 달았고, 멘탈 풀 하나가 빠져 mood 문장 326건 중 171건이 "마음이 한결
 * 가볍다"와 함께 떴다(3자 검수). 그래서 여기서는 **긍정 풀 전체를 순회**한다 — 풀 하나의 표지가
 * 빠져도 잡히게.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESULT_POOLS, getResultDialogue } from '../dialogues';
import { createInitialState } from '../gameEngine';
import type { ExamResult, WeekLog } from '../types';

/** 긍정 풀의 첫 문장 — 새 긍정 풀을 만들면 여기에도 적는다(아래 등록 검사가 둘을 맞춘다). */
const UPBEAT_FIRST_LINES = [
  '...해냈다. 진짜로.',
  '이번엔 정말 잘 본 것 같다.',
  '뭔가 한 단계 올라간 기분이다.',
  '공부가 손에 잡힌 한 주였다.',
  '친구들과 가까워진 느낌이다.',
  '내가 좋아하는 게 손에 익는다.',
  '마음이 한결 가볍다.',
  '몸이 가벼워졌다.',
];
// 표지(upbeat)가 아니라 **목록**에서 파생한다 — 표지에서 파생하면 표지가 빠진 풀의 문장이 집합에서
// 같이 빠져서 행동 검사가 그 풀을 못 본다(뮤테이션 A1에서 실제로 그랬다).
const UPBEAT_LINES = new Set(RESULT_POOLS.filter(p => UPBEAT_FIRST_LINES.includes(p.lines[0])).flatMap(p => p.lines));

function log(over: Partial<WeekLog>, slowdown: boolean): WeekLog {
  return {
    statChanges: {}, fatigueChange: 0, moneyChange: 0,
    messages: [], skipped: [], milestoneMessages: [], parentBonusesApplied: [],
    ...(slowdown ? { growthReason: { factor: 'mood' as const, axis: 'academic' as const, variant: 0 } } : {}),
    ...over,
  };
}
const exam = (over: Partial<ExamResult>): ExamResult => ({ average: 90, mockGrade: undefined, ...over } as unknown as ExamResult);

/**
 * 둔화 줄과 **함께 설 수 있는** 긍정 주 픽스처(성장 축이 1.5 미만이라 줄이 보인다). 성장 축 풀
 * (학업·인기·특기·체력 ≥1.5)은 잘 는 주라 둔화 줄이 원리상 안 보인다 — 그 칸은 등록 검사가 맡는다.
 */
const FIXTURES: [string, Partial<WeekLog>][] = [
  ['모의고사 1등급', { examResult: exam({ mockGrade: 1 }) }],
  ['내신 평균 90', { examResult: exam({ average: 90 }) }],
  ['마일스톤', { milestoneMessages: ['"수업 내용이 들리기 시작했다"'] }],
  ['멘탈 +3', { statChanges: { mental: 3, academic: 0.4 } }],
];

afterEach(() => vi.restoreAllMocks());

describe('결산 독백 × 성장 둔화 줄', () => {
  const s = createInitialState('male', ['emotional', 'freedom'], { rngSeed: 3 });

  it('긍정 풀 등록 — 표지(upbeat)가 붙은 풀이 정확히 이 목록이다', () => {
    const flagged = RESULT_POOLS.filter(p => p.upbeat).map(p => p.lines[0]).sort();
    expect(flagged).toEqual([...UPBEAT_FIRST_LINES].sort());
  });

  for (const [name, over] of FIXTURES) {
    it(`${name}: 둔화 줄이 없으면 긍정 독백이 뜬다 (양성 대조)`, () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(UPBEAT_LINES.has(getResultDialogue(s, log(over, false)))).toBe(true);
    });

    it(`${name}: 둔화 줄이 보이면 어떤 긍정 독백도 고르지 않는다`, () => {
      for (const r of [0, 0.4, 0.8]) {
        vi.spyOn(Math, 'random').mockReturnValue(r);
        const line = getResultDialogue(s, log(over, true));
        expect(UPBEAT_LINES.has(line), line).toBe(false);
      }
    });
  }

  it('잘 는 주(성장 축 1.5+)면 둔화 줄이 안 보이므로 긍정 독백이 그대로 뜬다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(getResultDialogue(s, log({ statChanges: { academic: 1.8 } }, true))).toBe('공부가 손에 잡힌 한 주였다.');
  });

  it('주당 상한 줄은 긍정 독백과 함께 설 수 있다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const w = log({ milestoneMessages: ['x'] }, false);
    w.growthReason = { factor: 'weeklyCap', axis: 'academic', variant: 0 };
    expect(UPBEAT_LINES.has(getResultDialogue(s, w))).toBe(true);
  });
});
