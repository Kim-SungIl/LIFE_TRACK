// ===== 부모 친밀도(parentIntimacy) SSOT — 태그 기반 하이브리드 모델 =====
// 설계: docs/parent-intimacy-redesign.md (v2, 2026-05-30)
//
// 핵심: 부모 강점은 친밀도의 "자동 방향"이 아니라 "행동 반응 배율(0.6/1.0/1.4)"이다.
// 모든 친밀도 변화는 applyParentIntimacyDelta 단일 진입점을 통과한다
// (활동/미니이벤트/시험/이벤트 선택지 — 직접 가산 금지).
// 자동 드리프트는 제거하고, 부모 관련 행동이 없는 주에만 50으로 평균 회귀한다.

import type { GameState, ParentStrength } from './types';

// 친밀도를 움직이는 행동 유형 태그.
export type ParentTag =
  | 'shareWorry'    // 고민 공유
  | 'hideProblem'   // 문제 숨김 (−)
  | 'familyTime'    // 식사·여행·함께한 시간
  | 'gradeImprove'  // 성적 향상
  | 'gradeDrop'     // 성적 급락 (−)
  | 'keepPromise'   // 약속 이행
  | 'breakPromise'  // 약속 파기 (−)
  | 'careerTalk'    // 진로 상담
  | 'ignoreAdvice'  // 조언 무시 (−)
  | 'overspend'     // 과소비 (−)
  | 'moneyRequest'  // 용돈 요청
  | 'autonomyChoice'// 자기주도 선택
  | 'recoveryAction';// 실패 후 만회

export type ParentEffect = { baseDelta: number; tag: ParentTag };

// 강점 × 태그 반응 배율. 민감 1.4 / 기본 1.0(미정의) / 둔감 0.6.
// 각 강점의 정체성은 docs/parent-intimacy-redesign.md §2.2 참조.
const REACTION_TABLE: Record<ParentStrength, Partial<Record<ParentTag, number>>> = {
  // 성적보다 마음으로 움직이는 부모
  emotional: { shareWorry: 1.4, hideProblem: 1.4, familyTime: 1.4, gradeImprove: 0.6, gradeDrop: 0.6, recoveryAction: 1.4 },
  // 신뢰와 책임으로 가까워지는 부모 (만회 1.4 = strict가 따뜻해지는 핵심 경로)
  strict: { familyTime: 0.6, gradeImprove: 1.4, gradeDrop: 1.4, keepPromise: 1.4, breakPromise: 1.4, autonomyChoice: 0.6, recoveryAction: 1.4 },
  // 돈으로 표현하되 같이 보낸 시간을 귀히 여기는 부모
  wealth: { shareWorry: 0.6, familyTime: 1.4, careerTalk: 1.4, overspend: 1.4, moneyRequest: 0.6 },
  // 성적보다 큰 그림(진로·정보)에 민감한 부모
  info: { hideProblem: 1.4, careerTalk: 1.4, ignoreAdvice: 1.4 },
  // 넘어져도 괜찮다고 기다려주는 안전한 부모 (하강 둔감)
  resilience: { hideProblem: 0.6, gradeDrop: 0.6, breakPromise: 0.6, recoveryAction: 1.4 },
  // 간섭 안 하지만 약속은 지키라는 부모 (자유=자기책임, 무관심 아님)
  freedom: { hideProblem: 0.6, familyTime: 0.6, gradeImprove: 0.6, keepPromise: 1.4, ignoreAdvice: 0.6, autonomyChoice: 1.4 },
};

export function reactionMultiplier(strength: ParentStrength, tag: ParentTag): number {
  return REACTION_TABLE[strength]?.[tag] ?? 1.0;
}

// 부모 친밀도 변화 단일 진입점. state.parentIntimacy를 직접 갱신하고 실제 적용량을 반환.
// parents는 [ParentStrength, ParentStrength] 고정 튜플 → 두 강점 배율이 곱해진다.
export function applyParentIntimacyDelta(state: GameState, baseDelta: number, tag: ParentTag): number {
  let delta = baseDelta;

  // (1) 부모 강점 2개 반응 배율 곱 (0.36 ~ 1.96)
  for (const strength of state.parents) {
    delta *= reactionMultiplier(strength, tag);
  }

  // (2) 연속 구간 감쇠 — 천장/바닥에 가까울수록 부드럽게 감쇠 (계단 불연속 없음)
  //     pi=50→×1.0, 70→×0.6, 85→×0.3, 100→clamp 0.2 / 음수는 대칭
  const pi = state.parentIntimacy ?? 50;
  const factor = delta > 0 ? (100 - pi) / 50 : pi / 50;
  delta *= Math.max(0.2, Math.min(1.0, factor));

  const next = Math.max(0, Math.min(100, pi + delta));
  state.parentIntimacy = next;
  return next - pi;
}

// 부모 관련 행동이 없는 주에만 50(평균)으로 천천히 회귀.
// "데면데면하면 평균" — 방치하면 식고, 한 번 식은 관계는 회복이 더디게(저구간 비대칭).
export function applyParentMeanReversion(state: GameState): void {
  if (state.actedWithParentThisWeek) return;
  const pi = state.parentIntimacy ?? 50;
  const k = pi < 50 ? 0.006 : 0.01; // 반감기 ≈ 1.4년(상) / 회복 더딤(하)
  state.parentIntimacy = Math.max(0, Math.min(100, pi + (50 - pi) * k));
}
