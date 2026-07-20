// ===== NPC 친밀도 획득 구간별 감쇠 =====
// gameEngine에서 추출 — shopSystem/store/gameEngine 모두가 공유하므로 별도 모듈로 분리
// (rng.ts와 동일한 순환 import 방지 목적). 순수 함수, 의존성 없음.
//
// 구간(1이 만점 배율):
//   0~39: 100% (낯선이 → 친구, 진입은 빠르게)
//   40~59: 80%  (친구 → 친한 친구)
//   60~79: 60%  (친한 친구 → 절친 직전)
//   80~100: 25% (절친 plateau — 천장 효과)
// floor + max(1): 효율 누수 차단하되 양수 효과는 최소 +1 보장 (0 소멸 방지).
//
// exemptMajorReward: 큰 단발 보상(≥8)을 감쇠에서 면제할지. 이벤트 선택 등 "단발" 보상은
//   면제(true)해 여정의 보상감을 지키지만, 반복 구매 가능한 선물은 면제하지 않아야(false)
//   돈으로 관계를 무한히 사는 우회를 막는다.
export function scaleIntimacyChange(delta: number, currentIntimacy: number, exemptMajorReward = true): number {
  if (delta <= 0) return delta;
  if (exemptMajorReward && delta >= 8) return delta;
  let multiplier: number;
  if (currentIntimacy < 40) multiplier = 1.0;
  else if (currentIntimacy < 60) multiplier = 0.8;
  else if (currentIntimacy < 80) multiplier = 0.6;
  else multiplier = 0.25;
  return Math.max(1, Math.floor(delta * multiplier));
}

// ===== 반복 grind 소프트캡 (관계 희소성) =====
// 동행·선물처럼 "무한 반복 가능한" 소스로 얻는 친밀도는 이 상한을 못 넘는다.
// scaleIntimacyChange의 max(1) 바닥값이 80+에서도 매 행동 +1을 보장해, 반복만으로
// 전원 99 수렴을 유발하던 문제를 차단. 절친(캡 초과)은 오직 이벤트(1회성 서사 보상,
// exemptMajorReward)로만 도달 → "깊은 관계는 희소하다"는 설계를 성립시킨다.
// 스탯의 학업/무료활동 80+ 소프트캡(examSystem, gameEngine)과 같은 설계 언어.
export const INTIMACY_GRIND_SOFTCAP = 80;

// 반복 소스(동행·선물) 친밀도 이득 적용 — 감쇠 경유 + 소프트캡 클램프.
// currentIntimacy가 이미 캡 이상(이벤트로 도달)이면 반복 이득은 0 (캡 너머는 못 밀어올림).
export function applyGrindIntimacyGain(currentIntimacy: number, rawDelta: number): number {
  if (rawDelta <= 0) return Math.max(0, Math.min(100, currentIntimacy + rawDelta));
  if (currentIntimacy >= INTIMACY_GRIND_SOFTCAP) return currentIntimacy;
  const scaled = scaleIntimacyChange(rawDelta, currentIntimacy, false);
  return Math.min(INTIMACY_GRIND_SOFTCAP, currentIntimacy + scaled);
}
